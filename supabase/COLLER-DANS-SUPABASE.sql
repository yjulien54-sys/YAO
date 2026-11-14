-- =====================================================================
-- COTIZ — FICHIER UNIQUE À COLLER DANS SUPABASE (mises à jour 15 à 37)
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

-- =====================================================================
-- COTIZ — MISE À JOUR n°30 : rapidité quand il y aura beaucoup d'utilisateurs
-- Supabase > SQL Editor > New query > coller TOUT > Run  →  « Success »
-- Relançable sans danger. Ne change rien à qui voit quoi : chacun voit
-- exactement les mêmes groupes, membres et paiements qu'avant.
-- Avant : pour ouvrir l'accueil, la base passait en revue TOUS les groupes
-- de Cotiz. Maintenant : elle va directement aux groupes de la personne.
-- Test (500 000 comptes, 6 millions de paiements) : environ 35 fois plus rapide.
-- =====================================================================

-- Mes groupes (place validée, compte non bloqué) : mêmes conditions que is_member()
create or replace function public.mes_groupes() returns setof uuid
language sql security definer stable set search_path = public as $$
  select group_id from members
  where profile_id = auth.uid() and not en_attente
    and not exists (select 1 from profiles where id = auth.uid() and bloque)
$$;
revoke all on function public.mes_groupes() from public, anon;
grant execute on function public.mes_groupes() to authenticated;

create index if not exists groups_created_by_idx on public.groups (created_by);

drop policy if exists "groupe: lecture" on public.groups;
create policy "groupe: lecture" on public.groups for select
  using (created_by = (select auth.uid()) or id = any (array(select public.mes_groupes())));

drop policy if exists "paiements: lecture" on public.payments;
create policy "paiements: lecture" on public.payments for select
  using (group_id = any (array(select public.mes_groupes())));

drop policy if exists "versements: lecture" on public.payouts;
create policy "versements: lecture" on public.payouts for select
  using (group_id = any (array(select public.mes_groupes())));

drop policy if exists "engagements: lecture" on public.engagements;
create policy "engagements: lecture" on public.engagements for select
  using (group_id = any (array(select public.mes_groupes())));

-- Le « JIT » de Postgres peut faire perdre jusqu'à 0,4 s sur ces petites requêtes
do $$ begin
  execute 'alter role authenticated set jit = off';
  execute 'alter role anon set jit = off';
exception when others then raise notice 'JIT : réglage ignoré (%), sans gravité', sqlerrm;
end $$;

-- Vérification : doit afficher 4 lignes
select tablename, policyname from pg_policies
where policyname in ('groupe: lecture', 'paiements: lecture', 'versements: lecture', 'engagements: lecture');

-- =====================================================================
-- COTIZ — MISE À JOUR n°31 : SANTÉ DE L'APPLICATION (onglet admin)
-- Compte, sans rien de personnel visible, combien de personnes ouvrent
-- l'application chaque jour et à quelle heure, pour suivre la charge.
-- Supabase > SQL Editor > New query > coller TOUT > Run  →  « Success »
-- Relançable sans danger. À lancer APRÈS la n°30.
-- =====================================================================

