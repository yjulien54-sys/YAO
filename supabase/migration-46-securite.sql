-- =====================================================================
-- SIKAKLO — MISE À JOUR n°46 : SÉCURITÉ
--  1. Limite de requêtes : un robot ne peut plus envoyer des milliers de demandes
--     (connexion, paiements, IA, vérification de numéro…).
--  2. Journal des activités suspectes, visible par le fondateur dans l'admin.
--  3. Photos envoyées : seulement des images (et des PDF pour les dossiers des agents),
--     5 Mo maximum (10 Mo pour les dossiers des agents).
--  4. La vérification « ce numéro a-t-il un compte ? » passe par le serveur
--     (avec limite), pour qu'on ne puisse plus tester des milliers de numéros.
-- Supabase > SQL Editor > New query > coller TOUT > Run  →  « Success »
-- Relançable sans danger. À lancer APRÈS la n°45.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. LIMITE DE REQUÊTES (utilisée uniquement par le serveur)
-- ---------------------------------------------------------------------
create table if not exists public.limites_requetes (
  cle text primary key,
  debut timestamptz not null default now(),
  n integer not null default 0
);
alter table public.limites_requetes enable row level security;
-- Aucune règle d'accès : seuls le serveur (service_role) et les fonctions ci-dessous y touchent.

create or replace function public.limiter_requete(k text, maxi integer, secondes integer) returns boolean
language plpgsql security definer set search_path = public as $$
declare v integer;
begin
  insert into limites_requetes as l (cle, debut, n) values (left(k, 200), now(), 1)
  on conflict (cle) do update set
    n = case when l.debut < now() - make_interval(secs => secondes) then 1 else l.n + 1 end,
    debut = case when l.debut < now() - make_interval(secs => secondes) then now() else l.debut end
  returning n into v;
  -- petit ménage de temps en temps
  if random() < 0.01 then delete from limites_requetes where debut < now() - interval '1 day'; end if;
  return v <= maxi;
end $$;
revoke all on function public.limiter_requete(text, integer, integer) from public, anon, authenticated;
grant execute on function public.limiter_requete(text, integer, integer) to service_role;

-- ---------------------------------------------------------------------
-- 2. JOURNAL DES ACTIVITÉS SUSPECTES
-- ---------------------------------------------------------------------
create table if not exists public.alertes_securite (
  id bigserial primary key,
  type text not null,
  detail text,
  ip text,
  profile_id uuid,
  cree_le timestamptz not null default now()
);
create index if not exists alertes_securite_date_idx on public.alertes_securite (cree_le desc);
alter table public.alertes_securite enable row level security;

create or replace function public.noter_alerte(typ text, det text, adr text, pid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into alertes_securite (type, detail, ip, profile_id) values (left(typ, 60), left(det, 500), left(adr, 64), pid);
  if random() < 0.01 then delete from alertes_securite where cree_le < now() - interval '90 days'; end if;
end $$;
revoke all on function public.noter_alerte(text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.noter_alerte(text, text, text, uuid) to service_role;

-- Lecture réservée au fondateur
create or replace function public.admin_alertes(nb integer default 100)
returns table (id bigint, type text, detail text, ip text, profile_id uuid, nom text, cree_le timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  return query
    select a.id, a.type, a.detail, a.ip, a.profile_id, p.name, a.cree_le
      from alertes_securite a left join profiles p on p.id = a.profile_id
     order by a.cree_le desc limit least(greatest(coalesce(nb, 100), 1), 500);
end $$;
revoke all on function public.admin_alertes(integer) from public, anon;
grant execute on function public.admin_alertes(integer) to authenticated;

-- ---------------------------------------------------------------------
-- 3. FICHIERS ENVOYÉS : TYPE ET TAILLE LIMITÉS
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'storage' and table_name = 'buckets' and column_name = 'allowed_mime_types') then
    update storage.buckets set file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'] where id = 'cagnottes';
    update storage.buckets set file_size_limit = 10485760, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] where id = 'agents';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 4. « CE NUMÉRO A-T-IL UN COMPTE ? » : SEULEMENT PAR LE SERVEUR
-- ---------------------------------------------------------------------
create or replace function public.numero_a_un_compte_serveur(tel text, moi uuid) returns json
language plpgsql security definer set search_path = public as $$
declare t text := right(regexp_replace(coalesce(tel, ''), '\D', '', 'g'), 10); p profiles; avec_code boolean;
begin
  if length(t) <> 10 then return json_build_object('existe', false); end if;
  select * into p from profiles
   where right(regexp_replace(phone, '\D', '', 'g'), 10) = t and fusionne_dans is null and not pas_fusionner and not coalesce(bloque, false)
     and (moi is null or id <> moi)
   order by created_at limit 1;
  if p.id is null then return json_build_object('existe', false); end if;
  select exists (select 1 from codes_secrets c where c.profile_id = p.id and c.hash is not null) into avec_code;
  return json_build_object('existe', true, 'peut_se_connecter', avec_code and p.date_naissance is not null);
end $$;
revoke all on function public.numero_a_un_compte_serveur(text, uuid) from public, anon, authenticated;
grant execute on function public.numero_a_un_compte_serveur(text, uuid) to service_role;

-- L'ancienne fonction n'est plus appelable directement depuis un navigateur
revoke all on function public.numero_a_un_compte(text) from public, anon, authenticated;
grant execute on function public.numero_a_un_compte(text) to service_role;
