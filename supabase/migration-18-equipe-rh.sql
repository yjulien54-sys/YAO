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