-- Une ligne par personne et par jour où elle a ouvert l'application
create table if not exists public.actifs_jour (
  jour date not null default current_date,
  profile_id uuid not null references auth.users on delete cascade,
  primary key (jour, profile_id)
);
-- Nombre d'ouvertures de l'application, heure par heure
create table if not exists public.visites_heure (
  heure timestamptz primary key,
  ouvertures integer not null default 0
);
alter table public.actifs_jour enable row level security;
alter table public.visites_heure enable row level security;
-- (aucune règle de lecture : on n'y accède que par les fonctions ci-dessous)

-- Appelée par l'application à chaque ouverture
create or replace function public.je_suis_la() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  insert into actifs_jour (jour, profile_id) values (current_date, auth.uid())
  on conflict do nothing;
  insert into visites_heure (heure, ouvertures) values (date_trunc('hour', now()), 1)
  on conflict (heure) do update set ouvertures = visites_heure.ouvertures + 1;
end $$;
revoke all on function public.je_suis_la() from public, anon;
grant execute on function public.je_suis_la() to authenticated;

-- Limites de ta formule Supabase (réglables dans l'onglet « Santé »)
create or replace function public.admin_capacite(db_mo integer, mau integer) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  if db_mo < 100 or db_mo > 10000000 or mau < 1000 or mau > 100000000 then raise exception 'Valeurs hors limites'; end if;
  insert into parametres_app (cle, valeur, maj_le, maj_par) values
    ('capacite_db_mo', db_mo::text, now(), auth.jwt() ->> 'email'),
    ('capacite_mau', mau::text, now(), auth.jwt() ->> 'email')
  on conflict (cle) do update set valeur = excluded.valeur, maj_le = now(), maj_par = excluded.maj_par;
  perform journaliser_admin('Réglage modifié', 'capacité', db_mo || ' Mo · ' || mau || ' comptes actifs');
end $$;
grant execute on function public.admin_capacite(integer, integer) to authenticated;

-- On garde 13 mois d'historique (le reste est effacé à chaque lecture de l'onglet, sans rien de personnel)
create or replace function public.purger_sante() returns void
language sql security definer set search_path = public as $$
  delete from actifs_jour where jour < current_date - 400;
  delete from visites_heure where heure < now() - interval '400 days';
$$;
revoke all on function public.purger_sante() from public, anon, authenticated;

-- Tout ce que montre l'onglet « Santé de l'appli »
create or replace function public.admin_sante() returns json
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  perform purger_sante();
  return json_build_object(
    'inscrits', (select count(*) from profiles),
    'actifs_jour', (select count(*) from actifs_jour where jour = current_date),
    'actifs_7j', (select count(distinct profile_id) from actifs_jour where jour > current_date - 7),
    'actifs_30j', (select count(distinct profile_id) from actifs_jour where jour > current_date - 30),
    'par_jour', (select coalesce(json_agg(json_build_object('jour', d::date, 'n', coalesce(a.n, 0)) order by d), '[]')
                 from generate_series(current_date - 29, current_date, interval '1 day') d
                 left join (select jour, count(*) n from actifs_jour where jour > current_date - 30 group by jour) a on a.jour = d::date),
    'par_heure', (select coalesce(json_agg(json_build_object('heure', h, 'n', coalesce(v.ouvertures, 0)) order by h), '[]')
                  from generate_series(date_trunc('hour', now()) - interval '47 hours', date_trunc('hour', now()), interval '1 hour') h
                  left join visites_heure v on v.heure = h),
    'pic_heure', (select coalesce(max(ouvertures), 0) from visites_heure where heure > now() - interval '30 days'),
    'pic_le', (select heure from visites_heure where heure > now() - interval '30 days' order by ouvertures desc limit 1),
    'moments', (select json_build_object(
                  'nuit', coalesce(sum(ouvertures) filter (where extract(hour from heure at time zone 'Africa/Abidjan') < 6), 0),
                  'matin', coalesce(sum(ouvertures) filter (where extract(hour from heure at time zone 'Africa/Abidjan') between 6 and 11), 0),
                  'apres_midi', coalesce(sum(ouvertures) filter (where extract(hour from heure at time zone 'Africa/Abidjan') between 12 and 17), 0),
                  'soir', coalesce(sum(ouvertures) filter (where extract(hour from heure at time zone 'Africa/Abidjan') >= 18), 0))
                from visites_heure where heure > now() - interval '30 days'),
    'taille_mo', round(pg_database_size(current_database()) / 1048576.0),
    'groupes', (select count(*) from groups),
    'paiements', (select count(*) from payments),
    'capacite_db_mo', coalesce((select valeur::int from parametres_app where cle = 'capacite_db_mo'), 500),
    'capacite_mau', coalesce((select valeur::int from parametres_app where cle = 'capacite_mau'), 50000)
  );
end $$;
grant execute on function public.admin_sante() to authenticated;

-- =====================================================================
-- COTIZ — MISE À JOUR n°32 : PERSONNES À RELANCER + IDÉES & PROJETS
-- • Voir les inscriptions inachevées (numéro saisi, mais compte pas terminé)
--   pour rappeler les personnes.
-- • Voir qui est actif (aujourd'hui, 7 jours, 30 jours).
-- • Suivre l'avancement des idées pour attirer plus de monde.
-- Supabase > SQL Editor > New query > coller TOUT > Run  →  « Success »
-- Relançable sans danger. À lancer APRÈS la n°31.
-- =====================================================================

-- Tentatives d'inscription : enregistrées dès que la personne tape son nom et son numéro,
-- pour pouvoir la rappeler si elle n'arrive pas au bout (SMS non reçu, code refusé…)
create table if not exists public.tentatives_inscription (
  telephone text primary key,
  nom text,
  etape text not null default 'formulaire',
  erreur text,
  nb integer not null default 1,
  premier timestamptz not null default now(),
  dernier timestamptz not null default now()
);
alter table public.tentatives_inscription enable row level security;
-- (aucune règle de lecture : seul l'admin y accède, par la fonction ci-dessous)

create or replace function public.noter_tentative(tel text, nom text, etape text, erreur text default null) returns void
language plpgsql security definer set search_path = public as $$
declare t text := right(regexp_replace(coalesce(tel, ''), '\D', '', 'g'), 10);
begin
  if length(t) <> 10 then return; end if;
  if etape not in ('formulaire', 'code_envoye', 'erreur_envoi', 'code_refuse', 'terminee', 'erreur') then return; end if;
  insert into tentatives_inscription (telephone, nom, etape, erreur)
  values (t, left(nullif(trim(nom), ''), 80), etape, left(erreur, 300))
  on conflict (telephone) do update set
    nom = coalesce(excluded.nom, tentatives_inscription.nom),
    etape = excluded.etape,
    erreur = excluded.erreur,
    nb = least(tentatives_inscription.nb + 1, 100000),
    dernier = now();
end $$;
revoke all on function public.noter_tentative(text, text, text, text) from public;
grant execute on function public.noter_tentative(text, text, text, text) to anon, authenticated;

-- Inscriptions inachevées : tentatives sans compte terminé, plus les comptes créés sans nom
drop function if exists public.admin_inscriptions_inachevees();
create or replace function public.admin_inscriptions_inachevees() returns table (
  telephone text, nom text, etape text, erreur text, nb integer, premier timestamptz, dernier timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_admin();
  perform purger_tentatives();
  return query
    select x.telephone, x.nom, x.etape, x.erreur, x.nb, x.premier, x.dernier from (
      select t.telephone, t.nom, t.etape, t.erreur, t.nb, t.premier, t.dernier
      from tentatives_inscription t
      where t.etape <> 'terminee'
        and not exists (select 1 from profiles p where right(regexp_replace(p.phone, '\D', '', 'g'), 10) = t.telephone)
      union all
      select right(regexp_replace(u.phone, '\D', '', 'g'), 10), null::text,
             case when u.phone_confirmed_at is null then 'code_envoye' else 'profil_vide' end, null::text, 1, u.created_at, coalesce(u.last_sign_in_at, u.created_at)
      from auth.users u
      where coalesce(u.phone, '') <> '' and coalesce(u.is_anonymous, false) = false
        and not exists (select 1 from profiles p where p.id = u.id)
        and not exists (select 1 from tentatives_inscription t where t.telephone = right(regexp_replace(u.phone, '\D', '', 'g'), 10))
    ) x
    order by x.dernier desc
    limit 500;
end $$;
grant execute on function public.admin_inscriptions_inachevees() to authenticated;

-- Ménage : tentatives de plus de 6 mois effacées
create or replace function public.purger_tentatives() returns void
language sql security definer set search_path = public as $$
  delete from tentatives_inscription where dernier < now() - interval '180 days';
$$;
revoke all on function public.purger_tentatives() from public, anon, authenticated;

-- Personnes actives sur les N derniers jours (onglet Santé)
create or replace function public.admin_actifs(jours integer) returns table (
  id uuid, nom text, telephone text, dernier_jour date, nb_jours bigint
)
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  return query
    select p.id, p.name, p.phone, max(a.jour), count(*)
    from actifs_jour a join profiles p on p.id = a.profile_id
    where a.jour > current_date - greatest(1, least(jours, 400))
    group by p.id, p.name, p.phone
    order by max(a.jour) desc, count(*) desc
    limit 1000;
end $$;
grant execute on function public.admin_actifs(integer) to authenticated;

-- Idées & projets : avancement enregistré en JSON {"cagnottes": "en_cours", …}
create or replace function public.admin_feuille_route_lire() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_admin();
  return coalesce((select valeur::jsonb from parametres_app where cle = 'feuille_route'), '{}'::jsonb);
end $$;
grant execute on function public.admin_feuille_route_lire() to authenticated;

create or replace function public.admin_feuille_route(v jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  if jsonb_typeof(v) <> 'object' or length(v::text) > 5000 then raise exception 'Format invalide'; end if;
  insert into parametres_app (cle, valeur, maj_le, maj_par) values ('feuille_route', v::text, now(), auth.jwt() ->> 'email')
  on conflict (cle) do update set valeur = excluded.valeur, maj_le = now(), maj_par = excluded.maj_par;
end $$;
grant execute on function public.admin_feuille_route(jsonb) to authenticated;

-- =====================================================================
-- COTIZ — MISE À JOUR n°33 : SERVICE CLIENT EN CONVERSATION
-- Une requête devient un fil de discussion : le client et l'agent s'écrivent
-- dans le même fil tant que l'agent ne l'a pas fermé (plus besoin de refaire
-- une nouvelle requête pour donner une information demandée).
-- Les anciennes requêtes et réponses sont reprises dans leur fil.
-- Supabase > SQL Editor > New query > coller TOUT > Run  →  « Success »
-- Relançable sans danger. À lancer APRÈS la n°18 (et de préférence la n°32).
-- =====================================================================

create table if not exists public.requetes_messages (
  id uuid primary key default gen_random_uuid(),
  requete_id uuid not null references public.requetes_clients on delete cascade,
  cree_le timestamptz not null default now(),
  auteur text not null check (auteur in ('client', 'agent')),
  agent_email text,
  texte text not null check (length(texte) between 1 and 2000)
);
create index if not exists requetes_messages_fil_idx on public.requetes_messages (requete_id, cree_le);
alter table public.requetes_messages enable row level security;

-- Le client lit les messages de SES requêtes ; il écrit seulement par la fonction requete_ecrire()
drop policy if exists "messages: lire les miens" on public.requetes_messages;
create policy "messages: lire les miens" on public.requetes_messages for select
  using (exists (select 1 from requetes_clients r where r.id = requete_id and r.profile_id = auth.uid()));
grant select on public.requetes_messages to authenticated;

-- Qui a écrit en dernier (pour afficher « nouveau message du client » côté agent)
alter table public.requetes_clients add column if not exists dernier_auteur text default 'client';
alter table public.requetes_clients add column if not exists nb_messages integer not null default 1;

-- Reprise des anciennes requêtes : le message du client, puis la réponse de l'agent
insert into requetes_messages (requete_id, cree_le, auteur, texte)
select r.id, r.cree_le, 'client', r.message from requetes_clients r
where not exists (select 1 from requetes_messages m where m.requete_id = r.id);
insert into requetes_messages (requete_id, cree_le, auteur, agent_email, texte)
select r.id, greatest(r.maj_le, r.cree_le + interval '1 second'), 'agent', r.agent_email, r.reponse from requetes_clients r
where r.reponse is not null and not exists (select 1 from requetes_messages m where m.requete_id = r.id and m.auteur = 'agent');
update requetes_clients r set
  nb_messages = (select count(*) from requetes_messages m where m.requete_id = r.id),
  dernier_auteur = coalesce((select m.auteur from requetes_messages m where m.requete_id = r.id order by m.cree_le desc limit 1), 'client');

-- Une nouvelle requête crée aussi le 1er message de son fil
create or replace function public.requete_premier_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into requetes_messages (requete_id, cree_le, auteur, texte) values (new.id, new.cree_le, 'client', new.message);
  return new;
end $$;
drop trigger if exists requete_premier_message on public.requetes_clients;
create trigger requete_premier_message after insert on public.requetes_clients for each row execute function public.requete_premier_message();

-- Le client répond dans le même fil (tant que la conversation n'est pas fermée)
create or replace function public.requete_ecrire(r uuid, texte text) returns void
language plpgsql security definer set search_path = public as $$
declare q requetes_clients;
begin
  select * into q from requetes_clients where id = r and profile_id = auth.uid();
  if q.id is null then raise exception 'Conversation introuvable'; end if;
  if q.statut = 'resolue' then raise exception 'Cette conversation est fermée. Écris un nouveau message au service client.'; end if;
  if length(trim(coalesce(texte, ''))) < 1 then raise exception 'Écris ton message'; end if;
  -- 20 messages maximum par heure et par personne
  if (select count(*) from requetes_messages m join requetes_clients c on c.id = m.requete_id
      where c.profile_id = auth.uid() and m.auteur = 'client' and m.cree_le > now() - interval '1 hour') >= 20 then
    raise exception 'Tu as envoyé beaucoup de messages. L''agent te répond bientôt.';
  end if;
  insert into requetes_messages (requete_id, auteur, texte) values (r, 'client', left(trim(texte), 2000));
  update requetes_clients set dernier_auteur = 'client', nb_messages = nb_messages + 1, maj_le = now() where id = r;
end $$;
revoke all on function public.requete_ecrire(uuid, text) from public, anon;
grant execute on function public.requete_ecrire(uuid, text) to authenticated;

-- L'agent lit le fil
create or replace function public.admin_requete_messages(r uuid) returns setof public.requetes_messages
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_admin();
  return query select * from requetes_messages where requete_id = r order by cree_le;
end $$;
grant execute on function public.admin_requete_messages(uuid) to authenticated;

-- L'agent répond dans le fil ; « resoudre » ferme la conversation
create or replace function public.admin_requete_repondre(r uuid, texte text, resoudre boolean default true) returns void
language plpgsql security definer set search_path = public as $$
declare q requetes_clients;
begin
  perform verifier_admin();
  if length(trim(coalesce(texte, ''))) < 2 then raise exception 'Écris une réponse'; end if;
  if not exists (select 1 from requetes_clients where id = r) then raise exception 'Requête introuvable'; end if;
  insert into requetes_messages (requete_id, auteur, agent_email, texte) values (r, 'agent', auth.jwt() ->> 'email', left(trim(texte), 2000));
  update requetes_clients set reponse = trim(texte), agent_email = coalesce(agent_email, auth.jwt() ->> 'email'),
    statut = case when resoudre then 'resolue' else 'en_cours' end, dernier_auteur = 'agent', nb_messages = nb_messages + 1, maj_le = now()
  where id = r returning * into q;
  if q.id is null then raise exception 'Requête introuvable'; end if;
  insert into notifications (profile_id, type, titre, texte, lien)
  values (q.profile_id, 'service_client', case when resoudre then 'Le service client a répondu (conversation fermée)' else 'Nouveau message du service client' end,
          left(trim(texte), 300), '/aide#mes-requetes');
end $$;

-- Fermer ou rouvrir une conversation sans écrire
create or replace function public.admin_requete_fermer(r uuid, fermer boolean default true) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_admin();
  update requetes_clients set statut = case when fermer then 'resolue' else 'en_cours' end,
    agent_email = coalesce(agent_email, auth.jwt() ->> 'email'), maj_le = now()
  where id = r;
end $$;
grant execute on function public.admin_requete_fermer(uuid, boolean) to authenticated;

-- Liste des requêtes : celles où le client a écrit en dernier remontent en haut
create or replace function public.admin_requetes() returns setof public.requetes_clients
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_admin();
  return query select * from requetes_clients
  order by (statut = 'resolue'), (dernier_auteur = 'agent'), (statut = 'en_cours'), maj_le desc limit 500;
end $$;

-- =====================================================================
-- COTIZ — MISE À JOUR n°34 : AVIS DES CLIENTS ET QUALITÉ DU SERVICE CLIENT
-- • À la fin de chaque conversation, le client donne une note (1 à 5 étoiles)
--   et un commentaire. S'il n'est pas satisfait (1 ou 2 étoiles), il peut
--   rouvrir la conversation.
-- • On garde la trace : qui a fermé, quand, délai de la 1re réponse.
-- • Le fondateur voit un tableau de qualité par agent.
-- Supabase > SQL Editor > New query > coller TOUT > Run  →  « Success »
-- Relançable sans danger. À lancer APRÈS la n°33.
-- =====================================================================

alter table public.requetes_clients add column if not exists premiere_reponse_le timestamptz;
alter table public.requetes_clients add column if not exists fermee_le timestamptz;
alter table public.requetes_clients add column if not exists fermee_par text;
alter table public.requetes_clients add column if not exists note smallint check (note between 1 and 5);
alter table public.requetes_clients add column if not exists avis text;
alter table public.requetes_clients add column if not exists avis_le timestamptz;
alter table public.requetes_clients add column if not exists rouverte_par_client integer not null default 0;

-- Reprise de l'historique
update requetes_clients r set premiere_reponse_le = (select min(m.cree_le) from requetes_messages m where m.requete_id = r.id and m.auteur = 'agent')
where premiere_reponse_le is null;
update requetes_clients set fermee_le = maj_le, fermee_par = agent_email where statut = 'resolue' and fermee_le is null;

-- L'agent répond (même chose qu'avant + traçabilité)
create or replace function public.admin_requete_repondre(r uuid, texte text, resoudre boolean default true) returns void
language plpgsql security definer set search_path = public as $$
declare q requetes_clients;
begin
  perform verifier_admin();
  if length(trim(coalesce(texte, ''))) < 2 then raise exception 'Écris une réponse'; end if;
  if not exists (select 1 from requetes_clients where id = r) then raise exception 'Requête introuvable'; end if;
  insert into requetes_messages (requete_id, auteur, agent_email, texte) values (r, 'agent', auth.jwt() ->> 'email', left(trim(texte), 2000));
  update requetes_clients set reponse = trim(texte), agent_email = coalesce(agent_email, auth.jwt() ->> 'email'),
    statut = case when resoudre then 'resolue' else 'en_cours' end, dernier_auteur = 'agent', nb_messages = nb_messages + 1, maj_le = now(),
    premiere_reponse_le = coalesce(premiere_reponse_le, now()),
    fermee_le = case when resoudre then now() else null end,
    fermee_par = case when resoudre then auth.jwt() ->> 'email' else null end
  where id = r returning * into q;
  insert into notifications (profile_id, type, titre, texte, lien)
  values (q.profile_id, 'service_client', case when resoudre then 'Le service client a répondu : donne ton avis' else 'Nouveau message du service client' end,
          left(trim(texte), 300), '/aide#mes-requetes');
end $$;

create or replace function public.admin_requete_fermer(r uuid, fermer boolean default true) returns void
language plpgsql security definer set search_path = public as $$
declare q requetes_clients;
begin
  perform verifier_admin();
  update requetes_clients set statut = case when fermer then 'resolue' else 'en_cours' end,
    agent_email = coalesce(agent_email, auth.jwt() ->> 'email'), maj_le = now(),
    fermee_le = case when fermer then now() else null end,
    fermee_par = case when fermer then auth.jwt() ->> 'email' else null end
  where id = r returning * into q;
  if fermer and q.id is not null then
    insert into notifications (profile_id, type, titre, texte, lien)
    values (q.profile_id, 'service_client', 'Conversation fermée : donne ton avis', 'Dis-nous comment le service client t''a aidé.', '/aide#mes-requetes');
  end if;
  perform journaliser_admin(case when fermer then 'Conversation fermée' else 'Conversation rouverte' end, 'requête n°' || q.numero, null);
end $$;

-- Le client note la conversation (une fois, modifiable pendant 7 jours) ; 1 ou 2 étoiles : il peut la rouvrir
create or replace function public.requete_noter(r uuid, note integer, commentaire text default null, rouvrir boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare q requetes_clients;
begin
  select * into q from requetes_clients where id = r and profile_id = auth.uid();
  if q.id is null then raise exception 'Conversation introuvable'; end if;
  if q.statut <> 'resolue' then raise exception 'Tu pourras donner ton avis quand la conversation sera fermée.'; end if;
  if note not between 1 and 5 then raise exception 'Choisis entre 1 et 5 étoiles'; end if;
  if q.avis_le is not null and q.avis_le < now() - interval '7 days' then raise exception 'Le délai pour modifier ton avis est passé.'; end if;
  update requetes_clients set note = requete_noter.note, avis = left(nullif(trim(commentaire), ''), 500), avis_le = now() where id = r;
  if rouvrir and requete_noter.note <= 2 then
    if q.rouverte_par_client >= 2 then raise exception 'Cette conversation a déjà été rouverte 2 fois. Écris un nouveau message.'; end if;
    insert into requetes_messages (requete_id, auteur, texte)
    values (r, 'client', 'Je ne suis pas satisfait (' || requete_noter.note || '/5)' || coalesce(' : ' || left(nullif(trim(commentaire), ''), 500), '.') || ' Je rouvre la conversation.');
    update requetes_clients set statut = 'en_cours', dernier_auteur = 'client', nb_messages = nb_messages + 1, maj_le = now(),
      fermee_le = null, fermee_par = null, rouverte_par_client = rouverte_par_client + 1 where id = r;
  end if;
end $$;
revoke all on function public.requete_noter(uuid, integer, text, boolean) from public, anon;
grant execute on function public.requete_noter(uuid, integer, text, boolean) to authenticated;

-- Tableau de qualité (fondateur) : par agent, sur une période
create or replace function public.admin_qualite(du date, au date) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  return json_build_object(
    'non_finalisees', (select count(*) from requetes_clients where statut <> 'resolue'),
    'finalisees', (select count(*) from requetes_clients where statut = 'resolue' and fermee_le::date between du and au),
    'notes', (select json_build_object('n', count(note), 'moyenne', round(avg(note)::numeric, 2),
                'n1', count(*) filter (where note = 1), 'n2', count(*) filter (where note = 2), 'n3', count(*) filter (where note = 3),
                'n4', count(*) filter (where note = 4), 'n5', count(*) filter (where note = 5))
              from requetes_clients where avis_le::date between du and au),
    'delai_reponse_min', (select round(avg(extract(epoch from premiere_reponse_le - cree_le) / 60)::numeric) from requetes_clients
                          where premiere_reponse_le is not null and cree_le::date between du and au),
    'agents', (select coalesce(json_agg(x order by x.traitees desc), '[]') from (
      select coalesce(r.fermee_par, r.agent_email) as email, a.nom, a.numero,
        count(*) filter (where r.statut = 'resolue') as traitees,
        count(*) filter (where r.statut <> 'resolue') as en_cours,
        count(r.note) as nb_notes,
        round(avg(r.note)::numeric, 2) as moyenne,
        count(*) filter (where r.note <= 2) as mauvaises,
        count(*) filter (where r.rouverte_par_client > 0) as rouvertes,
        round(avg(extract(epoch from r.premiere_reponse_le - r.cree_le) / 60)::numeric) as delai_reponse_min,
        round(avg(extract(epoch from r.fermee_le - r.cree_le) / 3600)::numeric, 1) as delai_fermeture_h
      from requetes_clients r left join admins a on lower(a.email) = lower(coalesce(r.fermee_par, r.agent_email))
      where coalesce(r.fermee_par, r.agent_email) is not null and r.cree_le::date between du and au
      group by coalesce(r.fermee_par, r.agent_email), a.nom, a.numero) x)
  );
end $$;
grant execute on function public.admin_qualite(date, date) to authenticated;

-- =====================================================================
-- COTIZ — MISE À JOUR n°35 : COTIZ IA (agent IA du service client)
-- • Chaque nouvelle requête est d'abord lue par « Cotiz IA » : elle répond
--   aux questions d'utilisation ; si la demande touche aux données (paiement
--   à confirmer, numéro à changer, fraude, remboursement…), elle transmet à
--   un agent humain avec la raison.
-- • Les conversations de Cotiz IA sont séparées de celles du personnel et le
--   fondateur les vérifie (case « Vérifié »).
-- Supabase > SQL Editor > New query > coller TOUT > Run  →  « Success »
-- Relançable sans danger. À lancer APRÈS la n°34.
-- =====================================================================

-- L'auteur d'un message peut être le client, un agent ou Cotiz IA
alter table public.requetes_messages drop constraint if exists requetes_messages_auteur_check;
alter table public.requetes_messages add constraint requetes_messages_auteur_check check (auteur in ('client', 'agent', 'ia'));

alter table public.requetes_clients add column if not exists ia_statut text check (ia_statut in ('en_cours', 'transmis', 'resolu'));
alter table public.requetes_clients add column if not exists ia_raison text;
alter table public.requetes_clients add column if not exists ia_messages integer not null default 0;
alter table public.requetes_clients add column if not exists ia_verifiee boolean not null default false;
alter table public.requetes_clients add column if not exists ia_verifiee_par text;
alter table public.requetes_clients add column if not exists ia_verifiee_le timestamptz;

-- Cotiz IA écrit dans le fil (appelée par le serveur de l'application avec la clé « service_role »)
create or replace function public.ia_requete_ecrire(r uuid, texte text, transmettre boolean, raison text default null, resoudre boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare q requetes_clients;
begin
  select * into q from requetes_clients where id = r;
  if q.id is null then raise exception 'Requête introuvable'; end if;
  -- Un agent humain a déjà pris la main : l'IA n'écrit plus
  if q.ia_statut = 'transmis' or (q.agent_email is not null and q.agent_email <> 'cotiz-ia') then return; end if;
  insert into requetes_messages (requete_id, auteur, agent_email, texte) values (r, 'ia', 'cotiz-ia', left(trim(texte), 2000));
  update requetes_clients set
    dernier_auteur = case when transmettre then 'client' else 'agent' end,
    nb_messages = nb_messages + 1, ia_messages = ia_messages + 1, maj_le = now(),
    premiere_reponse_le = coalesce(premiere_reponse_le, now()),
    ia_statut = case when transmettre then 'transmis' when resoudre then 'resolu' else 'en_cours' end,
    ia_raison = case when transmettre then left(raison, 300) else ia_raison end,
    agent_email = case when transmettre then null else 'cotiz-ia' end,
    statut = case when transmettre then 'nouvelle' when resoudre then 'resolue' else 'en_cours' end,
    fermee_le = case when resoudre and not transmettre then now() else fermee_le end,
    fermee_par = case when resoudre and not transmettre then 'cotiz-ia' else fermee_par end
  where id = r;
  insert into notifications (profile_id, type, titre, texte, lien)
  values (q.profile_id, 'service_client', case when transmettre then 'Ta demande est transmise à un conseiller' else 'Cotiz IA t''a répondu' end,
          left(trim(texte), 300), '/aide#mes-requetes');
end $$;
revoke all on function public.ia_requete_ecrire(uuid, text, boolean, text, boolean) from public, anon, authenticated;
grant execute on function public.ia_requete_ecrire(uuid, text, boolean, text, boolean) to service_role;

-- Quand un agent répond dans une conversation de l'IA, il prend la main
create or replace function public.requete_agent_prend_la_main() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.auteur = 'agent' then
    update requetes_clients set
      ia_statut = case when ia_statut in ('en_cours', 'resolu') then 'transmis' else ia_statut end,
      ia_raison = case when ia_statut in ('en_cours', 'resolu') then coalesce(ia_raison, 'Repris par un agent') else ia_raison end,
      agent_email = case when agent_email is null or agent_email = 'cotiz-ia' then new.agent_email else agent_email end
    where id = new.requete_id;
  end if;
  return new;
end $$;
drop trigger if exists requete_agent_prend_la_main on public.requetes_messages;
create trigger requete_agent_prend_la_main after insert on public.requetes_messages for each row execute function public.requete_agent_prend_la_main();

-- Revue du matin : le fondateur marque une conversation de Cotiz IA comme vérifiée
create or replace function public.admin_requete_ia_verifier(r uuid, ok boolean default true) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  update requetes_clients set ia_verifiee = ok, ia_verifiee_par = case when ok then auth.jwt() ->> 'email' end, ia_verifiee_le = case when ok then now() end where id = r;
end $$;
grant execute on function public.admin_requete_ia_verifier(uuid, boolean) to authenticated;

-- Réglage : Cotiz IA allumée ou éteinte (lecture publique pour que l'application sache s'il faut l'appeler)
create or replace function public.admin_ia_activer(actif boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  insert into parametres_app (cle, valeur, maj_le, maj_par) values ('cotiz_ia_actif', case when actif then 'oui' else 'non' end, now(), auth.jwt() ->> 'email')
  on conflict (cle) do update set valeur = excluded.valeur, maj_le = now(), maj_par = excluded.maj_par;
  perform journaliser_admin('Réglage modifié', 'Cotiz IA', case when actif then 'allumée' else 'éteinte' end);
end $$;
grant execute on function public.admin_ia_activer(boolean) to authenticated;

-- État du réglage (pour l'interrupteur de l'admin)
create or replace function public.admin_ia_etat() returns text
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_admin();
  return coalesce((select valeur from parametres_app where cle = 'cotiz_ia_actif'), 'oui');
end $$;
grant execute on function public.admin_ia_etat() to authenticated;

-- =====================================================================
-- COTIZ — MISE À JOUR n°36 : PLANNING DÉPLAÇABLE + AGENDA SUR LE TÉLÉPHONE
-- • Déplacer / modifier un créneau en un geste, échanger deux créneaux,
--   remplir une semaine automatiquement (2 à 3 personnes en un clic).
-- • Horaires du soir et de nuit (ex : 22 h → 5 h le lendemain).
-- • Chaque agent a un lien d'agenda personnel : il l'ajoute une fois dans
--   Google Agenda ou le Calendrier de l'iPhone et voit ses horaires sur son
--   téléphone, mis à jour tout seul.
-- Supabase > SQL Editor > New query > coller TOUT > Run  →  « Success »
-- Relançable sans danger. À lancer APRÈS la n°35.
-- =====================================================================

alter table public.admins add column if not exists planning_jeton text;
create unique index if not exists admins_planning_jeton_idx on public.admins (planning_jeton) where planning_jeton is not null;
alter table public.planning_agents add column if not exists modifie_le timestamptz;

-- Ajouter un créneau (la fin peut être le lendemain : 22 h → 5 h)
create or replace function public.admin_planning_ajouter(adresse text, j date, de time, a time, remarque text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare i uuid;
begin
  perform verifier_fondateur();
  if a = de then raise exception 'L’heure de fin doit être différente de l’heure de début'; end if;
  if not exists (select 1 from admins where lower(email) = lower(adresse)) then raise exception 'Agent introuvable'; end if;
  insert into planning_agents (email, jour, debut, fin, note) values (lower(adresse), j, de, a, nullif(trim(coalesce(remarque, '')), '')) returning id into i;
  return i;
end $$;

-- Déplacer / modifier un créneau (autre jour, autre personne, autres heures)
create or replace function public.admin_planning_modifier(i uuid, adresse text, j date, de time, a time, remarque text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  if a = de then raise exception 'L’heure de fin doit être différente de l’heure de début'; end if;
  if not exists (select 1 from admins where lower(email) = lower(adresse)) then raise exception 'Agent introuvable'; end if;
  update planning_agents set email = lower(adresse), jour = j, debut = de, fin = a,
    note = nullif(trim(coalesce(remarque, '')), ''), modifie_le = now() where id = i;
  if not found then raise exception 'Créneau introuvable'; end if;
end $$;
grant execute on function public.admin_planning_modifier(uuid, text, date, time, time, text) to authenticated;

-- Échanger les personnes de deux créneaux
create or replace function public.admin_planning_echanger(i1 uuid, i2 uuid) returns void
language plpgsql security definer set search_path = public as $$
declare e1 text; e2 text;
begin
  perform verifier_fondateur();
  select email into e1 from planning_agents where id = i1;
  select email into e2 from planning_agents where id = i2;
  if e1 is null or e2 is null then raise exception 'Créneau introuvable'; end if;
  update planning_agents set email = e2, modifie_le = now() where id = i1;
  update planning_agents set email = e1, modifie_le = now() where id = i2;
end $$;
grant execute on function public.admin_planning_echanger(uuid, uuid) to authenticated;

-- Remplir une période d'un coup (génération automatique). « remplacer » efface d'abord
-- les créneaux existants de ces personnes sur la période.
create or replace function public.admin_planning_generer(du date, au date, lignes jsonb, remplacer boolean default true) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  perform verifier_fondateur();
  if jsonb_typeof(lignes) <> 'array' or jsonb_array_length(lignes) > 500 then raise exception 'Liste invalide'; end if;
  if au < du or au - du > 62 then raise exception 'Période invalide'; end if;
  if remplacer then
    delete from planning_agents p where p.jour between du and au
      and lower(p.email) in (select lower(x ->> 'email') from jsonb_array_elements(lignes) x);
  end if;
  insert into planning_agents (email, jour, debut, fin, note)
  select lower(x ->> 'email'), (x ->> 'jour')::date, (x ->> 'debut')::time, (x ->> 'fin')::time, nullif(trim(coalesce(x ->> 'note', '')), '')
  from jsonb_array_elements(lignes) x
  where (x ->> 'jour')::date between du and au and (x ->> 'debut') <> (x ->> 'fin')
    and exists (select 1 from admins a where lower(a.email) = lower(x ->> 'email'));
  get diagnostics n = row_count;
  perform journaliser_admin('Planning généré', du || ' → ' || au, n || ' créneaux');
  return n;
end $$;
grant execute on function public.admin_planning_generer(date, date, jsonb, boolean) to authenticated;

-- Lien d'agenda : chacun récupère le sien ; le fondateur peut récupérer celui d'un agent
create or replace function public.planning_jeton_pour(adresse text) returns text
language plpgsql security definer set search_path = public as $$
declare j text;
begin
  select planning_jeton into j from admins where lower(email) = lower(adresse);
  if j is null then
    j := encode(extensions.gen_random_bytes(18), 'hex');
    update admins set planning_jeton = j where lower(email) = lower(adresse);
  end if;
  return j;
end $$;
revoke all on function public.planning_jeton_pour(text) from public, anon, authenticated;

create or replace function public.mon_lien_planning() returns text
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_admin();
  return planning_jeton_pour(auth.jwt() ->> 'email');
end $$;
grant execute on function public.mon_lien_planning() to authenticated;

create or replace function public.admin_lien_planning(adresse text, nouveau boolean default false) returns text
language plpgsql security definer set search_path = public as $$
begin
  if lower(adresse) <> lower(coalesce(auth.jwt() ->> 'email', '')) then perform verifier_fondateur(); else perform verifier_admin(); end if;
  if not exists (select 1 from admins where lower(email) = lower(adresse)) then raise exception 'Agent introuvable'; end if;
  -- « nouveau » : l'ancien lien ne marche plus (si un téléphone a été perdu, par exemple)
  if nouveau then update admins set planning_jeton = null where lower(email) = lower(adresse); end if;
  return planning_jeton_pour(adresse);
end $$;
grant execute on function public.admin_lien_planning(text, boolean) to authenticated;

-- =====================================================================
-- COTIZ — MISE À JOUR n°37 : CAGNOTTES PUBLIQUES PARTAGEABLES
-- Le trésorier d'une collecte (mariage, funérailles, baptême, santé…) peut la
-- rendre publique : une belle page avec photo, jauge de l'objectif et liste
-- des donateurs, à envoyer sur WhatsApp. Toute personne qui a le lien voit la
-- page et peut participer (elle entre directement dans la collecte).
-- Supabase > SQL Editor > New query > coller TOUT > Run  →  « Success »
-- Relançable sans danger. À lancer APRÈS la n°36.
-- =====================================================================

alter table public.groups add column if not exists public_slug text;
alter table public.groups add column if not exists public_actif boolean not null default false;
alter table public.groups add column if not exists public_photo text;
alter table public.groups add column if not exists public_montants boolean not null default true;
alter table public.groups add column if not exists public_message text;
alter table public.groups add column if not exists public_fin date;
alter table public.groups add column if not exists public_vues integer not null default 0;
create unique index if not exists groups_public_slug_idx on public.groups (public_slug) where public_slug is not null;

-- Photos des cagnottes : stockage public (lecture par tous), écriture par le responsable du groupe
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public) values ('cagnottes', 'cagnottes', true) on conflict (id) do update set public = true;
    drop policy if exists "cagnottes: responsable ajoute" on storage.objects;
    create policy "cagnottes: responsable ajoute" on storage.objects for insert to authenticated
      with check (bucket_id = 'cagnottes' and public.can_manage(((storage.foldername(name))[1])::uuid));
    drop policy if exists "cagnottes: responsable remplace" on storage.objects;
    create policy "cagnottes: responsable remplace" on storage.objects for update to authenticated
      using (bucket_id = 'cagnottes' and public.can_manage(((storage.foldername(name))[1])::uuid));
    drop policy if exists "cagnottes: responsable retire" on storage.objects;
    create policy "cagnottes: responsable retire" on storage.objects for delete to authenticated
      using (bucket_id = 'cagnottes' and public.can_manage(((storage.foldername(name))[1])::uuid));
  end if;
end $$;

-- Publier / modifier / retirer la page publique (créateur, trésorier ou co-gestionnaire)
create or replace function public.cagnotte_publier(g uuid, actif boolean, montants boolean default true, message text default null, photo text default null, fin date default null) returns text
language plpgsql security definer set search_path = public as $$
declare q groups; s text; base text;
begin
  if not public.can_manage(g) then raise exception 'Seul le trésorier peut publier la cagnotte'; end if;
  select * into q from groups where id = g;
  if q.type <> 'collecte' then raise exception 'Seules les collectes peuvent devenir des cagnottes publiques'; end if;
  s := q.public_slug;
  if s is null then
    base := trim(both '-' from regexp_replace(lower(translate(q.name, 'àâäáãéèêëíìîïóòôöõúùûüçñÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucnAAAEEEEIIOOUUUC')), '[^a-z0-9]+', '-', 'g'));
    s := left(coalesce(nullif(base, ''), 'cagnotte'), 40) || '-' || encode(extensions.gen_random_bytes(3), 'hex');
  end if;
  update groups set public_slug = s, public_actif = actif, public_montants = montants,
    public_message = left(nullif(trim(coalesce(message, '')), ''), 600),
    public_photo = case when photo is null then public_photo when photo = '' then null else left(photo, 500) end,
    public_fin = fin
  where id = g;
  if actif then insert into cles_invitation (group_id) values (g) on conflict (group_id) do nothing; end if;
  return s;
end $$;
revoke all on function public.cagnotte_publier(uuid, boolean, boolean, text, text, date) from public, anon;
grant execute on function public.cagnotte_publier(uuid, boolean, boolean, text, text, date) to authenticated;

-- La page publique (lisible par tout le monde, sans compte) : seulement si le trésorier l'a publiée
drop function if exists public.cagnotte_publique(text);
create or replace function public.cagnotte_publique(s text, compter boolean default true) returns json
language plpgsql security definer set search_path = public as $$
declare q groups; total integer; nb integer; k text; tres text;
begin
  select * into q from groups where public_slug = s and public_actif;
  if q.id is null then return null; end if;
  if compter then update groups set public_vues = public_vues + 1 where id = q.id; end if;
  select coalesce(sum(p.amount), 0), count(distinct p.member_id) into total, nb
    from payments p where p.group_id = q.id and coalesce(p.status, 'reussi') = 'reussi';
  select cle into k from cles_invitation where group_id = q.id;
  select split_part(trim(m.name), ' ', 1) into tres from members m where m.group_id = q.id and m.role = 'tresorier' order by m.turn_position limit 1;
  return json_build_object(
    'id', q.id, 'nom', q.name, 'description', q.description, 'cause', q.don_cause, 'message', q.public_message,
    'photo', q.public_photo, 'objectif', q.target, 'montant_suggere', nullif(q.amount, 0), 'collecte', total, 'donateurs_nb', nb,
    'montants', q.public_montants, 'fin', q.public_fin, 'tresorier', tres, 'cle', k, 'cree_le', q.created_at,
    'donateurs', (select coalesce(json_agg(d order by d.le desc), '[]') from (
      select split_part(trim(m.name), ' ', 1) || case when position(' ' in trim(m.name)) > 0 then ' ' || left(split_part(trim(m.name), ' ', 2), 1) || '.' else '' end as nom,
             case when q.public_montants then sum(p.amount) end as montant, max(p.created_at) as le
      from payments p join members m on m.id = p.member_id
      where p.group_id = q.id and coalesce(p.status, 'reussi') = 'reussi'
      group by m.id, m.name order by max(p.created_at) desc limit 40) d)
  );
end $$;
revoke all on function public.cagnotte_publique(text, boolean) from public;
grant execute on function public.cagnotte_publique(text, boolean) to anon, authenticated;

-- Pour l'écran du trésorier : l'état de la page publique de son groupe
create or replace function public.cagnotte_etat(g uuid) returns json
language plpgsql security definer set search_path = public as $$
declare q groups;
begin
  if not public.can_manage(g) then return null; end if;
  select * into q from groups where id = g;
  return json_build_object('slug', q.public_slug, 'actif', q.public_actif, 'photo', q.public_photo, 'montants', q.public_montants,
    'message', q.public_message, 'fin', q.public_fin, 'vues', q.public_vues);
end $$;
grant execute on function public.cagnotte_etat(uuid) to authenticated;
