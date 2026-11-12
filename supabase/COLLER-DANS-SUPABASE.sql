-- =====================================================================
-- COTIZ — FICHIER UNIQUE À COLLER DANS SUPABASE (mises à jour 15 à 29)
-- 1. Supabase > SQL Editor > New query (page vide)
-- 2. Coller TOUT ce fichier, du début à la fin
-- 3. Cliquer sur Run  →  « Success »
-- On peut le relancer sans risque si c'était déjà fait.
-- =====================================================================


-- >>>>>>>>>>>>>>>>>>>> migration-15-invitation-directe.sql <<<<<<<<<<<<<<<<<<<<
-- =====================================================================
-- COTIZ — MISE À JOUR SQL N°15 : INVITATION DIRECTE PAR LE RESPONSABLE
-- Invité par le créateur du groupe ou le trésorier : la personne entre
-- directement dans le groupe, sans attendre de validation.
-- Invité par un simple membre : la demande attend que le créateur ou le
-- trésorier l'accepte (ou la refuse), et on voit qui a invité.
-- Supabase > SQL Editor > New query (vide) > coller > Run
-- =====================================================================

-- 1. Clé secrète d'invitation de chaque groupe (lisible seulement par le créateur et le trésorier)
create table if not exists public.cles_invitation (
  group_id uuid primary key references public.groups on delete cascade,
  cle text not null default encode(extensions.gen_random_bytes(12), 'hex')
);
alter table public.cles_invitation enable row level security;   -- aucune règle : personne ne la lit directement
revoke all on public.cles_invitation from anon, authenticated;

-- 2. Qui a invité la personne en attente
alter table public.members add column if not exists invite_par uuid references auth.users on delete set null;

-- 3. Lien du responsable : renvoie la clé si on est créateur ou trésorier, sinon rien
create or replace function public.cle_invitation(g uuid) returns text
language plpgsql security definer set search_path = public as $$
declare k text;
begin
  if not public.can_manage(g) then return null; end if;
  insert into cles_invitation (group_id) values (g) on conflict (group_id) do nothing;
  select cle into k from cles_invitation where group_id = g;
  return k;
end $$;

