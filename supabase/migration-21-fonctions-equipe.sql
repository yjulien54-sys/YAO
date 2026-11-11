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
