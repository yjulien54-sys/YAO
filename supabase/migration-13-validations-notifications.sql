-- =====================================================================
-- COTIZ — Mise à jour n°13 :
--   1. un versement doit être validé par 2 ou 3 responsables du groupe
--   2. notifications dans l'application (cloche + alerte en direct)
-- À lancer APRÈS la mise à jour n°12.
-- Supabase > SQL Editor > New query (vide) > coller > Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. VALIDATION DES VERSEMENTS
--    Le trésorier demande le versement (1re validation). Les co-gestionnaires valident.
--    Validations nécessaires : 2 jusqu'à 15 membres, 3 au-delà
--    (sans dépasser le nombre de responsables du groupe).
-- ---------------------------------------------------------------------
create table if not exists public.demandes_versement (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups on delete cascade,
  round integer not null default 1,
  member_id uuid references public.members on delete set null,
  beneficiary_name text not null,
  amount integer not null check (amount > 0),
  method text not null,
  nature text not null default 'versement',
  note text,
  demande_par uuid not null default auth.uid(),
  statut text not null default 'en_attente' check (statut in ('en_attente', 'valide', 'refuse', 'annule')),
  requis integer not null default 1,
  cree_le timestamptz not null default now(),
  termine_le timestamptz
);
create table if not exists public.validations_versement (
  demande_id uuid not null references public.demandes_versement on delete cascade,
  profile_id uuid not null,
  accord boolean not null,
  le timestamptz not null default now(),
  primary key (demande_id, profile_id)
);
alter table public.demandes_versement enable row level security;
alter table public.validations_versement enable row level security;
drop policy if exists "demandes versement: lecture" on public.demandes_versement;
create policy "demandes versement: lecture" on public.demandes_versement for select using (public.is_member(group_id));
drop policy if exists "validations versement: lecture" on public.validations_versement;
create policy "validations versement: lecture" on public.validations_versement for select
  using (exists (select 1 from public.demandes_versement d where d.id = demande_id and public.is_member(d.group_id)));

-- Plus de versement direct : tout passe par la demande + validations
drop policy if exists "versements: ajout" on public.payouts;

