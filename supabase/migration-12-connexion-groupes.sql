-- =====================================================================
-- COTIZ — Mise à jour n°12 :
--   1. retrouver son compte sur un nouveau téléphone (numéro + naissance + code)
--   2. quitter un groupe
--   3. l'administrateur peut supprimer des groupes (ex : groupes de test)
-- À lancer APRÈS la mise à jour n°11.
-- Supabase > SQL Editor > New query (vide) > coller > Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Connexion sur un nouveau téléphone
--    Vérifiée par le serveur Cotiz uniquement (clé secrète), jamais depuis l'application.
-- ---------------------------------------------------------------------
create table if not exists public.tentatives_connexion (
  id bigserial primary key,
  telephone text not null,
  reussie boolean not null,
  le timestamptz not null default now()
);
alter table public.tentatives_connexion enable row level security;
create index if not exists tentatives_connexion_tel_idx on public.tentatives_connexion (telephone, le);

-- Renvoie l'identifiant du compte si numéro + date de naissance + code sont justes.
-- 5 erreurs par heure maximum pour un même numéro.
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
    and p.date_naissance = naissance
    and c.hash is not null and crypt(code, c.hash) = c.hash
  order by p.created_at desc limit 1;

  insert into tentatives_connexion (telephone, reussie) values (tel, pid is not null);
  if pid is null then return json_build_object('ok', false, 'raison', 'faux', 'restants', greatest(0, 4 - n)); end if;
  return json_build_object('ok', true, 'id', pid);
end $$;
revoke all on function public.connexion_verifier(text, text, date) from public, anon, authenticated;
grant execute on function public.connexion_verifier(text, text, date) to service_role;

-- ---------------------------------------------------------------------
-- 2. Quitter un groupe
--    Le trésorier ne peut pas quitter (il supprime le groupe ou nomme un autre trésorier).
--    Un membre qui a déjà payé est archivé : son historique reste visible pour le groupe.
-- ---------------------------------------------------------------------
create or replace function public.quitter_groupe(g uuid) returns text
language plpgsql security definer set search_path = public as $$
declare m record; n integer := 0;
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  if exists (select 1 from groups where id = g and created_by = auth.uid())
     or exists (select 1 from members where group_id = g and profile_id = auth.uid() and role = 'tresorier') then
    raise exception 'Le trésorier ne peut pas quitter le groupe : supprime-le, ou nomme d’abord un autre trésorier.';
  end if;
  perform set_config('cotiz.rattachement', 'on', true);
  for m in select id from members where group_id = g and profile_id = auth.uid() loop
    if exists (select 1 from payments where member_id = m.id) then
      update members set archive = true, profile_id = null where id = m.id;
    else
      delete from members where id = m.id;
    end if;
    n := n + 1;
  end loop;
  perform set_config('cotiz.rattachement', 'off', true);
  return case when n > 0 then 'ok' else 'pas_membre' end;
end $$;
grant execute on function public.quitter_groupe(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Administration : supprimer des groupes
-- ---------------------------------------------------------------------
create or replace function public.admin_supprimer_groupe(g uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_admin();
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
  delete from payouts;
  delete from payments;
  delete from groups;
  return n;
end $$;

grant execute on function public.admin_supprimer_groupe(uuid), public.admin_supprimer_tous_groupes(text) to authenticated;
