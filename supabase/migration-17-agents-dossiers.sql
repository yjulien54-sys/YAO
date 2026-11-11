-- =====================================================================
-- COTIZ — MISE À JOUR SQL N°17 : FONDATEUR, AGENTS ET DOSSIERS
-- • Deux niveaux : « fondateur » (tout) et « agent » du service client.
-- • L'agent voit tout, réinitialise les codes oubliés, mais ne peut ni
--   confirmer un paiement, ni valider un versement, ni modifier, bloquer,
--   retirer ou supprimer : il envoie un DOSSIER au fondateur.
-- • Le fondateur valide le dossier : l'action se fait automatiquement.
-- • Le fondateur ajoute et retire ses agents depuis la page admin.
-- À lancer APRÈS la n°16.  Supabase > SQL Editor > New query > Run
-- =====================================================================

-- 1. Rôle de chaque administrateur (les comptes déjà présents restent fondateurs)
alter table public.admins add column if not exists role text not null default 'fondateur';
alter table public.admins alter column role set default 'agent';
alter table public.admins add column if not exists nom text;
do $$ begin
  alter table public.admins add constraint admins_role_valide check (role in ('fondateur', 'agent'));
exception when duplicate_object then null; end $$;

create or replace function public.mon_role_admin() returns text
language sql security definer stable set search_path = public as $$
  select a.role from admins a
  where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  limit 1;
$$;

create or replace function public.verifier_fondateur() returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.mon_role_admin(), '') <> 'fondateur' then
    raise exception 'Réservé au fondateur : envoie un dossier pour demander cette action';
  end if;
end $$;
revoke all on function public.verifier_fondateur() from public, anon;
grant execute on function public.mon_role_admin() to authenticated;

-- 2. Les actions sensibles deviennent réservées au fondateur
create or replace function public.admin_paiement_statut(paiement uuid, statut text) returns void
language plpgsql security definer set search_path = public as $$
declare info text;
begin
  perform verifier_fondateur();
  if statut not in ('reussi', 'echoue') then raise exception 'Statut invalide'; end if;
  update payments set status = statut where id = paiement and status = 'en_attente';
  if not found then raise exception 'Ce paiement n’est plus en attente'; end if;
  select m.name || ' · ' || g.name || ' · ' || (p.amount + p.penalty) || ' F' into info
    from payments p join members m on m.id = p.member_id join groups g on g.id = p.group_id where p.id = paiement;
  perform journaliser_admin(case when statut = 'reussi' then 'Paiement confirmé' else 'Paiement refusé' end, info);
end $$;