create or replace function public.versement_enregistrer(d public.demandes_versement) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into payouts (group_id, round, member_id, beneficiary_name, amount, method, note, nature, reference, created_by)
  values (d.group_id, d.round, d.member_id, d.beneficiary_name, d.amount, d.method, d.note, d.nature,
          'VRS-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10)), d.demande_par);
end $$;
revoke all on function public.versement_enregistrer(public.demandes_versement) from public, anon, authenticated;

create or replace function public.demander_versement(
  g uuid, tour integer, membre uuid, beneficiaire text, montant integer, moyen text, nat text default 'versement', remarque text default null
) returns json
language plpgsql security definer set search_path = public as $$
declare nb_membres integer; nb_resp integer; seuil integer; req integer; d demandes_versement;
begin
  if not public.can_manage(g) then raise exception 'Seul le trésorier peut demander un versement'; end if;
  if exists (select 1 from demandes_versement where group_id = g and statut = 'en_attente') then
    raise exception 'Un versement est déjà en attente de validation dans ce groupe';
  end if;
  select count(*) into nb_membres from members where group_id = g and not archive and not en_attente;
  -- responsables : le trésorier + les co-gestionnaires inscrits (comptes distincts)
  select count(distinct profile_id) into nb_resp from members
   where group_id = g and not archive and not en_attente and profile_id is not null and role in ('tresorier', 'gestionnaire');
  nb_resp := greatest(nb_resp, 1);
  seuil := case when nb_membres > 15 then 3 else 2 end;
  req := least(seuil, nb_resp);

  insert into demandes_versement (group_id, round, member_id, beneficiary_name, amount, method, nature, note, requis)
  values (g, tour, membre, trim(beneficiaire), montant, moyen, coalesce(nat, 'versement'), nullif(trim(coalesce(remarque, '')), ''), req)
  returning * into d;
  insert into validations_versement (demande_id, profile_id, accord) values (d.id, auth.uid(), true);

  if req <= 1 then
    perform versement_enregistrer(d);
    update demandes_versement set statut = 'valide', termine_le = now() where id = d.id;
    return json_build_object('ok', true, 'statut', 'valide', 'requis', req);
  end if;
  return json_build_object('ok', true, 'statut', 'en_attente', 'requis', req);
end $$;

create or replace function public.valider_versement(demande uuid, accord boolean) returns json
language plpgsql security definer set search_path = public as $$
declare d demandes_versement; n integer;
begin
  select * into d from demandes_versement where id = demande for update;
  if d.id is null then raise exception 'Demande introuvable'; end if;
  if d.statut <> 'en_attente' then raise exception 'Cette demande est déjà terminée'; end if;
  if not public.is_gestionnaire(d.group_id) then raise exception 'Seuls les responsables du groupe peuvent valider'; end if;
  if exists (select 1 from validations_versement where demande_id = demande and profile_id = auth.uid()) then
    raise exception 'Tu as déjà donné ton avis sur ce versement';
  end if;
  insert into validations_versement (demande_id, profile_id, accord) values (demande, auth.uid(), accord);
  if not accord then
    update demandes_versement set statut = 'refuse', termine_le = now() where id = demande;
    return json_build_object('ok', true, 'statut', 'refuse');
  end if;
  select count(*) into n from validations_versement where demande_id = demande and validations_versement.accord;
  if n >= d.requis then
    perform versement_enregistrer(d);
    update demandes_versement set statut = 'valide', termine_le = now() where id = demande;
    return json_build_object('ok', true, 'statut', 'valide');
  end if;
  return json_build_object('ok', true, 'statut', 'en_attente', 'validations', n, 'requis', d.requis);
end $$;

create or replace function public.annuler_versement(demande uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update demandes_versement set statut = 'annule', termine_le = now()
   where id = demande and statut = 'en_attente' and (demande_par = auth.uid() or public.can_manage(group_id));
  if not found then raise exception 'Impossible d’annuler cette demande'; end if;
end $$;

grant execute on function public.demander_versement(uuid, integer, uuid, text, integer, text, text, text),
  public.valider_versement(uuid, boolean), public.annuler_versement(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2. NOTIFICATIONS
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id bigserial primary key,
  profile_id uuid not null,
  group_id uuid references public.groups on delete cascade,
  type text not null,
  titre text not null,
  texte text,
  lien text,
  lue boolean not null default false,
  le timestamptz not null default now()
);
create index if not exists notifications_profil_idx on public.notifications (profile_id, le desc);
alter table public.notifications enable row level security;
drop policy if exists "notifications: lecture" on public.notifications;
create policy "notifications: lecture" on public.notifications for select using (profile_id = auth.uid());
drop policy if exists "notifications: marquer lue" on public.notifications;
create policy "notifications: marquer lue" on public.notifications for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
drop policy if exists "notifications: supprimer" on public.notifications;
create policy "notifications: supprimer" on public.notifications for delete using (profile_id = auth.uid());

do $$ begin
  begin alter publication supabase_realtime add table public.notifications; exception when others then null; end;
  begin alter publication supabase_realtime add table public.demandes_versement; exception when others then null; end;
end $$;

-- Envoie une notification aux responsables d'un groupe (sauf à l'auteur de l'action)
create or replace function public.notifier_responsables(g uuid, typ text, ti text, tx text, li text, sauf uuid default auth.uid(), tresorier_seul boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (profile_id, group_id, type, titre, texte, lien)
  select distinct p, g, typ, ti, tx, li from (
    select created_by as p from groups where id = g
    union
    select profile_id from members where group_id = g and not archive and not en_attente and profile_id is not null
      and (role = 'tresorier' or (not tresorier_seul and role = 'gestionnaire'))
  ) r where p is not null and p is distinct from sauf;
end $$;
revoke all on function public.notifier_responsables(uuid, text, text, text, text, uuid, boolean) from public, anon, authenticated;

-- Paiements : déclaré → trésorier ; confirmé / refusé → membre
create or replace function public.notif_paiements() returns trigger
language plpgsql security definer set search_path = public as $$
declare m members; gname text;
begin
  select * into m from members where id = new.member_id;
  select name into gname from groups where id = new.group_id;
  if tg_op = 'INSERT' and new.status = 'en_attente' then
    perform notifier_responsables(new.group_id, 'paiement_declare', 'Paiement à confirmer',
      coalesce(m.name, 'Un membre') || ' a déclaré ' || (new.amount + new.penalty) || ' F · ' || gname,
      '/groupes/' || new.group_id || '#a-confirmer', auth.uid(), true);
  elsif tg_op = 'INSERT' and new.status = 'reussi' and m.profile_id is not null and m.profile_id is distinct from auth.uid() then
    insert into notifications (profile_id, group_id, type, titre, texte, lien)
    values (m.profile_id, new.group_id, 'paiement_confirme', 'Paiement enregistré ✓',
      'Le trésorier a enregistré ton paiement de ' || (new.amount + new.penalty) || ' F · ' || gname, '/groupes/' || new.group_id);
  elsif tg_op = 'UPDATE' and old.status = 'en_attente' and new.status in ('reussi', 'echoue') and m.profile_id is not null then
    insert into notifications (profile_id, group_id, type, titre, texte, lien)
    values (m.profile_id, new.group_id,
      case when new.status = 'reussi' then 'paiement_confirme' else 'paiement_refuse' end,
      case when new.status = 'reussi' then 'Paiement confirmé ✓' else 'Paiement non reçu' end,
      case when new.status = 'reussi' then 'Ton paiement de ' || (new.amount + new.penalty) || ' F a été confirmé · ' || gname
           else 'Le trésorier n’a pas reçu ton paiement de ' || (new.amount + new.penalty) || ' F · ' || gname end,
      '/groupes/' || new.group_id);
  end if;
  return new;
end $$;
drop trigger if exists notif_paiements on public.payments;
create trigger notif_paiements after insert or update on public.payments for each row execute function public.notif_paiements();

-- Demandes pour rejoindre : nouvelle demande → responsables ; acceptée → la personne
create or replace function public.notif_membres() returns trigger
language plpgsql security definer set search_path = public as $$
declare gname text;
begin
  select name into gname from groups where id = new.group_id;
  if tg_op = 'INSERT' and new.en_attente then
    perform notifier_responsables(new.group_id, 'demande_adhesion', 'Demande pour rejoindre',
      new.name || ' veut rejoindre « ' || gname || ' »', '/groupes/' || new.group_id, new.profile_id, false);
  elsif tg_op = 'UPDATE' and old.en_attente and not new.en_attente and new.profile_id is not null then
    insert into notifications (profile_id, group_id, type, titre, texte, lien)
    values (new.profile_id, new.group_id, 'adhesion_acceptee', 'Bienvenue dans le groupe', 'Ta demande pour rejoindre « ' || gname || ' » a été acceptée', '/groupes/' || new.group_id);
  end if;
  return new;
end $$;
drop trigger if exists notif_membres on public.members;
create trigger notif_membres after insert or update on public.members for each row execute function public.notif_membres();

-- Versements : demande → responsables ; validé → bénéficiaire + demandeur ; refusé → demandeur
create or replace function public.notif_versements() returns trigger
language plpgsql security definer set search_path = public as $$
declare gname text; benef uuid;
begin
  select name into gname from groups where id = new.group_id;
  if tg_op = 'INSERT' and new.statut = 'en_attente' then
    perform notifier_responsables(new.group_id, 'versement_a_valider', 'Versement à valider',
      new.amount || ' F pour ' || new.beneficiary_name || ' · ' || gname, '/groupes/' || new.group_id || '#a-valider', new.demande_par, false);
  elsif tg_op = 'UPDATE' and old.statut = 'en_attente' and new.statut = 'valide' then
    select profile_id into benef from members where id = new.member_id;
    insert into notifications (profile_id, group_id, type, titre, texte, lien)
    select distinct p, new.group_id, 'versement_valide', 'Versement validé ✓',
      new.amount || ' F pour ' || new.beneficiary_name || ' · ' || gname, '/groupes/' || new.group_id
    from unnest(array[benef, new.demande_par]) p where p is not null and p is distinct from auth.uid();
  elsif tg_op = 'UPDATE' and old.statut = 'en_attente' and new.statut = 'refuse' then
    insert into notifications (profile_id, group_id, type, titre, texte, lien)
    values (new.demande_par, new.group_id, 'versement_refuse', 'Versement refusé',
      'Un responsable a refusé le versement de ' || new.amount || ' F · ' || gname, '/groupes/' || new.group_id);
  end if;
  return new;
end $$;
drop trigger if exists notif_versements on public.demandes_versement;
create trigger notif_versements after insert or update on public.demandes_versement for each row execute function public.notif_versements();
