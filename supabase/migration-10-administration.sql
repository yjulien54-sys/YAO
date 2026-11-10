-- =====================================================================
-- COTIZ — Mise à jour n°10 : espace Administration (page /admin)
-- À lancer APRÈS les mises à jour n°8 et n°9.
-- Supabase > SQL Editor > New query (vide) > coller > Run
-- =====================================================================
-- Seules les adresses e-mail inscrites dans la table « admins » ont accès à /admin.
-- Après avoir lancé ce fichier, ajoute TON e-mail (voir tout en bas).

create table if not exists public.admins (
  email text primary key,
  ajoute_le timestamptz not null default now()
);
alter table public.admins enable row level security;
-- Aucune règle : personne ne lit cette table depuis l'application.

create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from admins a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );
$$;

create or replace function public.verifier_admin() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Accès refusé : réservé à l’administrateur'; end if;
end $$;

-- Chiffres clés
create or replace function public.admin_stats() returns json
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_admin();
  return json_build_object(
    'inscrits', (select count(*) from profiles),
    'inscrits_7j', (select count(*) from profiles where created_at > now() - interval '7 days'),
    'groupes', (select count(*) from groups),
    'membres', (select count(*) from members),
    'paiements_confirmes', (select count(*) from payments where status = 'reussi'),
    'paiements_attente', (select count(*) from payments where status = 'en_attente'),
    'montant_confirme', (select coalesce(sum(amount + penalty), 0) from payments where status = 'reussi'),
    'montant_attente', (select coalesce(sum(amount + penalty), 0) from payments where status = 'en_attente'),
    'codes_definis', (select count(*) from codes_secrets where hash is not null),
    'demandes_code_7j', (select count(*) from demandes_reinitialisation where le > now() - interval '7 days')
  );
end $$;

-- Liste des inscrits
create or replace function public.admin_inscrits() returns table (
  id uuid, nom text, telephone text, naissance date, inscrit_le timestamptz, nb_groupes bigint, code_defini boolean
)
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_admin();
  return query
    select p.id, p.name, p.phone, p.date_naissance, p.created_at,
      (select count(*) from members m where m.profile_id = p.id),
      exists (select 1 from codes_secrets c where c.profile_id = p.id and c.hash is not null)
    from profiles p order by p.created_at desc;
end $$;

-- Liste des groupes
create or replace function public.admin_groupes() returns table (
  id uuid, nom text, type text, montant integer, frequence text, tour integer, cree_le timestamptz,
  nb_membres bigint, tresorier text, tresorier_tel text, collecte bigint, en_attente bigint
)
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_admin();
  return query
    select g.id, g.name, g.type, g.amount, g.frequency, g.current_round, g.created_at,
      (select count(*) from members m where m.group_id = g.id),
      pr.name, pr.phone,
      (select coalesce(sum(p.amount + p.penalty), 0) from payments p where p.group_id = g.id and p.status = 'reussi'),
      (select count(*) from payments p where p.group_id = g.id and p.status = 'en_attente')
    from groups g left join profiles pr on pr.id = g.created_by
    order by g.created_at desc;
end $$;

-- Paiements en attente de confirmation
create or replace function public.admin_paiements_attente() returns table (
  id uuid, le timestamptz, groupe text, membre text, montant integer, moyen text, tresorier_tel text
)
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_admin();
  return query
    select p.id, p.created_at, g.name, m.name, p.amount + p.penalty, p.method, pr.phone
    from payments p join groups g on g.id = p.group_id join members m on m.id = p.member_id
    left join profiles pr on pr.id = g.created_by
    where p.status = 'en_attente' order by p.created_at desc limit 200;
end $$;

-- Demandes « code oublié »
create or replace function public.admin_demandes_code() returns table (
  le timestamptz, nom text, telephone text, nom_saisi text, naissance_saisie date, resultat text
)
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_admin();
  return query
    select d.le, p.name, p.phone, d.nom_saisi, d.naissance_saisie, d.resultat
    from demandes_reinitialisation d left join profiles p on p.id = d.profile_id
    order by d.le desc limit 200;
end $$;

-- Réinitialiser le code d'une personne (depuis la page /admin)
create or replace function public.admin_reinitialiser_code(telephone text) returns integer
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_admin();
  return public.reinitialiser_code(telephone);
end $$;

-- Annonces : l'administrateur peut tout voir et tout modifier depuis /admin
drop policy if exists "annonces: admin lecture" on public.annonces;
create policy "annonces: admin lecture" on public.annonces for select using (public.is_admin());
drop policy if exists "annonces: admin écriture" on public.annonces;
create policy "annonces: admin écriture" on public.annonces for all using (public.is_admin()) with check (public.is_admin());

revoke all on function public.verifier_admin() from public, anon;
grant execute on function public.is_admin(), public.admin_stats(), public.admin_inscrits(), public.admin_groupes(),
  public.admin_paiements_attente(), public.admin_demandes_code(), public.admin_reinitialiser_code(text) to authenticated;

-- ---------------------------------------------------------------------
-- DERNIÈRE ÉTAPE (obligatoire) : donne-toi l'accès.
-- 1. Supabase > Authentication > Users > « Add user » > « Create new user » :
--    ton e-mail + un mot de passe solide, coche « Auto Confirm User ».
-- 2. Ici, dans une NOUVELLE requête, lance (avec TON e-mail) :
--      insert into public.admins (email) values ('ton.email@exemple.com');
-- 3. Ouvre https://tontine-et-cotise.vercel.app/admin et connecte-toi.
-- ---------------------------------------------------------------------
