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

