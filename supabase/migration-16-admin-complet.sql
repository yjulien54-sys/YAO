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
