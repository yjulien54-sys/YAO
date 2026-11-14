-- =====================================================================
-- COTIZ — MISE À JOUR n°38 : UN NUMÉRO = UN SEUL COMPTE
-- Avant, si quelqu'un ouvrait Cotiz sur un autre appareil (ordinateur…) et
-- retapait son nom et son numéro, un DEUXIÈME compte était créé. Les groupes
-- créés d'un côté n'avaient pas les droits de trésorier de l'autre côté.
--  1. L'application vérifie si le numéro a déjà un compte et propose de s'y connecter.
--  2. Quand la personne se connecte (numéro + date de naissance + code secret),
--     tous les autres comptes du même numéro sont réunis dans celui-ci :
--     groupes créés, places de membre, paiements, demandes… rien n'est perdu.
-- Supabase > SQL Editor > New query > coller TOUT > Run  →  « Success »
-- Relançable sans danger. À lancer APRÈS la n°37.
-- =====================================================================

alter table public.profiles add column if not exists fusionne_dans uuid;
alter table public.profiles add column if not exists fusionne_le timestamptz;
-- Numéro recyclé par l'opérateur : la nouvelle personne dit « ce n'est pas moi » → son compte n'est jamais réuni avec l'ancien
alter table public.profiles add column if not exists pas_fusionner boolean not null default false;

create or replace function public.ce_numero_nest_pas_a_moi() returns void
language sql security definer set search_path = public as $$
  update profiles set pas_fusionner = true where id = auth.uid()
$$;
grant execute on function public.ce_numero_nest_pas_a_moi() to authenticated;

-- 1. Ce numéro a-t-il déjà un compte ? (rien d'autre n'est révélé : ni nom, ni groupes)
create or replace function public.numero_a_un_compte(tel text) returns json
language plpgsql security definer set search_path = public as $$
declare t text := right(regexp_replace(coalesce(tel, ''), '\D', '', 'g'), 10); p profiles; avec_code boolean;
begin
  if length(t) <> 10 then return json_build_object('existe', false); end if;
  select * into p from profiles
   where right(regexp_replace(phone, '\D', '', 'g'), 10) = t and fusionne_dans is null and not pas_fusionner and not coalesce(bloque, false)
     and (auth.uid() is null or id <> auth.uid())
   order by created_at limit 1;
  if p.id is null then return json_build_object('existe', false); end if;
  select exists (select 1 from codes_secrets c where c.profile_id = p.id and c.hash is not null) into avec_code;
  -- « peut_se_connecter » : le compte a un code secret ET une date de naissance (connexion sur un autre appareil)
  return json_build_object('existe', true, 'peut_se_connecter', avec_code and p.date_naissance is not null);
end $$;
revoke all on function public.numero_a_un_compte(text) from public;
grant execute on function public.numero_a_un_compte(text) to anon, authenticated;

-- 2. Réunir dans le compte « cible » tous les autres comptes du même numéro.
--    Appelée UNIQUEMENT par le serveur, après vérification du numéro + date de naissance + code secret.
create or replace function public.fusionner_comptes_numero(cible uuid) returns json
language plpgsql security definer set search_path = public as $$
declare t text; autre uuid; n integer := 0; g integer := 0;
begin
  select right(regexp_replace(phone, '\D', '', 'g'), 10) into t from profiles where id = cible and not pas_fusionner;
  if t is null or length(t) <> 10 then return json_build_object('ok', false, 'raison', 'sans_numero'); end if;
  perform set_config('cotiz.rattachement', 'on', true);
  perform set_config('cotiz.admin', 'on', true);
  for autre in
    select id from profiles where id <> cible and fusionne_dans is null and not pas_fusionner
      and right(regexp_replace(phone, '\D', '', 'g'), 10) = t
  loop
    update groups set created_by = cible where created_by = autre;
    get diagnostics g = row_count;
    update members set profile_id = cible where profile_id = autre;
    update members set invite_par = cible where invite_par = autre;
    update payments set created_by = cible where created_by = autre;
    update payouts set created_by = cible where created_by = autre;
    -- engagements : un seul par groupe
    update engagements e set profile_id = cible where e.profile_id = autre
      and not exists (select 1 from engagements x where x.group_id = e.group_id and x.profile_id = cible);
    delete from engagements where profile_id = autre;
    update demandes_versement set demande_par = cible where demande_par = autre;
    update validations_versement v set profile_id = cible where v.profile_id = autre
      and not exists (select 1 from validations_versement x where x.demande_id = v.demande_id and x.profile_id = cible);
    delete from validations_versement where profile_id = autre;
    update notifications set profile_id = cible where profile_id = autre;
    update requetes_clients set profile_id = cible where profile_id = autre;
    update dossiers_admin set client_profile_id = cible where client_profile_id = autre;
    delete from actifs_jour where profile_id = autre;
    -- date de naissance reprise si la cible n'en a pas
    update profiles c set date_naissance = o.date_naissance
      from profiles o where c.id = cible and o.id = autre and c.date_naissance is null and o.date_naissance is not null;
    update profiles set fusionne_dans = cible, fusionne_le = now() where id = autre;
    n := n + 1;
  end loop;
  perform set_config('cotiz.rattachement', 'off', true);
  perform set_config('cotiz.admin', 'off', true);
  return json_build_object('ok', true, 'comptes_reunis', n);
end $$;
revoke all on function public.fusionner_comptes_numero(uuid) from public, anon, authenticated;
grant execute on function public.fusionner_comptes_numero(uuid) to service_role;

-- 3. Un ancien appareil resté connecté sur un compte réuni : l'application le déconnecte
create or replace function public.mon_compte_fusionne() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select fusionne_dans is not null from profiles where id = auth.uid()), false)
$$;
grant execute on function public.mon_compte_fusionne() to authenticated;

-- 4. La connexion sur un autre appareil ignore les comptes déjà réunis
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
    and p.date_naissance = naissance and not p.bloque and p.fusionne_dans is null
    and c.hash is not null and crypt(code, c.hash) = c.hash
  order by p.created_at asc limit 1;
  insert into tentatives_connexion (telephone, reussie) values (tel, pid is not null);
  if pid is null then return json_build_object('ok', false, 'raison', 'faux', 'restants', greatest(0, 4 - n)); end if;
  return json_build_object('ok', true, 'id', pid);
end $$;
revoke all on function public.connexion_verifier(text, text, date) from public, anon, authenticated;
grant execute on function public.connexion_verifier(text, text, date) to service_role;
