-- =====================================================================
-- COTIZ — Mise à jour n°8 : code secret à 4 chiffres (enregistré dans la base)
-- Supabase > SQL Editor > New query (vide) > coller > Run
-- =====================================================================
-- Le code est chiffré de façon irréversible (bcrypt) : personne ne peut le lire,
-- même pas l'équipe Cotiz. En cas d'oubli, on le RÉINITIALISE (voir tout en bas)
-- et la personne en crée un nouveau à la prochaine ouverture.

create extension if not exists pgcrypto with schema extensions;

-- Un code par personne
create table if not exists public.codes_secrets (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  hash text,                                  -- code chiffré (null = à créer)
  essais integer not null default 0,          -- erreurs à la suite
  bloque_jusqua timestamptz,                  -- blocage après 5 erreurs
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);
alter table public.codes_secrets enable row level security;
-- Aucune règle de lecture : la table ne se lit QUE par les fonctions ci-dessous.

-- Historique : création, modification, réinitialisation, blocage
create table if not exists public.codes_historique (
  id bigserial primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  action text not null check (action in ('creation', 'modification', 'reinitialisation', 'blocage')),
  le timestamptz not null default now()
);
alter table public.codes_historique enable row level security;
drop policy if exists "historique code: lecture" on public.codes_historique;
create policy "historique code: lecture" on public.codes_historique for select using (profile_id = auth.uid());

-- État du code de la personne connectée
create or replace function public.code_etat() returns json
language plpgsql security definer set search_path = public as $$
declare c codes_secrets;
begin
  select * into c from codes_secrets where profile_id = auth.uid();
  return json_build_object(
    'defini', c.hash is not null,
    'modifie_le', c.modifie_le,
    'attente', greatest(0, ceil(extract(epoch from (coalesce(c.bloque_jusqua, now()) - now()))))::int
  );
end $$;

-- Créer ou changer son code (l'ancien code est demandé pour un changement)
create or replace function public.definir_code(nouveau text, ancien text default null) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare c codes_secrets;
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  if nouveau !~ '^[0-9]{4}$' then raise exception 'Le code doit contenir 4 chiffres'; end if;
  select * into c from codes_secrets where profile_id = auth.uid();
  if c.hash is not null then
    if c.bloque_jusqua is not null and c.bloque_jusqua > now() then
      return json_build_object('ok', false, 'erreur', 'Trop d’essais. Patiente une minute.');
    end if;
    if ancien is null or crypt(ancien, c.hash) <> c.hash then
      -- une erreur sur l'ancien code compte comme un essai raté
      update codes_secrets set
        essais = case when essais + 1 >= 5 then 0 else essais + 1 end,
        bloque_jusqua = case when essais + 1 >= 5 then now() + interval '1 minute' else null end
      where profile_id = auth.uid();
      return json_build_object('ok', false, 'erreur', 'Ancien code incorrect');
    end if;
  end if;
  insert into codes_secrets (profile_id, hash, essais, bloque_jusqua, modifie_le)
  values (auth.uid(), crypt(nouveau, gen_salt('bf', 8)), 0, null, now())
  on conflict (profile_id) do update set hash = excluded.hash, essais = 0, bloque_jusqua = null, modifie_le = now();
  insert into codes_historique (profile_id, action) values (auth.uid(), case when c.hash is null then 'creation' else 'modification' end);
  return json_build_object('ok', true);
end $$;

-- Vérifier le code à l'ouverture (5 essais, puis 1 minute d'attente)
create or replace function public.verifier_code(code text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare c codes_secrets; n integer;
begin
  select * into c from codes_secrets where profile_id = auth.uid();
  if c.hash is null then return json_build_object('ok', false, 'defini', false, 'restants', 5, 'attente', 0); end if;
  if c.bloque_jusqua is not null and c.bloque_jusqua > now() then
    return json_build_object('ok', false, 'defini', true, 'restants', 0, 'attente', ceil(extract(epoch from (c.bloque_jusqua - now())))::int);
  end if;
  if crypt(code, c.hash) = c.hash then
    update codes_secrets set essais = 0, bloque_jusqua = null where profile_id = auth.uid();
    return json_build_object('ok', true, 'defini', true, 'restants', 5, 'attente', 0);
  end if;
  n := c.essais + 1;
  if n >= 5 then
    update codes_secrets set essais = 0, bloque_jusqua = now() + interval '1 minute' where profile_id = auth.uid();
    insert into codes_historique (profile_id, action) values (auth.uid(), 'blocage');
    return json_build_object('ok', false, 'defini', true, 'restants', 0, 'attente', 60);
  end if;
  update codes_secrets set essais = n, bloque_jusqua = null where profile_id = auth.uid();
  return json_build_object('ok', false, 'defini', true, 'restants', 5 - n, 'attente', 0);
end $$;

-- Réinitialisation par l'équipe Cotiz (code oublié), à lancer ici dans le SQL Editor.
-- Les utilisateurs de l'application ne peuvent PAS l'appeler.
create or replace function public.reinitialiser_code(telephone text) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer := 0; p record;
begin
  for p in select id from profiles where right(regexp_replace(phone, '\D', '', 'g'), 10) = right(regexp_replace(telephone, '\D', '', 'g'), 10) loop
    update codes_secrets set hash = null, essais = 0, bloque_jusqua = null, modifie_le = now() where profile_id = p.id;
    insert into codes_historique (profile_id, action) values (p.id, 'reinitialisation');
    n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function public.reinitialiser_code(text) from public, anon, authenticated;
grant execute on function public.code_etat(), public.definir_code(text, text), public.verifier_code(text) to authenticated;

-- ---------------------------------------------------------------------
-- MODE D'EMPLOI — code oublié :
--   1. Vérifie l'identité de la personne (appel au numéro du compte).
--   2. Lance ici :   select public.reinitialiser_code('0707123456');
--   3. À sa prochaine ouverture, l'application lui demande de créer un nouveau code.
-- Voir l'historique d'une personne :
--   select h.action, h.le from codes_historique h join profiles p on p.id = h.profile_id
--   where right(p.phone, 10) = '0707123456' order by h.le desc;
-- ---------------------------------------------------------------------
