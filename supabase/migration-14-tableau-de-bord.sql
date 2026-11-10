-- =====================================================================
-- COTIZ — Mise à jour n°14 : tableau de bord administrateur complet
--   fiches groupes et utilisateurs, modifications, blocage à vie
-- À lancer APRÈS la mise à jour n°13.
-- Supabase > SQL Editor > New query (vide) > coller > Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Blocage d'un compte
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists bloque boolean not null default false;
alter table public.profiles add column if not exists bloque_motif text;
alter table public.profiles add column if not exists bloque_le timestamptz;

-- Un compte bloqué n'a plus accès à aucun groupe
create or replace function public.is_member(g uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from members where group_id = g and profile_id = auth.uid() and not en_attente)
     and not exists (select 1 from profiles where id = auth.uid() and bloque);
$$;

create or replace function public.can_manage(g uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select (exists (select 1 from groups where id = g and created_by = auth.uid())
      or exists (select 1 from members where group_id = g and profile_id = auth.uid() and role = 'tresorier'))
     and not exists (select 1 from profiles where id = auth.uid() and bloque);
$$;

-- Un compte bloqué ne peut pas se reconnecter sur un autre téléphone
create or replace function public.connexion_verifier(telephone text, code text, naissance date) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare tel text := right(regexp_replace(coalesce(telephone, ''), '\D', '', 'g'), 10); n integer; pid uuid;
begin
  if length(tel) < 8 then return json_build_object('ok', false, 'raison', 'faux'); end if;
  select count(*) into n from tentatives_connexion where tentatives_connexion.telephone = tel and not reussie and le > now() - interval '1 hour';
  if n >= 5 then return json_build_object('ok', false, 'raison', 'bloquee'); end if;
  select p.id into pid
  from profiles p join codes_secrets c on c.profile_id = p.id
  where right(regexp_replace(p.phone, '\D', '', 'g'), 10) = tel
    and p.date_naissance = naissance and not p.bloque
    and c.hash is not null and crypt(code, c.hash) = c.hash
  order by p.created_at desc limit 1;
  insert into tentatives_connexion (telephone, reussie) values (tel, pid is not null);
  if pid is null then return json_build_object('ok', false, 'raison', 'faux', 'restants', greatest(0, 4 - n)); end if;
  return json_build_object('ok', true, 'id', pid);
end $$;
revoke all on function public.connexion_verifier(text, text, date) from public, anon, authenticated;
grant execute on function public.connexion_verifier(text, text, date) to service_role;

-- L'application vérifie si le compte connecté est bloqué
create or replace function public.mon_blocage() returns json
language sql security definer stable set search_path = public as $$
  select json_build_object('bloque', coalesce(bloque, false), 'motif', bloque_motif) from profiles where id = auth.uid();
$$;
grant execute on function public.mon_blocage() to authenticated;

-- L'administrateur peut corriger la date de naissance et le numéro (gardes contournées pour lui seul)
create or replace function public.garde_naissance() returns trigger
language plpgsql as $$
begin
  if current_setting('cotiz.admin', true) = 'on' then return new; end if;
  if old.date_naissance is not null and new.date_naissance is distinct from old.date_naissance then
    raise exception 'La date de naissance ne peut pas être modifiée. Contacte le service client.';
  end if;
  return new;
end $$;

create or replace function public.garde_profils() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_setting('cotiz.admin', true) = 'on' then return new; end if;
  if new.phone is distinct from old.phone then
    if old.phone_modifie_le is not null and old.phone_modifie_le > now() - interval '24 hours' then
      raise exception 'Tu as déjà changé de numéro aujourd’hui. Réessaie demain ou contacte le service client.';
    end if;
    new.phone_modifie_le := now();
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 2. Fiches détaillées
-- ---------------------------------------------------------------------
create or replace function public.admin_inscrits() returns table (
  id uuid, nom text, telephone text, naissance date, inscrit_le timestamptz, nb_groupes bigint, code_defini boolean
)
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_admin();
  return query
    select p.id, p.name || case when p.bloque then ' (bloqué)' else '' end, p.phone, p.date_naissance, p.created_at,
      (select count(*) from members m where m.profile_id = p.id),
      exists (select 1 from codes_secrets c where c.profile_id = p.id and c.hash is not null)
    from profiles p order by p.created_at desc;
end $$;

create or replace function public.admin_utilisateur(p uuid) returns json
language plpgsql security definer set search_path = public as $$
declare tel text;
begin
  perform verifier_admin();
  select right(regexp_replace(phone, '\D', '', 'g'), 10) into tel from profiles where id = p;
  return json_build_object(
    'profil', (select to_json(x) from (select id, name, phone, date_naissance, created_at, bloque, bloque_motif, bloque_le, phone_modifie_le from profiles where id = p) x),
    'compte', (select to_json(x) from (select email, is_anonymous, created_at, last_sign_in_at from auth.users where id = p) x),
    'code', (select to_json(x) from (select hash is not null as defini, modifie_le, bloque_jusqua from codes_secrets where profile_id = p) x),
    'historique_code', coalesce((select json_agg(x order by x.le desc) from (select action, le from codes_historique where profile_id = p) x), '[]'),
    'groupes', coalesce((select json_agg(x) from (
        select g.id, g.name, g.type, m.id as membre_id, m.role, m.en_attente, m.archive, (g.created_by = p) as createur
        from members m join groups g on g.id = m.group_id where m.profile_id = p) x), '[]'),
    'paiements', coalesce((select json_agg(x order by x.created_at desc) from (
        select pa.id, pa.created_at, pa.amount, pa.penalty, pa.method, pa.status, pa.round, g.name as groupe
        from payments pa join members m on m.id = pa.member_id join groups g on g.id = pa.group_id where m.profile_id = p) x), '[]'),
    'tentatives', coalesce((select json_agg(x order by x.le desc) from (select reussie, le from tentatives_connexion where telephone = tel order by le desc limit 20) x), '[]'),
    'demandes_code', coalesce((select json_agg(x order by x.le desc) from (select resultat, le from demandes_reinitialisation where profile_id = p) x), '[]')
  );
end $$;

create or replace function public.admin_groupe(g uuid) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_admin();
  return json_build_object(
    'groupe', (select to_json(x) from (select gr.*, pr.name as createur_nom, pr.phone as createur_tel from groups gr left join profiles pr on pr.id = gr.created_by where gr.id = g) x),
    'membres', coalesce((select json_agg(x order by x.turn_position) from (
        select m.id, m.name, m.phone, m.role, m.en_attente, m.archive, m.turn_position, m.profile_id, pr.bloque,
          (select count(*) from payments pa where pa.member_id = m.id and pa.status = 'reussi') as nb_paiements
        from members m left join profiles pr on pr.id = m.profile_id where m.group_id = g) x), '[]'),
    'paiements', coalesce((select json_agg(x order by x.created_at desc) from (
        select pa.id, pa.created_at, pa.amount, pa.penalty, pa.method, pa.status, pa.round, pa.transaction_id, m.name as membre
        from payments pa left join members m on m.id = pa.member_id where pa.group_id = g) x), '[]'),
    'versements', coalesce((select json_agg(x order by x.created_at desc) from (
        select id, created_at, amount, beneficiary_name, method, nature, round from payouts where group_id = g) x), '[]'),
    'demandes_versement', coalesce((select json_agg(x order by x.cree_le desc) from (
        select d.id, d.cree_le, d.amount, d.beneficiary_name, d.statut, d.requis,
          (select count(*) from validations_versement v where v.demande_id = d.id and v.accord) as validations
        from demandes_versement d where d.group_id = g) x), '[]')
  );
end $$;

-- ---------------------------------------------------------------------
-- 3. Actions de l'administrateur
-- ---------------------------------------------------------------------
create or replace function public.admin_modifier_profil(p uuid, nom text, telephone text, naissance date) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_admin();
  perform set_config('cotiz.admin', 'on', true);
  update profiles set name = coalesce(nullif(trim(nom), ''), name),
    phone = coalesce(nullif(regexp_replace(coalesce(telephone, ''), '\D', '', 'g'), ''), phone),
    date_naissance = coalesce(naissance, date_naissance)
  where id = p;
  perform set_config('cotiz.admin', 'off', true);
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
end $$;

create or replace function public.admin_reinitialiser_code_profil(p uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_admin();
  update codes_secrets set hash = null, essais = 0, bloque_jusqua = null, modifie_le = now() where profile_id = p;
  insert into codes_historique (profile_id, action) values (p, 'reinitialisation');
end $$;

create or replace function public.admin_paiement_statut(paiement uuid, statut text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_admin();
  if statut not in ('reussi', 'echoue') then raise exception 'Statut invalide'; end if;
  update payments set status = statut where id = paiement and status = 'en_attente';
  if not found then raise exception 'Ce paiement n’est plus en attente'; end if;
end $$;

create or replace function public.admin_modifier_membre(membre uuid, nom text, telephone text, nouveau_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_admin();
  if nouveau_role is not null and nouveau_role not in ('tresorier', 'gestionnaire', 'membre') then raise exception 'Rôle invalide'; end if;
  perform set_config('cotiz.rattachement', 'on', true);
  update members set name = coalesce(nullif(trim(nom), ''), name),
    phone = coalesce(nullif(regexp_replace(coalesce(telephone, ''), '\D', '', 'g'), ''), phone),
    role = coalesce(nouveau_role, role),
    en_attente = false
  where id = membre;
  perform set_config('cotiz.rattachement', 'off', true);
end $$;

create or replace function public.admin_retirer_membre(membre uuid) returns text
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_admin();
  if exists (select 1 from payments where member_id = membre) then
    perform set_config('cotiz.rattachement', 'on', true);
    update members set archive = true where id = membre;
    perform set_config('cotiz.rattachement', 'off', true);
    return 'archive';
  end if;
  delete from members where id = membre;
  return 'supprime';
end $$;

grant execute on function public.admin_utilisateur(uuid), public.admin_groupe(uuid), public.admin_modifier_profil(uuid, text, text, date),
  public.admin_bloquer(uuid, boolean, text), public.admin_reinitialiser_code_profil(uuid), public.admin_paiement_statut(uuid, text),
  public.admin_modifier_membre(uuid, text, text, text), public.admin_retirer_membre(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Blocage à vie : impossible de recréer un compte avec un numéro bloqué
-- ---------------------------------------------------------------------
create or replace function public.garde_numero_bloque() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_setting('cotiz.admin', true) = 'on' then return new; end if;
  if exists (select 1 from profiles p
             where p.bloque and p.id <> new.id
               and right(regexp_replace(p.phone, '\D', '', 'g'), 10) = right(regexp_replace(new.phone, '\D', '', 'g'), 10)) then
    raise exception 'Ce numéro est bloqué sur Cotiz. Contacte le service client.';
  end if;
  return new;
end $$;
drop trigger if exists garde_numero_bloque on public.profiles;
create trigger garde_numero_bloque before insert or update of phone on public.profiles
  for each row execute function public.garde_numero_bloque();