create or replace function public.admin_bloquer(p uuid, bloquer boolean, motif text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  perform set_config('cotiz.admin', 'on', true);
  update profiles set bloque = bloquer,
    bloque_motif = case when bloquer then nullif(trim(coalesce(motif, '')), '') else null end,
    bloque_le = case when bloquer then now() else null end
  where id = p;
  perform set_config('cotiz.admin', 'off', true);
  perform journaliser_admin(case when bloquer then 'Compte bloqué' else 'Compte débloqué' end,
    (select name || ' · ' || phone from profiles where id = p), nullif(trim(coalesce(motif, '')), ''));
end $$;

create or replace function public.admin_modifier_profil(p uuid, nom text, telephone text, naissance date) returns void
language plpgsql security definer set search_path = public as $$
declare avant text;
begin
  perform verifier_fondateur();
  select name || ' · ' || phone || ' · ' || coalesce(date_naissance::text, '—') into avant from profiles where id = p;
  perform set_config('cotiz.admin', 'on', true);
  update profiles set name = coalesce(nullif(trim(nom), ''), name),
    phone = coalesce(nullif(regexp_replace(coalesce(telephone, ''), '\D', '', 'g'), ''), phone),
    date_naissance = coalesce(naissance, date_naissance)
  where id = p;
  perform set_config('cotiz.admin', 'off', true);
  perform journaliser_admin('Profil modifié', avant,
    (select 'devient : ' || name || ' · ' || phone || ' · ' || coalesce(date_naissance::text, '—') from profiles where id = p));
end $$;

create or replace function public.admin_modifier_membre(membre uuid, nom text, telephone text, nouveau_role text) returns void
language plpgsql security definer set search_path = public as $$
declare avant text;
begin
  perform verifier_fondateur();
  if nouveau_role is not null and nouveau_role not in ('tresorier', 'gestionnaire', 'membre') then raise exception 'Rôle invalide'; end if;
  select m.name || ' (' || m.role || case when m.en_attente then ', demande' else '' end || ') · ' || g.name into avant
    from members m join groups g on g.id = m.group_id where m.id = membre;
  perform set_config('cotiz.rattachement', 'on', true);
  update members set name = coalesce(nullif(trim(nom), ''), name),
    phone = coalesce(nullif(regexp_replace(coalesce(telephone, ''), '\D', '', 'g'), ''), phone),
    role = coalesce(nouveau_role, role),
    en_attente = false
  where id = membre;
  perform set_config('cotiz.rattachement', 'off', true);
  perform journaliser_admin('Membre modifié / accepté', avant, (select 'devient : ' || name || ' (' || role || ')' from members where id = membre));
end $$;

create or replace function public.admin_retirer_membre(membre uuid) returns text
language plpgsql security definer set search_path = public as $$
declare info text;
begin
  perform verifier_fondateur();
  select m.name || ' · ' || g.name into info from members m join groups g on g.id = m.group_id where m.id = membre;
  perform journaliser_admin('Membre retiré du groupe', info);
  if exists (select 1 from payments where member_id = membre) then
    perform set_config('cotiz.rattachement', 'on', true);
    update members set archive = true where id = membre;
    perform set_config('cotiz.rattachement', 'off', true);
    return 'archive';
  end if;
  delete from members where id = membre;
  return 'supprime';
end $$;

create or replace function public.admin_supprimer_groupe(g uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  perform journaliser_admin('Groupe supprimé', (select name || ' (' || type || ')' from groups where id = g));
  delete from payouts where group_id = g;
  delete from payments where group_id = g;
  delete from groups where id = g;
  return found;
end $$;

create or replace function public.admin_supprimer_tous_groupes(confirmation text) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  perform verifier_fondateur();
  if confirmation <> 'SUPPRIMER TOUT' then raise exception 'Confirmation incorrecte'; end if;
  select count(*) into n from groups;
  perform journaliser_admin('TOUS les groupes supprimés', n || ' groupe(s)');
  delete from payouts;
  delete from payments;
  delete from groups;
  return n;
end $$;

create or replace function public.admin_versement_decision(demande uuid, accepter boolean) returns text
language plpgsql security definer set search_path = public as $$
declare d demandes_versement; info text;
begin
  perform verifier_fondateur();
  select * into d from demandes_versement where id = demande for update;
  if d.id is null then raise exception 'Demande introuvable'; end if;
  if d.statut <> 'en_attente' then raise exception 'Cette demande est déjà terminée'; end if;
  select d.beneficiary_name || ' · ' || g.name || ' · ' || d.amount || ' F' into info from groups g where g.id = d.group_id;
  if accepter then
    perform versement_enregistrer(d);
    update demandes_versement set statut = 'valide', termine_le = now() where id = demande;
    perform journaliser_admin('Versement validé par l’administrateur', info);
    return 'valide';
  end if;
  update demandes_versement set statut = 'refuse', termine_le = now() where id = demande;
  perform journaliser_admin('Versement refusé par l’administrateur', info);
  return 'refuse';
end $$;

-- Annonces : seul le fondateur les modifie (les agents les voient)
drop policy if exists "annonces: admin écriture" on public.annonces;
create policy "annonces: admin écriture" on public.annonces for all
  using (public.mon_role_admin() = 'fondateur') with check (public.mon_role_admin() = 'fondateur');

-- Journal : lisible par le fondateur seulement
create or replace function public.admin_journal() returns setof public.journal_admin
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  return query select * from journal_admin order by le desc limit 500;
end $$;

-- 3. L'équipe
create or replace function public.admin_equipe() returns table (email text, nom text, role text, ajoute_le timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  return query select a.email, a.nom, a.role, a.ajoute_le from admins a order by a.role desc, a.ajoute_le;
end $$;

create or replace function public.admin_retirer_agent(adresse text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  if lower(adresse) = lower(coalesce(auth.jwt() ->> 'email', '')) then raise exception 'Tu ne peux pas te retirer toi-même'; end if;
  delete from admins where lower(email) = lower(adresse) and role = 'agent';
  if not found then raise exception 'Agent introuvable'; end if;
  perform journaliser_admin('Agent retiré', adresse);
end $$;

-- 4. Les dossiers envoyés au fondateur
create table if not exists public.dossiers_admin (
  id uuid primary key default gen_random_uuid(),
  numero bigserial,
  cree_le timestamptz not null default now(),
  cree_par text not null,
  motif text not null,
  priorite text not null default 'normale' check (priorite in ('normale', 'urgente')),
  client_profile_id uuid,
  client_nom text,
  client_tel text,
  groupe_id uuid,
  groupe_nom text,
  montant integer,
  reference text,
  description text not null,
  donnees jsonb not null default '{}',
  statut text not null default 'ouvert' check (statut in ('ouvert', 'valide', 'refuse')),
  reponse text,
  traite_par text,
  traite_le timestamptz
);
alter table public.dossiers_admin enable row level security;     -- aucune règle : passage obligé par les fonctions
revoke all on public.dossiers_admin from anon, authenticated;

create or replace function public.admin_dossier_creer(
  motif text, description text, priorite text default 'normale',
  client_profile_id uuid default null, client_nom text default null, client_tel text default null,
  groupe_id uuid default null, groupe_nom text default null, montant integer default null,
  reference text default null, donnees jsonb default '{}'
) returns bigint
language plpgsql security definer set search_path = public as $$
declare n bigint;
begin
  perform verifier_admin();
  if coalesce(trim(motif), '') = '' or length(trim(coalesce(description, ''))) < 5 then raise exception 'Choisis un motif et explique la situation'; end if;
  insert into dossiers_admin (cree_par, motif, description, priorite, client_profile_id, client_nom, client_tel, groupe_id, groupe_nom, montant, reference, donnees)
  values (auth.jwt() ->> 'email', trim(motif), trim(description), case when priorite = 'urgente' then 'urgente' else 'normale' end,
          client_profile_id, nullif(trim(coalesce(client_nom, '')), ''), nullif(trim(coalesce(client_tel, '')), ''),
          groupe_id, nullif(trim(coalesce(groupe_nom, '')), ''), montant, nullif(trim(coalesce(reference, '')), ''), coalesce(donnees, '{}'))
  returning numero into n;
  perform journaliser_admin('Dossier n°' || n || ' envoyé', motif, left(description, 200));
  return n;
end $$;

-- Le fondateur voit tous les dossiers ; l'agent voit les siens
create or replace function public.admin_dossiers() returns setof public.dossiers_admin
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_admin();
  return query select * from dossiers_admin
    where public.mon_role_admin() = 'fondateur' or lower(cree_par) = lower(coalesce(auth.jwt() ->> 'email', ''))
    order by (statut = 'ouvert') desc, (priorite = 'urgente') desc, cree_le desc limit 500;
end $$;

-- Le fondateur valide (l'action demandée est faite) ou refuse
create or replace function public.admin_dossier_traiter(dossier uuid, accepter boolean, reponse text default null) returns text
language plpgsql security definer set search_path = public as $$
declare d dossiers_admin; a text; x jsonb;
begin
  perform verifier_fondateur();
  select * into d from dossiers_admin where id = dossier for update;
  if d.id is null then raise exception 'Dossier introuvable'; end if;
  if d.statut <> 'ouvert' then raise exception 'Ce dossier est déjà traité'; end if;
  x := d.donnees; a := x ->> 'action';
  if accepter and a is not null then
    case a
      when 'confirmer_paiement' then perform admin_paiement_statut((x ->> 'paiement_id')::uuid, 'reussi');
      when 'refuser_paiement' then perform admin_paiement_statut((x ->> 'paiement_id')::uuid, 'echoue');
      when 'valider_versement' then perform admin_versement_decision((x ->> 'versement_id')::uuid, true);
      when 'refuser_versement' then perform admin_versement_decision((x ->> 'versement_id')::uuid, false);
      when 'modifier_profil' then perform admin_modifier_profil((x ->> 'profile_id')::uuid, x ->> 'nom', x ->> 'telephone', nullif(x ->> 'naissance', '')::date);
      when 'bloquer' then perform admin_bloquer((x ->> 'profile_id')::uuid, true, coalesce(x ->> 'motif', d.description));
      when 'debloquer' then perform admin_bloquer((x ->> 'profile_id')::uuid, false, null);
      when 'accepter_membre' then perform admin_modifier_membre((x ->> 'membre_id')::uuid, null, null, null);
      when 'retirer_membre' then perform admin_retirer_membre((x ->> 'membre_id')::uuid);
      when 'changer_role' then perform admin_modifier_membre((x ->> 'membre_id')::uuid, null, null, x ->> 'role');
      when 'supprimer_groupe' then perform admin_supprimer_groupe((x ->> 'groupe_id')::uuid);
      else null;
    end case;
  end if;
  update dossiers_admin set statut = case when accepter then 'valide' else 'refuse' end,
    reponse = nullif(trim(coalesce(admin_dossier_traiter.reponse, '')), ''), traite_par = auth.jwt() ->> 'email', traite_le = now()
  where id = dossier;
  perform journaliser_admin(case when accepter then 'Dossier n°' || d.numero || ' validé' else 'Dossier n°' || d.numero || ' refusé' end,
    d.motif || coalesce(' · ' || d.client_nom, ''), nullif(trim(coalesce(admin_dossier_traiter.reponse, '')), ''));
  return case when accepter then 'valide' else 'refuse' end;
end $$;

grant execute on function public.admin_equipe(), public.admin_retirer_agent(text),
  public.admin_dossier_creer(text, text, text, uuid, text, text, uuid, text, integer, text, jsonb),
  public.admin_dossiers(), public.admin_dossier_traiter(uuid, boolean, text) to authenticated;