-- 4. Rejoindre : avec la clé du responsable → membre tout de suite ; sinon → demande en attente
drop function if exists public.join_group(uuid);
create or replace function public.join_group(g uuid, cle text default null, par uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare p profiles; m_id uuid; direct boolean; inviteur uuid;
begin
  select * into p from profiles where id = auth.uid();
  if p is null then raise exception 'profil manquant'; end if;
  if p.bloque then raise exception 'compte bloqué'; end if;
  if not exists (select 1 from groups where id = g) then raise exception 'groupe introuvable'; end if;

  direct := exists (select 1 from groups where id = g and created_by = auth.uid())
         or (cle is not null and exists (select 1 from cles_invitation k where k.group_id = g and k.cle = join_group.cle));

  -- Déjà dans le groupe : si c'était une demande et qu'on arrive avec le lien du responsable, on entre
  select id into m_id from members where group_id = g and profile_id = auth.uid() order by turn_position limit 1;
  if m_id is not null then
    if direct then update members set en_attente = false where group_id = g and profile_id = auth.uid() and en_attente; end if;
    return m_id;
  end if;

  -- Le trésorier avait déjà ajouté ce numéro : reconnu tout de suite (toutes ses parts)
  perform set_config('cotiz.rattachement', 'on', true);
  update members set profile_id = auth.uid()
   where group_id = g and profile_id is null
     and right(regexp_replace(phone,'\D','','g'),10) = right(regexp_replace(p.phone,'\D','','g'),10);
  perform set_config('cotiz.rattachement', 'off', true);
  select id into m_id from members where group_id = g and profile_id = auth.uid() order by turn_position limit 1;
  if m_id is not null then return m_id; end if;

  -- Qui a invité ? (seulement si c'est vraiment un membre du groupe)
  select profile_id into inviteur from members
   where group_id = g and profile_id = par and profile_id <> auth.uid() and not en_attente limit 1;

  insert into members (group_id, profile_id, name, phone, role, turn_position, en_attente, invite_par)
  values (g, auth.uid(), p.name, p.phone, 'membre',
          coalesce((select max(turn_position) + 1 from members where group_id = g), 0),
          not direct, case when direct then null else inviteur end)
  returning id into m_id;
  return m_id;
end $$;

grant execute on function public.join_group(uuid, text, uuid), public.cle_invitation(uuid) to authenticated;


-- >>>>>>>>>>>>>>>>>>>> migration-16-admin-complet.sql <<<<<<<<<<<<<<<<<<<<
-- =====================================================================
-- COTIZ — MISE À JOUR SQL N°16 : ADMINISTRATION COMPLÈTE
-- • Tous les membres de tous les groupes, avec leur situation de paiement
--   (à jour / pas encore payé / paiement en attente / demande pour rejoindre)
-- • L'administrateur peut valider un versement à la place des responsables
-- • Journal des actions de l'administrateur (qui a fait quoi, quand)
-- Supabase > SQL Editor > New query (vide) > coller > Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Journal des actions de l'administrateur
-- ---------------------------------------------------------------------
create table if not exists public.journal_admin (
  id bigserial primary key,
  le timestamptz not null default now(),
  admin_email text,
  action text not null,
  cible text,
  detail text
);
alter table public.journal_admin enable row level security;     -- aucune règle : lu seulement par admin_journal()
revoke all on public.journal_admin from anon, authenticated;

create or replace function public.journaliser_admin(act text, cib text, det text default null) returns void
language sql security definer set search_path = public as $$
  insert into journal_admin (admin_email, action, cible, detail) values (auth.jwt() ->> 'email', act, cib, det);
$$;
revoke all on function public.journaliser_admin(text, text, text) from public, anon, authenticated;

create or replace function public.admin_journal() returns setof public.journal_admin
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_admin();
  return query select * from journal_admin order by le desc limit 500;
end $$;

-- ---------------------------------------------------------------------
-- 2. Les actions existantes laissent maintenant une trace
-- ---------------------------------------------------------------------
create or replace function public.admin_paiement_statut(paiement uuid, statut text) returns void
language plpgsql security definer set search_path = public as $$
declare info text;
begin
  perform verifier_admin();
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
  perform verifier_admin();
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
  perform verifier_admin();
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

create or replace function public.admin_reinitialiser_code_profil(p uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_admin();
  update codes_secrets set hash = null, essais = 0, bloque_jusqua = null, modifie_le = now() where profile_id = p;
  insert into codes_historique (profile_id, action) values (p, 'reinitialisation');
  perform journaliser_admin('Code secret réinitialisé', (select name || ' · ' || phone from profiles where id = p));
end $$;

create or replace function public.admin_reinitialiser_code(telephone text) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  perform verifier_admin();
  n := public.reinitialiser_code(telephone);
  perform journaliser_admin('Code secret réinitialisé', telephone, n || ' compte(s)');
  return n;
end $$;

create or replace function public.admin_modifier_membre(membre uuid, nom text, telephone text, nouveau_role text) returns void
language plpgsql security definer set search_path = public as $$
declare avant text;
begin
  perform verifier_admin();
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
  perform verifier_admin();
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
  perform verifier_admin();
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
  perform verifier_admin();
  if confirmation <> 'SUPPRIMER TOUT' then raise exception 'Confirmation incorrecte'; end if;
  select count(*) into n from groups;
  perform journaliser_admin('TOUS les groupes supprimés', n || ' groupe(s)');
  delete from payouts;
  delete from payments;
  delete from groups;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- 3. Tous les membres, avec leur situation (g = null : tous les groupes)
-- statut : 'a_jour' | 'pas_paye' | 'en_attente' (paiement déclaré) | 'demande' (veut rejoindre)
-- ---------------------------------------------------------------------
create or replace function public.admin_membres(g uuid default null) returns table (
  membre_id uuid, profile_id uuid, nom text, telephone text, role text, bloque boolean,
  groupe_id uuid, groupe text, type text, montant integer, tour integer,
  statut text, paye_tour bigint, total_paye bigint, nb_attente bigint
)
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_admin();
  return query
    select m.id, m.profile_id, m.name, m.phone, m.role, coalesce(pr.bloque, false),
      gr.id, gr.name, gr.type, gr.amount, gr.current_round,
      case
        when m.en_attente then 'demande'
        when x.attente > 0 then 'en_attente'
        when (gr.type = 'collecte' and x.tour_paye > 0) or (gr.type <> 'collecte' and x.tour_paye >= gr.amount) then 'a_jour'
        else 'pas_paye'
      end,
      x.tour_paye, x.total, x.attente
    from members m
    join groups gr on gr.id = m.group_id
    left join profiles pr on pr.id = m.profile_id
    cross join lateral (
      select
        coalesce(sum(p.amount) filter (where p.status = 'reussi' and (gr.type = 'collecte' or p.round = gr.current_round)), 0)::bigint as tour_paye,
        coalesce(sum(p.amount + p.penalty) filter (where p.status = 'reussi'), 0)::bigint as total,
        count(*) filter (where p.status = 'en_attente') as attente
      from payments p where p.member_id = m.id
    ) x
    where not m.archive and (admin_membres.g is null or m.group_id = admin_membres.g)
    order by gr.type, gr.name, m.turn_position;
end $$;

-- ---------------------------------------------------------------------
-- 4. Versements en attente de validation, et décision de l'administrateur
-- ---------------------------------------------------------------------
create or replace function public.admin_versements_attente() returns table (
  id uuid, le timestamptz, groupe_id uuid, groupe text, beneficiaire text, montant integer, moyen text,
  tour integer, requis integer, validations bigint, demande_par text
)
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_admin();
  return query
    select d.id, d.cree_le, d.group_id, g.name, d.beneficiary_name, d.amount, d.method, d.round, d.requis,
      (select count(*) from validations_versement v where v.demande_id = d.id and v.accord),
      (select name from profiles where profiles.id = d.demande_par)
    from demandes_versement d join groups g on g.id = d.group_id
    where d.statut = 'en_attente' order by d.cree_le desc;
end $$;

create or replace function public.admin_versement_decision(demande uuid, accepter boolean) returns text
language plpgsql security definer set search_path = public as $$
declare d demandes_versement; info text;
begin
  perform verifier_admin();
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

grant execute on function public.admin_journal(), public.admin_membres(uuid), public.admin_versements_attente(),
  public.admin_versement_decision(uuid, boolean) to authenticated;


-- >>>>>>>>>>>>>>>>>>>> migration-17-agents-dossiers.sql <<<<<<<<<<<<<<<<<<<<
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
drop function if exists public.admin_equipe();
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


-- >>>>>>>>>>>>>>>>>>>> migration-18-equipe-rh.sql <<<<<<<<<<<<<<<<<<<<
-- =====================================================================
-- COTIZ — MISE À JOUR SQL N°18 : ÉQUIPE (NUMÉROS 27xx, FICHE RH,
-- PLANNING, SALAIRES, CNPS) ET REQUÊTES DES CLIENTS
-- • Chaque membre de l'équipe a un numéro : 2701 = fondateur, puis 2702, 2703…
-- • Fiche de l'agent : téléphone Wave, pièce d'identité (numéro + photo),
--   photo, salaire mensuel, CNPS (déclaré ou non), embauche, contrat…
-- • Planning de travail ; salaires payés mois par mois.
-- • Les clients écrivent au service client depuis l'application ;
--   les agents voient ces requêtes et répondent (le client reçoit une notification).
-- À lancer APRÈS la n°17.  Supabase > SQL Editor > New query > Run
-- =====================================================================

-- 1. Fiche de chaque membre de l'équipe
alter table public.admins
  add column if not exists numero integer unique,
  add column if not exists telephone text,
  add column if not exists photo_path text,
  add column if not exists cni_numero text,
  add column if not exists cni_path text,
  add column if not exists salaire integer,
  add column if not exists cnps_declare boolean not null default false,
  add column if not exists cnps_numero text,
  add column if not exists cnps_le date,
  add column if not exists embauche_le date,
  add column if not exists contrat text,
  add column if not exists contact_urgence text,
  add column if not exists note text;

-- Numéros : le fondateur le plus ancien = 2701, puis les autres dans l'ordre d'arrivée
do $$
declare r record; n integer;
begin
  if not exists (select 1 from admins where numero = 2701) then
    update admins set numero = 2701 where email = (select email from admins where role = 'fondateur' and numero is null order by ajoute_le limit 1);
  end if;
  for r in select email from admins where numero is null order by (role = 'fondateur') desc, ajoute_le loop
    select greatest(coalesce(max(numero), 2701), 2701) + 1 into n from admins;
    update admins set numero = n where email = r.email;
  end loop;
end $$;

create or replace function public.prochain_numero_agent() returns integer
language sql security definer stable set search_path = public as $$
  select greatest(coalesce(max(numero), 2701), 2701) + 1 from admins;
$$;
revoke all on function public.prochain_numero_agent() from public, anon, authenticated;

-- L'équipe (le fondateur voit les fiches complètes)
drop function if exists public.admin_equipe();
create or replace function public.admin_equipe() returns setof public.admins
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  return query select * from admins order by numero nulls last;
end $$;

-- Ma fiche (pour l'agent connecté : numéro, nom… sans les données sensibles des autres)
create or replace function public.ma_fiche_admin() returns json
language sql security definer stable set search_path = public as $$
  select json_build_object('email', email, 'nom', nom, 'role', role, 'numero', numero, 'salaire', salaire,
    'cnps_declare', cnps_declare, 'embauche_le', embauche_le, 'photo_path', photo_path)
  from admins where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) limit 1;
$$;

create or replace function public.admin_agent_modifier(adresse text, champs jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  update admins set
    nom = case when champs ? 'nom' then nullif(trim(champs ->> 'nom'), '') else nom end,
    telephone = case when champs ? 'telephone' then nullif(regexp_replace(champs ->> 'telephone', '\D', '', 'g'), '') else telephone end,
    cni_numero = case when champs ? 'cni_numero' then nullif(trim(champs ->> 'cni_numero'), '') else cni_numero end,
    salaire = case when champs ? 'salaire' then nullif(regexp_replace(champs ->> 'salaire', '\D', '', 'g'), '')::integer else salaire end,
    cnps_declare = case when champs ? 'cnps_declare' then (champs ->> 'cnps_declare')::boolean else cnps_declare end,
    cnps_numero = case when champs ? 'cnps_numero' then nullif(trim(champs ->> 'cnps_numero'), '') else cnps_numero end,
    cnps_le = case when champs ? 'cnps_le' then nullif(champs ->> 'cnps_le', '')::date else cnps_le end,
    embauche_le = case when champs ? 'embauche_le' then nullif(champs ->> 'embauche_le', '')::date else embauche_le end,
    contrat = case when champs ? 'contrat' then nullif(trim(champs ->> 'contrat'), '') else contrat end,
    contact_urgence = case when champs ? 'contact_urgence' then nullif(trim(champs ->> 'contact_urgence'), '') else contact_urgence end,
    note = case when champs ? 'note' then nullif(trim(champs ->> 'note'), '') else note end,
    photo_path = case when champs ? 'photo_path' then nullif(champs ->> 'photo_path', '') else photo_path end,
    cni_path = case when champs ? 'cni_path' then nullif(champs ->> 'cni_path', '') else cni_path end
  where lower(email) = lower(adresse);
  if not found then raise exception 'Agent introuvable'; end if;
  perform journaliser_admin('Fiche agent modifiée', (select coalesce(nom, email) || ' · ' || coalesce(numero::text, '—') from admins where lower(email) = lower(adresse)),
    (select string_agg(k, ', ') from jsonb_object_keys(champs) k));
end $$;

-- Retirer TOUS les agents (le fondateur reste)
create or replace function public.admin_retirer_tous_agents(confirmation text) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  perform verifier_fondateur();
  if confirmation <> 'RETIRER TOUS LES AGENTS' then raise exception 'Confirmation incorrecte'; end if;
  select count(*) into n from admins where role = 'agent';
  delete from admins where role = 'agent';
  perform journaliser_admin('TOUS les agents retirés', n || ' agent(s)');
  return n;
end $$;

-- 2. Planning de travail
create table if not exists public.planning_agents (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  jour date not null,
  debut time not null,
  fin time not null,
  note text,
  cree_le timestamptz not null default now()
);
create index if not exists planning_jour_idx on public.planning_agents (jour);
alter table public.planning_agents enable row level security;
revoke all on public.planning_agents from anon, authenticated;

drop function if exists public.admin_planning(date, date);
create or replace function public.admin_planning(du date, au date) returns table (id uuid, email text, nom text, numero integer, jour date, debut time, fin time, note text)
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_admin();
  return query select p.id, p.email, a.nom, a.numero, p.jour, p.debut, p.fin, p.note
    from planning_agents p left join admins a on lower(a.email) = lower(p.email)
    where p.jour between du and au
      and (public.mon_role_admin() = 'fondateur' or lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
    order by p.jour, p.debut;
end $$;

create or replace function public.admin_planning_ajouter(adresse text, j date, de time, a time, remarque text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare i uuid;
begin
  perform verifier_fondateur();
  if a <= de then raise exception 'L’heure de fin doit être après l’heure de début'; end if;
  if not exists (select 1 from admins where lower(email) = lower(adresse)) then raise exception 'Agent introuvable'; end if;
  insert into planning_agents (email, jour, debut, fin, note) values (lower(adresse), j, de, a, nullif(trim(coalesce(remarque, '')), '')) returning id into i;
  return i;
end $$;

create or replace function public.admin_planning_supprimer(i uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  delete from planning_agents where id = i;
end $$;

-- 3. Salaires
create table if not exists public.salaires_agents (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  mois text not null check (mois ~ '^\d{4}-\d{2}$'),
  montant integer not null,
  moyen text not null default 'wave',
  reference text,
  paye_le timestamptz not null default now(),
  paye_par text,
  unique (email, mois)
);
alter table public.salaires_agents enable row level security;
revoke all on public.salaires_agents from anon, authenticated;

create or replace function public.admin_salaires(m text) returns table (email text, nom text, numero integer, telephone text, salaire integer, cnps_declare boolean, paye boolean, montant_paye integer, paye_le timestamptz, reference text)
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  return query select a.email, a.nom, a.numero, a.telephone, a.salaire, a.cnps_declare,
      s.id is not null, s.montant, s.paye_le, s.reference
    from admins a left join salaires_agents s on lower(s.email) = lower(a.email) and s.mois = m
    where a.role = 'agent' order by a.numero;
end $$;

create or replace function public.admin_salaire_payer(adresse text, m text, montant integer, ref text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  if montant is null or montant <= 0 then raise exception 'Montant invalide'; end if;
  insert into salaires_agents (email, mois, montant, reference, paye_par)
  values (lower(adresse), m, montant, nullif(trim(coalesce(ref, '')), ''), auth.jwt() ->> 'email')
  on conflict (email, mois) do update set montant = excluded.montant, reference = excluded.reference, paye_le = now(), paye_par = excluded.paye_par;
  perform journaliser_admin('Salaire payé', (select coalesce(nom, email) || ' · ' || coalesce(numero::text, '—') from admins where lower(email) = lower(adresse)), m || ' · ' || montant || ' F');
end $$;

create or replace function public.admin_salaire_annuler(adresse text, m text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  delete from salaires_agents where lower(email) = lower(adresse) and mois = m;
  perform journaliser_admin('Paiement de salaire annulé', adresse, m);
end $$;

-- 4. Requêtes des clients (envoyées depuis l'application)
create table if not exists public.requetes_clients (
  id uuid primary key default gen_random_uuid(),
  numero bigserial,
  cree_le timestamptz not null default now(),
  profile_id uuid not null default auth.uid() references auth.users on delete cascade,
  nom text,
  telephone text,
  motif text not null,
  message text not null check (length(message) between 5 and 2000),
  statut text not null default 'nouvelle' check (statut in ('nouvelle', 'en_cours', 'resolue')),
  agent_email text,
  reponse text,
  maj_le timestamptz not null default now()
);
create index if not exists requetes_statut_idx on public.requetes_clients (statut, cree_le desc);
alter table public.requetes_clients enable row level security;
drop policy if exists "requêtes: lire les miennes" on public.requetes_clients;
create policy "requêtes: lire les miennes" on public.requetes_clients for select using (profile_id = auth.uid());
drop policy if exists "requêtes: écrire" on public.requetes_clients;
create policy "requêtes: écrire" on public.requetes_clients for insert
  with check (profile_id = auth.uid() and statut = 'nouvelle' and agent_email is null and reponse is null);
grant select, insert on public.requetes_clients to authenticated;

-- Nom et numéro remplis par le serveur (pas de faux nom)
create or replace function public.requete_remplir() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select name, phone into new.nom, new.telephone from profiles where id = new.profile_id;
  -- 5 requêtes maximum par heure et par personne
  if (select count(*) from requetes_clients where profile_id = new.profile_id and cree_le > now() - interval '1 hour') >= 5 then
    raise exception 'Tu as déjà envoyé plusieurs messages. Le service client te répond bientôt.';
  end if;
  return new;
end $$;
drop trigger if exists requete_remplir on public.requetes_clients;
create trigger requete_remplir before insert on public.requetes_clients for each row execute function public.requete_remplir();

create or replace function public.admin_requetes() returns setof public.requetes_clients
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_admin();
  return query select * from requetes_clients order by (statut = 'resolue'), (statut = 'en_cours'), cree_le desc limit 500;
end $$;

create or replace function public.admin_requete_prendre(r uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_admin();
  update requetes_clients set statut = 'en_cours', agent_email = auth.jwt() ->> 'email', maj_le = now() where id = r and statut <> 'resolue';
end $$;

create or replace function public.admin_requete_repondre(r uuid, texte text, resoudre boolean default true) returns void
language plpgsql security definer set search_path = public as $$
declare q requetes_clients;
begin
  perform verifier_admin();
  if length(trim(coalesce(texte, ''))) < 2 then raise exception 'Écris une réponse'; end if;
  update requetes_clients set reponse = trim(texte), agent_email = auth.jwt() ->> 'email',
    statut = case when resoudre then 'resolue' else 'en_cours' end, maj_le = now()
  where id = r returning * into q;
  if q.id is null then raise exception 'Requête introuvable'; end if;
  insert into notifications (profile_id, type, titre, texte, lien)
  values (q.profile_id, 'service_client', 'Réponse du service client', left(trim(texte), 300), '/aide#mes-requetes');
end $$;

grant execute on function public.ma_fiche_admin(), public.admin_equipe(), public.admin_agent_modifier(text, jsonb),
  public.admin_retirer_tous_agents(text), public.admin_planning(date, date), public.admin_planning_ajouter(text, date, time, time, text),
  public.admin_planning_supprimer(uuid), public.admin_salaires(text), public.admin_salaire_payer(text, text, integer, text),
  public.admin_salaire_annuler(text, text), public.admin_requetes(), public.admin_requete_prendre(uuid),
  public.admin_requete_repondre(uuid, text, boolean) to authenticated;

-- 5. Photos et pièces d'identité des agents (stockage privé, fondateur seulement)
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public) values ('agents', 'agents', false) on conflict (id) do nothing;
    drop policy if exists "agents: fondateur lit" on storage.objects;
    create policy "agents: fondateur lit" on storage.objects for select to authenticated
      using (bucket_id = 'agents' and public.mon_role_admin() = 'fondateur');
    drop policy if exists "agents: fondateur ajoute" on storage.objects;
    create policy "agents: fondateur ajoute" on storage.objects for insert to authenticated
      with check (bucket_id = 'agents' and public.mon_role_admin() = 'fondateur');
    drop policy if exists "agents: fondateur remplace" on storage.objects;
    create policy "agents: fondateur remplace" on storage.objects for update to authenticated
      using (bucket_id = 'agents' and public.mon_role_admin() = 'fondateur');
    drop policy if exists "agents: fondateur supprime" on storage.objects;
    create policy "agents: fondateur supprime" on storage.objects for delete to authenticated
      using (bucket_id = 'agents' and public.mon_role_admin() = 'fondateur');
  end if;
end $$;


-- >>>>>>>>>>>>>>>>>>>> migration-19-caisse-cotiz.sql <<<<<<<<<<<<<<<<<<<<
-- =====================================================================
-- COTIZ — MISE À JOUR SQL N°19 : CAISSE COTIZ (COMPTE MARCHAND WAVE)
-- • Le fondateur peut activer « Caisse Cotiz » depuis /admin :
--   les membres paient par Wave sur le compte marchand de Cotiz.
-- • Ces paiements ne peuvent être confirmés QUE par le fondateur
--   (c'est lui qui voit l'argent arriver). Le trésorier est prévenu.
-- À lancer APRÈS la n°18.  Supabase > SQL Editor > New query > Run
-- =====================================================================

-- 1. Réglages de l'application (non secrets : lisibles par l'application)
create table if not exists public.parametres_app (
  cle text primary key,
  valeur text,
  maj_le timestamptz not null default now(),
  maj_par text
);
alter table public.parametres_app enable row level security;
drop policy if exists "paramètres: lecture" on public.parametres_app;
create policy "paramètres: lecture" on public.parametres_app for select using (cle like 'caisse_cotiz_%');
grant select on public.parametres_app to anon, authenticated;

create or replace function public.admin_parametre(c text, v text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  if c not in ('caisse_cotiz_actif', 'caisse_cotiz_lien', 'caisse_cotiz_nom') then raise exception 'Réglage inconnu'; end if;
  if c = 'caisse_cotiz_lien' and coalesce(v, '') <> '' and v !~ '^https://(pay|qr)\.wave\.com/' then
    raise exception 'Le lien doit être un lien Wave (https://pay.wave.com/… ou https://qr.wave.com/…)';
  end if;
  insert into parametres_app (cle, valeur, maj_le, maj_par) values (c, nullif(trim(coalesce(v, '')), ''), now(), auth.jwt() ->> 'email')
  on conflict (cle) do update set valeur = excluded.valeur, maj_le = now(), maj_par = excluded.maj_par;
  perform journaliser_admin('Réglage modifié', c, left(coalesce(v, '—'), 120));
end $$;
grant execute on function public.admin_parametre(text, text) to authenticated;

-- 2. Paiements envoyés sur le compte Cotiz
alter table public.payments add column if not exists encaisse_cotiz boolean not null default false;

create or replace function public.garde_caisse_cotiz() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.mon_role_admin(), '') = 'fondateur' then return new; end if;
  if new.encaisse_cotiz is distinct from old.encaisse_cotiz then
    raise exception 'Ce réglage ne peut pas être modifié';
  end if;
  if old.encaisse_cotiz and old.status = 'en_attente' and new.status is distinct from old.status then
    raise exception 'Ce paiement a été envoyé sur le compte Cotiz : c’est Cotiz qui le confirme après vérification.';
  end if;
  return new;
end $$;
drop trigger if exists garde_caisse_cotiz on public.payments;
create trigger garde_caisse_cotiz before update on public.payments for each row execute function public.garde_caisse_cotiz();

-- 3. Liste « paiements en attente » de l'administration : on voit lesquels sont sur le compte Cotiz
drop function if exists public.admin_paiements_attente();
create or replace function public.admin_paiements_attente() returns table (
  id uuid, le timestamptz, groupe text, membre text, montant integer, moyen text, tresorier_tel text,
  encaisse_cotiz boolean, reference text, membre_tel text
)
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_admin();
  return query
    select p.id, p.created_at, g.name, m.name, p.amount + p.penalty, p.method, pr.phone,
      p.encaisse_cotiz, case when p.transaction_id like 'DECL-%' then null else p.transaction_id end, m.phone
    from payments p join groups g on g.id = p.group_id join members m on m.id = p.member_id
    left join profiles pr on pr.id = g.created_by
    where p.status = 'en_attente' order by p.encaisse_cotiz desc, p.created_at desc limit 300;
end $$;
grant execute on function public.admin_paiements_attente() to authenticated;

-- 4. Notifications des paiements automatiques (Wave API / GeniusPay) et de la Caisse Cotiz
--    • paiement en ligne créé par le serveur : pas de « Paiement à confirmer » pour le trésorier
--    • paiement confirmé automatiquement (ou par Cotiz) : le membre ET le trésorier sont prévenus
create or replace function public.notif_paiements() returns trigger
language plpgsql security definer set search_path = public as $$
declare m members; gname text; auto boolean := auth.uid() is null;
begin
  select * into m from members where id = new.member_id;
  select name into gname from groups where id = new.group_id;
  if tg_op = 'INSERT' and new.status = 'en_attente' then
    if not auto then
      perform notifier_responsables(new.group_id, 'paiement_declare',
        case when new.encaisse_cotiz then 'Paiement envoyé sur le compte Cotiz' else 'Paiement à confirmer' end,
        coalesce(m.name, 'Un membre') || ' a ' || case when new.encaisse_cotiz then 'payé ' else 'déclaré ' end || (new.amount + new.penalty) || ' F · ' || gname
          || case when new.encaisse_cotiz then ' (vérification par Cotiz)' else '' end,
        '/groupes/' || new.group_id || '#a-confirmer', auth.uid(), true);
    end if;
  elsif tg_op = 'INSERT' and new.status = 'reussi' and m.profile_id is not null and m.profile_id is distinct from auth.uid() then
    insert into notifications (profile_id, group_id, type, titre, texte, lien)
    values (m.profile_id, new.group_id, 'paiement_confirme', 'Paiement enregistré ✓',
      'Le trésorier a enregistré ton paiement de ' || (new.amount + new.penalty) || ' F · ' || gname, '/groupes/' || new.group_id);
  elsif tg_op = 'UPDATE' and old.status = 'en_attente' and new.status in ('reussi', 'echoue') then
    if m.profile_id is not null then
      insert into notifications (profile_id, group_id, type, titre, texte, lien)
      values (m.profile_id, new.group_id,
        case when new.status = 'reussi' then 'paiement_confirme' else 'paiement_refuse' end,
        case when new.status = 'reussi' then 'Paiement confirmé ✓' else 'Paiement non reçu' end,
        case when new.status = 'reussi' then 'Ton paiement de ' || (new.amount + new.penalty) || ' F a été confirmé · ' || gname
             else 'Ton paiement de ' || (new.amount + new.penalty) || ' F n’a pas été reçu · ' || gname end,
        '/groupes/' || new.group_id);
    end if;
    -- Confirmé sans le trésorier (paiement automatique ou Caisse Cotiz) : on prévient le trésorier
    if new.status = 'reussi' and (auto or new.encaisse_cotiz) then
      perform notifier_responsables(new.group_id, 'paiement_recu', 'Paiement reçu ✓',
        coalesce(m.name, 'Un membre') || ' a payé ' || (new.amount + new.penalty) || ' F · ' || gname
          || case when new.encaisse_cotiz then ' (sur le compte Cotiz)' else '' end,
        '/groupes/' || new.group_id, null, false);
    end if;
  end if;
  return new;
end $$;


-- >>>>>>>>>>>>>>>>>>>> migration-20-planning-equipe.sql <<<<<<<<<<<<<<<<<<<<
-- =====================================================================
-- COTIZ — MISE À JOUR SQL N°20 : PLANNING VISIBLE PAR TOUTE L'ÉQUIPE
-- Chaque agent voit le planning de tous ses collègues (et peut filtrer
-- pour ne voir que le sien). Seul le fondateur ajoute, modifie ou supprime.
-- À lancer APRÈS la n°19.  Supabase > SQL Editor > New query > Run
-- =====================================================================
drop function if exists public.admin_planning(date, date);
create or replace function public.admin_planning(du date, au date) returns table (id uuid, email text, nom text, numero integer, jour date, debut time, fin time, note text)
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_admin();
  return query select p.id, p.email, a.nom, a.numero, p.jour, p.debut, p.fin, p.note
    from planning_agents p left join admins a on lower(a.email) = lower(p.email)
    where p.jour between du and au
    order by p.jour, p.debut;
end $$;


-- >>>>>>>>>>>>>>>>>>>> migration-21-fonctions-equipe.sql <<<<<<<<<<<<<<<<<<<<
-- =====================================================================
-- COTIZ — MISE À JOUR SQL N°21 : FONCTIONS (POSTES) DES MEMBRES DE L'ÉQUIPE
-- Chaque agent peut avoir une ou plusieurs fonctions, cochées dans une liste
-- (service client, recouvrement, comptabilité…). Visible dans l'Équipe,
-- le planning et l'espace de l'agent.
-- À lancer APRÈS la n°20.  Supabase > SQL Editor > New query > Run
-- =====================================================================
alter table public.admins add column if not exists fonctions text[] not null default '{}';

-- Le fondateur coche les fonctions dans la fiche de l'agent
create or replace function public.admin_agent_modifier(adresse text, champs jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  update admins set
    nom = case when champs ? 'nom' then nullif(trim(champs ->> 'nom'), '') else nom end,
    telephone = case when champs ? 'telephone' then nullif(regexp_replace(champs ->> 'telephone', '\D', '', 'g'), '') else telephone end,
    cni_numero = case when champs ? 'cni_numero' then nullif(trim(champs ->> 'cni_numero'), '') else cni_numero end,
    salaire = case when champs ? 'salaire' then nullif(regexp_replace(champs ->> 'salaire', '\D', '', 'g'), '')::integer else salaire end,
    cnps_declare = case when champs ? 'cnps_declare' then (champs ->> 'cnps_declare')::boolean else cnps_declare end,
    cnps_numero = case when champs ? 'cnps_numero' then nullif(trim(champs ->> 'cnps_numero'), '') else cnps_numero end,
    cnps_le = case when champs ? 'cnps_le' then nullif(champs ->> 'cnps_le', '')::date else cnps_le end,
    embauche_le = case when champs ? 'embauche_le' then nullif(champs ->> 'embauche_le', '')::date else embauche_le end,
    contrat = case when champs ? 'contrat' then nullif(trim(champs ->> 'contrat'), '') else contrat end,
    contact_urgence = case when champs ? 'contact_urgence' then nullif(trim(champs ->> 'contact_urgence'), '') else contact_urgence end,
    note = case when champs ? 'note' then nullif(trim(champs ->> 'note'), '') else note end,
    photo_path = case when champs ? 'photo_path' then nullif(champs ->> 'photo_path', '') else photo_path end,
    cni_path = case when champs ? 'cni_path' then nullif(champs ->> 'cni_path', '') else cni_path end,
    fonctions = case when champs ? 'fonctions' then (select coalesce(array_agg(trim(x)), '{}') from jsonb_array_elements_text(champs -> 'fonctions') x where trim(x) <> '') else fonctions end
  where lower(email) = lower(adresse);
  if not found then raise exception 'Agent introuvable'; end if;
  perform journaliser_admin('Fiche agent modifiée', (select coalesce(nom, email) || ' · ' || coalesce(numero::text, '—') from admins where lower(email) = lower(adresse)),
    (select string_agg(k, ', ') from jsonb_object_keys(champs) k));
end $$;

-- L'agent voit ses fonctions dans son espace
create or replace function public.ma_fiche_admin() returns json
language sql security definer stable set search_path = public as $$
  select json_build_object('email', email, 'nom', nom, 'role', role, 'numero', numero, 'salaire', salaire,
    'cnps_declare', cnps_declare, 'embauche_le', embauche_le, 'photo_path', photo_path, 'fonctions', fonctions)
  from admins where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) limit 1;
$$;

-- Le planning affiche la fonction de chacun
drop function if exists public.admin_planning(date, date);
create or replace function public.admin_planning(du date, au date) returns table (id uuid, email text, nom text, numero integer, fonctions text[], jour date, debut time, fin time, note text)
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_admin();
  return query select p.id, p.email, a.nom, a.numero, coalesce(a.fonctions, '{}'), p.jour, p.debut, p.fin, p.note
    from planning_agents p left join admins a on lower(a.email) = lower(p.email)
    where p.jour between du and au
    order by p.jour, p.debut;
end $$;
grant execute on function public.admin_planning(date, date) to authenticated;


-- >>>>>>>>>>>>>>>>>>>> migration-22-annonces-video.sql <<<<<<<<<<<<<<<<<<<<
-- =====================================================================
-- COTIZ — MISE À JOUR SQL N°22 : VIDÉOS DANS LES ANNONCES
-- Une annonce peut contenir une vidéo : quand c'est son tour dans le
-- carrousel de l'accueil, la vidéo passe en entier, puis l'annonce suivante.
-- À lancer APRÈS la n°21.  Supabase > SQL Editor > New query > Run
-- =====================================================================
alter table public.annonces add column if not exists video text;
do $$ begin
  alter table public.annonces add constraint annonces_video_lien check (video is null or video ~ '^(https://|/pub/)');
exception when duplicate_object then null; end $$;


-- >>>>>>>>>>>>>>>>>>>> migration-23-frais-service.sql <<<<<<<<<<<<<<<<<<<<
-- =====================================================================
-- COTIZ — MISE À JOUR SQL N°23 : FRAIS DE SERVICE COTIZ (REVENUS)
-- • Sur chaque paiement EN LIGNE (GeniusPay / Wave API), Cotiz ajoute des
--   frais de service fixes par tranche, payés par le membre et affichés avant.
-- • Le fondateur règle les tranches depuis /admin → Revenus.
-- • Le paiement manuel au trésorier reste gratuit.
-- À lancer APRÈS la n°22.  Supabase > SQL Editor > New query > Run
-- =====================================================================

-- 1. Frais de service enregistrés sur chaque paiement (sur la 1re ligne d'une transaction)
alter table public.payments add column if not exists frais_service integer not null default 0;

-- 2. Réglages lisibles par l'application (pour afficher les frais avant de payer)
drop policy if exists "paramètres: lecture" on public.parametres_app;
create policy "paramètres: lecture" on public.parametres_app for select
  using (cle like 'caisse_cotiz_%' or cle like 'frais_service_%');

create or replace function public.admin_parametre(c text, v text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  if c not in ('caisse_cotiz_actif', 'caisse_cotiz_lien', 'caisse_cotiz_nom', 'frais_service_actif', 'frais_service_tranches') then
    raise exception 'Réglage inconnu';
  end if;
  if c = 'caisse_cotiz_lien' and coalesce(v, '') <> '' and v !~ '^https://(pay|qr)\.wave\.com/' then
    raise exception 'Le lien doit être un lien Wave (https://pay.wave.com/… ou https://qr.wave.com/…)';
  end if;
  if c = 'frais_service_tranches' then
    -- liste JSON de tranches : [{"max": 5000, "frais": 50}, …, {"max": null, "frais": 300}]
    if jsonb_typeof(v::jsonb) <> 'array' or jsonb_array_length(v::jsonb) not between 1 and 10 then
      raise exception 'Tranches invalides';
    end if;
    if exists (select 1 from jsonb_array_elements(v::jsonb) t
               where (t ->> 'frais')::numeric < 0 or (t ->> 'frais')::numeric > 5000) then
      raise exception 'Frais entre 0 et 5 000 F par paiement';
    end if;
  end if;
  insert into parametres_app (cle, valeur, maj_le, maj_par) values (c, nullif(trim(coalesce(v, '')), ''), now(), auth.jwt() ->> 'email')
  on conflict (cle) do update set valeur = excluded.valeur, maj_le = now(), maj_par = excluded.maj_par;
  perform journaliser_admin('Réglage modifié', c, left(coalesce(v, '—'), 200));
end $$;
grant execute on function public.admin_parametre(text, text) to authenticated;

-- 3. Revenus du fondateur (paiements en ligne confirmés seulement)
create or replace function public.admin_revenus(du date, au date) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  return json_build_object(
    'total', (select coalesce(sum(frais_service), 0) from payments where status = 'reussi' and frais_service > 0 and created_at::date between du and au),
    'nb', (select count(*) from payments where status = 'reussi' and frais_service > 0 and created_at::date between du and au),
    'volume', (select coalesce(sum(p.amount + p.penalty), 0) from payments p
               where p.status = 'reussi' and p.created_at::date between du and au
                 and p.transaction_id in (select transaction_id from payments where frais_service > 0)),
    'par_jour', coalesce((select json_agg(x order by x.jour) from (
        select created_at::date as jour, sum(frais_service) as montant, count(*) as nb
        from payments where status = 'reussi' and frais_service > 0 and created_at::date between du and au
        group by 1) x), '[]'),
    'par_groupe', coalesce((select json_agg(x order by x.montant desc) from (
        select g.name as groupe, sum(p.frais_service) as montant, count(*) as nb
        from payments p join groups g on g.id = p.group_id
        where p.status = 'reussi' and p.frais_service > 0 and p.created_at::date between du and au
        group by g.name limit 20) x), '[]'),
    'depuis_debut', (select coalesce(sum(frais_service), 0) from payments where status = 'reussi' and frais_service > 0)
  );
end $$;
grant execute on function public.admin_revenus(date, date) to authenticated;

-- 4. Tranches par défaut (modifiables dans /admin → Revenus)
insert into parametres_app (cle, valeur) values
  ('frais_service_actif', 'oui'),
  ('frais_service_tranches', '[{"max":5000,"frais":50},{"max":20000,"frais":100},{"max":50000,"frais":200},{"max":null,"frais":300}]')
on conflict (cle) do nothing;


-- >>>>>>>>>>>>>>>>>>>> migration-24-frais-pourcentage.sql <<<<<<<<<<<<<<<<<<<<
-- =====================================================================
-- COTIZ — MISE À JOUR SQL N°24 : POURCENTAGE EN PLUS DES FRAIS FIXES
-- Le fondateur peut ajouter un pourcentage (0 % à 10 %) aux frais de
-- service Cotiz, en plus des montants fixes par tranche. Réglage dans
-- /admin → Mes revenus.  À lancer APRÈS la n°23.
-- Supabase > SQL Editor > New query > Run
-- =====================================================================
create or replace function public.admin_parametre(c text, v text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  if c not in ('caisse_cotiz_actif', 'caisse_cotiz_lien', 'caisse_cotiz_nom', 'frais_service_actif', 'frais_service_tranches', 'frais_service_pourcent') then
    raise exception 'Réglage inconnu';
  end if;
  if c = 'caisse_cotiz_lien' and coalesce(v, '') <> '' and v !~ '^https://(pay|qr)\.wave\.com/' then
    raise exception 'Le lien doit être un lien Wave (https://pay.wave.com/… ou https://qr.wave.com/…)';
  end if;
  if c = 'frais_service_tranches' then
    -- liste JSON de tranches : [{"max": 5000, "frais": 50}, …, {"max": null, "frais": 300}]
    if jsonb_typeof(v::jsonb) <> 'array' or jsonb_array_length(v::jsonb) not between 1 and 10 then
      raise exception 'Tranches invalides';
    end if;
    if exists (select 1 from jsonb_array_elements(v::jsonb) t
               where (t ->> 'frais')::numeric < 0 or (t ->> 'frais')::numeric > 5000) then
      raise exception 'Frais entre 0 et 5 000 F par paiement';
    end if;
  end if;
  if c = 'frais_service_pourcent' and (coalesce(v, '') !~ '^\d+(\.\d+)?$' or v::numeric > 10) then
    raise exception 'Pourcentage entre 0 et 10 %%';
  end if;
  insert into parametres_app (cle, valeur, maj_le, maj_par) values (c, nullif(trim(coalesce(v, '')), ''), now(), auth.jwt() ->> 'email')
  on conflict (cle) do update set valeur = excluded.valeur, maj_le = now(), maj_par = excluded.maj_par;
  perform journaliser_admin('Réglage modifié', c, left(coalesce(v, '—'), 200));
end $$;
grant execute on function public.admin_parametre(text, text) to authenticated;

insert into parametres_app (cle, valeur) values ('frais_service_pourcent', '0') on conflict (cle) do nothing;


-- >>>>>>>>>>>>>>>>>>>> migration-25-co-fondateur.sql <<<<<<<<<<<<<<<<<<<<
-- =====================================================================
-- COTIZ — MISE À JOUR SQL N°25 : PLUSIEURS FONDATEURS
-- Un fondateur peut nommer un co-fondateur (mêmes pouvoirs), ou le
-- repasser agent. Protections : on ne change pas son propre rôle, et il
-- reste toujours au moins un fondateur.
-- À lancer APRÈS la n°24.  Supabase > SQL Editor > New query > Run
-- =====================================================================
create or replace function public.admin_changer_role(adresse text, nouveau_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  if nouveau_role not in ('fondateur', 'agent') then raise exception 'Rôle invalide'; end if;
  if lower(adresse) = lower(coalesce(auth.jwt() ->> 'email', '')) then
    raise exception 'Tu ne peux pas changer ton propre rôle';
  end if;
  if nouveau_role = 'agent' and (select count(*) from admins where role = 'fondateur') <= 1 then
    raise exception 'Il doit rester au moins un fondateur';
  end if;
  update admins set role = nouveau_role where lower(email) = lower(adresse);
  if not found then raise exception 'Membre de l’équipe introuvable'; end if;
  perform journaliser_admin(case when nouveau_role = 'fondateur' then 'Nommé co-fondateur' else 'Repassé agent' end,
    (select coalesce(nom, email) || ' · ' || coalesce(numero::text, '—') from admins where lower(email) = lower(adresse)));
end $$;
grant execute on function public.admin_changer_role(text, text) to authenticated;


-- >>>>>>>>>>>>>>>>>>>> migration-26-supprimer-compte.sql <<<<<<<<<<<<<<<<<<<<
-- =====================================================================
-- COTIZ — MISE À JOUR SQL N°26 : SUPPRIMER DÉFINITIVEMENT UN COMPTE
-- Réservé au fondateur (un agent envoie un dossier).
-- • Efface : le compte, le profil, le code secret, les notifications,
--   les demandes « code oublié », les requêtes au service client.
-- • Garde : les paiements déjà faits (preuves), sous le nom de la personne,
--   pour que la caisse des groupes reste juste.
-- • Groupes qu'elle a créés : effacés si elle était seule, sinon confiés
--   au trésorier (ou à un autre membre).
-- Différence avec « Bloquer à vie » : après suppression, le numéro peut
-- se réinscrire ; après blocage, il ne peut plus jamais.
-- À lancer APRÈS la n°25.  Supabase > SQL Editor > New query > Run
-- =====================================================================

-- 1. Le fondateur peut confier un groupe à quelqu'un d'autre (contournement contrôlé)
create or replace function public.garde_groupes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_setting('cotiz.admin', true) = 'on' then return new; end if;
  if not public.can_manage(new.id) and (
       new.payment_phone is distinct from old.payment_phone
    or new.wave_link     is distinct from old.wave_link
    or new.add_policy    is distinct from old.add_policy
    or new.current_round is distinct from old.current_round
    or new.created_by    is distinct from old.created_by) then
    raise exception 'Seul le trésorier peut modifier ce réglage';
  end if;
  return new;
end $$;

-- 2. Suppression du compte
create or replace function public.admin_supprimer_compte(p uuid) returns json
language plpgsql security definer set search_path = public as $$
declare pr profiles; g record; repreneur uuid; n_suppr int := 0; n_confies int := 0; n_arch int := 0;
begin
  perform verifier_fondateur();
  select * into pr from profiles where id = p;
  if pr.id is null and not exists (select 1 from auth.users where id = p) then raise exception 'Compte introuvable'; end if;
  if exists (select 1 from auth.users u join admins a on lower(a.email) = lower(u.email) where u.id = p) then
    raise exception 'Ce compte fait partie de l’équipe : retire-le d’abord dans Équipe';
  end if;

  perform journaliser_admin('Compte supprimé définitivement', coalesce(pr.name, '—') || ' · ' || coalesce(pr.phone, '—'));
  perform set_config('cotiz.admin', 'on', true);
  perform set_config('cotiz.rattachement', 'on', true);

  -- Groupes créés par la personne
  for g in select id from groups where created_by = p loop
    select m.profile_id into repreneur from members m
     where m.group_id = g.id and m.profile_id is not null and m.profile_id <> p and not m.archive and not m.en_attente
     order by (m.role = 'tresorier') desc, (m.role = 'gestionnaire') desc, m.turn_position limit 1;
    if repreneur is null then
      delete from payouts where group_id = g.id;
      delete from payments where group_id = g.id;
      delete from groups where id = g.id;
      n_suppr := n_suppr + 1;
    else
      update groups set created_by = repreneur where id = g.id;
      update members set role = 'tresorier' where group_id = g.id and profile_id = repreneur and role <> 'tresorier'
        and not exists (select 1 from members x where x.group_id = g.id and x.role = 'tresorier' and x.profile_id is distinct from p);
      n_confies := n_confies + 1;
    end if;
  end loop;

  -- Ses places dans les groupes : sans paiement → retirées ; avec paiements → gardées (historique) mais archivées
  delete from members m where m.profile_id = p and not exists (select 1 from payments x where x.member_id = m.id);
  update members set archive = true, profile_id = null, role = case when role = 'tresorier' then 'membre' else role end
   where profile_id = p;
  get diagnostics n_arch = row_count;
  update members set invite_par = null where invite_par = p;
  update payments set created_by = null where created_by = p;
  update payouts set created_by = null where created_by = p;

  -- Données personnelles
  delete from codes_historique where profile_id = p;
  delete from codes_secrets where profile_id = p;
  delete from demandes_reinitialisation where profile_id = p;
  delete from notifications where profile_id = p;
  if pr.phone is not null then
    delete from tentatives_connexion where telephone = right(regexp_replace(pr.phone, '\D', '', 'g'), 10);
  end if;
  delete from profiles where id = p;
  delete from auth.users where id = p;

  perform set_config('cotiz.rattachement', 'off', true);
  perform set_config('cotiz.admin', 'off', true);
  return json_build_object('groupes_supprimes', n_suppr, 'groupes_confies', n_confies, 'places_gardees', n_arch);
end $$;
grant execute on function public.admin_supprimer_compte(uuid) to authenticated;

-- 3. Un agent peut demander la suppression par dossier ; le fondateur valide
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
      when 'supprimer_compte' then perform admin_supprimer_compte((x ->> 'profile_id')::uuid);
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
grant execute on function public.admin_dossier_traiter(uuid, boolean, text) to authenticated;


-- >>>>>>>>>>>>>>>>>>>> migration-27-frais-inclus-penalites.sql <<<<<<<<<<<<<<<<<<<<
-- =====================================================================
-- COTIZ — MISE À JOUR SQL N°27 : FRAIS INCLUS DANS LE PAIEMENT
--                                ET PART DE COTIZ SUR LES PÉNALITÉS
-- • Paiement en ligne : le membre paie cotisation + tous les frais
--   (service Cotiz + opérateur) ; la caisse du groupe reçoit la cotisation
--   entière. Les frais ne sont visibles que sur le reçu.
-- • Pénalités payées en ligne : une part (réglable, 50 % par défaut) revient
--   à Cotiz, le reste au groupe.  Réglage : /admin → Mes revenus.
-- À lancer APRÈS la n°26.  Supabase > SQL Editor > New query > Run
-- =====================================================================
alter table public.payments add column if not exists frais_operateur integer not null default 0;
alter table public.payments add column if not exists penalite_cotiz integer not null default 0;

create or replace function public.admin_parametre(c text, v text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  if c not in ('caisse_cotiz_actif', 'caisse_cotiz_lien', 'caisse_cotiz_nom', 'frais_service_actif', 'frais_service_tranches', 'frais_service_pourcent', 'frais_service_part_penalite') then
    raise exception 'Réglage inconnu';
  end if;
  if c = 'caisse_cotiz_lien' and coalesce(v, '') <> '' and v !~ '^https://(pay|qr)\.wave\.com/' then
    raise exception 'Le lien doit être un lien Wave (https://pay.wave.com/… ou https://qr.wave.com/…)';
  end if;
  if c = 'frais_service_tranches' then
    -- liste JSON de tranches : [{"max": 5000, "frais": 50}, …, {"max": null, "frais": 300}]
    if jsonb_typeof(v::jsonb) <> 'array' or jsonb_array_length(v::jsonb) not between 1 and 10 then
      raise exception 'Tranches invalides';
    end if;
    if exists (select 1 from jsonb_array_elements(v::jsonb) t
               where (t ->> 'frais')::numeric < 0 or (t ->> 'frais')::numeric > 5000) then
      raise exception 'Frais entre 0 et 5 000 F par paiement';
    end if;
  end if;
  if c = 'frais_service_pourcent' and (coalesce(v, '') !~ '^\d+(\.\d+)?$' or v::numeric > 10) then
    raise exception 'Pourcentage entre 0 et 10 %%';
  end if;
  if c = 'frais_service_part_penalite' and (coalesce(v, '') !~ '^\d+$' or v::int > 100) then
    raise exception 'Part des pénalités entre 0 et 100 %%';
  end if;
  insert into parametres_app (cle, valeur, maj_le, maj_par) values (c, nullif(trim(coalesce(v, '')), ''), now(), auth.jwt() ->> 'email')
  on conflict (cle) do update set valeur = excluded.valeur, maj_le = now(), maj_par = excluded.maj_par;
  perform journaliser_admin('Réglage modifié', c, left(coalesce(v, '—'), 200));
end $$;
grant execute on function public.admin_parametre(text, text) to authenticated;

insert into parametres_app (cle, valeur) values ('frais_service_part_penalite', '50') on conflict (cle) do nothing;

-- Revenus : frais de service + part des pénalités
create or replace function public.admin_revenus(du date, au date) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  return json_build_object(
    'total', (select coalesce(sum(frais_service + penalite_cotiz), 0) from payments where status = 'reussi' and created_at::date between du and au),
    'frais', (select coalesce(sum(frais_service), 0) from payments where status = 'reussi' and created_at::date between du and au),
    'penalites', (select coalesce(sum(penalite_cotiz), 0) from payments where status = 'reussi' and created_at::date between du and au),
    'nb', (select count(*) from payments where status = 'reussi' and frais_service > 0 and created_at::date between du and au),
    'volume', (select coalesce(sum(p.amount + p.penalty), 0) from payments p
               where p.status = 'reussi' and p.created_at::date between du and au
                 and p.transaction_id in (select transaction_id from payments where frais_service > 0 or penalite_cotiz > 0)),
    'par_jour', coalesce((select json_agg(x order by x.jour) from (
        select created_at::date as jour, sum(frais_service + penalite_cotiz) as montant, count(*) filter (where frais_service > 0) as nb
        from payments where status = 'reussi' and (frais_service > 0 or penalite_cotiz > 0) and created_at::date between du and au
        group by 1) x), '[]'),
    'par_groupe', coalesce((select json_agg(x order by x.montant desc) from (
        select g.name as groupe, sum(p.frais_service + p.penalite_cotiz) as montant, count(*) filter (where p.frais_service > 0) as nb
        from payments p join groups g on g.id = p.group_id
        where p.status = 'reussi' and (p.frais_service > 0 or p.penalite_cotiz > 0) and p.created_at::date between du and au
        group by g.name limit 20) x), '[]'),
    'depuis_debut', (select coalesce(sum(frais_service + penalite_cotiz), 0) from payments where status = 'reussi')
  );
end $$;
grant execute on function public.admin_revenus(date, date) to authenticated;


-- >>>>>>>>>>>>>>>>>>>> migration-28-penalites-tranches.sql <<<<<<<<<<<<<<<<<<<<
-- =====================================================================
-- COTIZ — MISE À JOUR SQL N°28 : PART DES PÉNALITÉS PAR TRANCHES
-- Le fondateur règle la part de Cotiz selon le montant de la pénalité
-- (ex. moins de 1 000 F → 50 %, de 1 000 à 5 000 F → 60 %, au-delà → 70 %).
-- Réglage : /admin → Mes revenus.  À lancer APRÈS la n°27.
-- =====================================================================
create or replace function public.admin_parametre(c text, v text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  if c not in ('caisse_cotiz_actif', 'caisse_cotiz_lien', 'caisse_cotiz_nom', 'frais_service_actif', 'frais_service_tranches', 'frais_service_pourcent', 'frais_service_part_penalite', 'frais_service_penalite_tranches') then
    raise exception 'Réglage inconnu';
  end if;
  if c = 'caisse_cotiz_lien' and coalesce(v, '') <> '' and v !~ '^https://(pay|qr)\.wave\.com/' then
    raise exception 'Le lien doit être un lien Wave (https://pay.wave.com/… ou https://qr.wave.com/…)';
  end if;
  if c = 'frais_service_tranches' then
    -- liste JSON de tranches : [{"max": 5000, "frais": 50}, …, {"max": null, "frais": 300}]
    if jsonb_typeof(v::jsonb) <> 'array' or jsonb_array_length(v::jsonb) not between 1 and 10 then
      raise exception 'Tranches invalides';
    end if;
    if exists (select 1 from jsonb_array_elements(v::jsonb) t
               where (t ->> 'frais')::numeric < 0 or (t ->> 'frais')::numeric > 5000) then
      raise exception 'Frais entre 0 et 5 000 F par paiement';
    end if;
  end if;
  if c = 'frais_service_pourcent' and (coalesce(v, '') !~ '^\d+(\.\d+)?$' or v::numeric > 10) then
    raise exception 'Pourcentage entre 0 et 10 %%';
  end if;
  if c = 'frais_service_part_penalite' and (coalesce(v, '') !~ '^\d+$' or v::int > 100) then
    raise exception 'Part des pénalités entre 0 et 100 %%';
  end if;
  if c = 'frais_service_penalite_tranches' then
    -- liste JSON : [{"max": 1000, "part": 50}, …, {"max": null, "part": 70}]
    if jsonb_typeof(v::jsonb) <> 'array' or jsonb_array_length(v::jsonb) not between 1 and 10 then
      raise exception 'Tranches de pénalités invalides';
    end if;
    if exists (select 1 from jsonb_array_elements(v::jsonb) t where (t ->> 'part')::numeric < 0 or (t ->> 'part')::numeric > 100) then
      raise exception 'Part des pénalités entre 0 et 100 %%';
    end if;
  end if;
  insert into parametres_app (cle, valeur, maj_le, maj_par) values (c, nullif(trim(coalesce(v, '')), ''), now(), auth.jwt() ->> 'email')
  on conflict (cle) do update set valeur = excluded.valeur, maj_le = now(), maj_par = excluded.maj_par;
  perform journaliser_admin('Réglage modifié', c, left(coalesce(v, '—'), 200));
end $$;
grant execute on function public.admin_parametre(text, text) to authenticated;


-- >>>>>>>>>>>>>>>>>>>> migration-29-offre-penalites.sql <<<<<<<<<<<<<<<<<<<<
-- =====================================================================
-- COTIZ — MISE À JOUR SQL N°29 : OFFRE SPÉCIALE SUR LES PÉNALITÉS
-- Le fondateur lance une offre pour 1, 2 ou 3 mois : une part différente
-- pour Cotiz sur les pénalités pendant cette période. Une annonce est créée
-- automatiquement dans le carrousel de l'accueil (elle disparaît seule à la
-- fin), et tous les inscrits peuvent être prévenus par notification.
-- À la fin de la période, la part habituelle revient toute seule.
-- À lancer APRÈS la n°28.  Supabase > SQL Editor > New query > Run
-- =====================================================================
create or replace function public.admin_offre_penalite(part integer, mois integer, publier boolean default true, notifier boolean default false) returns json
language plpgsql security definer set search_path = public as $$
declare fin timestamptz; ann uuid; groupe integer; n integer := 0; jour text;
begin
  perform verifier_fondateur();
  if part < 0 or part > 100 then raise exception 'Part entre 0 et 100 %%'; end if;
  if mois not between 1 and 12 then raise exception 'Durée entre 1 et 12 mois'; end if;
  fin := date_trunc('day', now() + make_interval(months => mois)) + interval '23 hours 59 minutes';
  groupe := 100 - part;
  jour := to_char(fin, 'DD/MM/YYYY');

  -- l'ancienne annonce d'offre est retirée
  update annonces set actif = false where id::text = (select valeur from parametres_app where cle = 'frais_service_promo_annonce');

  if publier then
    insert into annonces (titre, texte, lien, bouton, couleur, actif, ordre, debut, fin)
    values ('Offre spéciale : ' || groupe || ' % des pénalités pour votre groupe',
            'Jusqu’au ' || jour || ', ' || groupe || ' % des pénalités payées en ligne restent dans la caisse de votre groupe.',
            null, null, 'orange', true, 0, now(), fin)
    returning id into ann;
  end if;

  if notifier then
    insert into notifications (profile_id, type, titre, texte, lien)
    select id, 'offre', 'Offre spéciale sur les pénalités 🎉',
           'Jusqu’au ' || jour || ', ' || groupe || ' % des pénalités payées en ligne restent dans la caisse de votre groupe.', '/groupes'
    from profiles where not coalesce(bloque, false);
    get diagnostics n = row_count;
  end if;

  insert into parametres_app (cle, valeur, maj_le, maj_par) values
    ('frais_service_promo_part', part::text, now(), auth.jwt() ->> 'email'),
    ('frais_service_promo_fin', fin::text, now(), auth.jwt() ->> 'email'),
    ('frais_service_promo_annonce', coalesce(ann::text, ''), now(), auth.jwt() ->> 'email')
  on conflict (cle) do update set valeur = excluded.valeur, maj_le = now(), maj_par = excluded.maj_par;

  perform journaliser_admin('Offre pénalités lancée', part || ' % Cotiz / ' || groupe || ' % groupe', 'jusqu’au ' || jour || case when n > 0 then ' · ' || n || ' notifications' else '' end);
  return json_build_object('fin', fin, 'annonce', ann, 'notifications', n);
end $$;

create or replace function public.admin_offre_penalite_arreter() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  update annonces set actif = false where id::text = (select valeur from parametres_app where cle = 'frais_service_promo_annonce');
  update parametres_app set valeur = null, maj_le = now(), maj_par = auth.jwt() ->> 'email'
   where cle in ('frais_service_promo_fin', 'frais_service_promo_annonce');
  perform journaliser_admin('Offre pénalités arrêtée', null);
end $$;

grant execute on function public.admin_offre_penalite(integer, integer, boolean, boolean), public.admin_offre_penalite_arreter() to authenticated;
