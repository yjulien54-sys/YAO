-- =====================================================================
-- COTIZ — MISE À JOUR n°36 : PLANNING DÉPLAÇABLE + AGENDA SUR LE TÉLÉPHONE
-- • Déplacer / modifier un créneau en un geste, échanger deux créneaux,
--   remplir une semaine automatiquement (2 à 3 personnes en un clic).
-- • Horaires du soir et de nuit (ex : 22 h → 5 h le lendemain).
-- • Chaque agent a un lien d'agenda personnel : il l'ajoute une fois dans
--   Google Agenda ou le Calendrier de l'iPhone et voit ses horaires sur son
--   téléphone, mis à jour tout seul.
-- Supabase > SQL Editor > New query > coller TOUT > Run  →  « Success »
-- Relançable sans danger. À lancer APRÈS la n°35.
-- =====================================================================

alter table public.admins add column if not exists planning_jeton text;
create unique index if not exists admins_planning_jeton_idx on public.admins (planning_jeton) where planning_jeton is not null;
alter table public.planning_agents add column if not exists modifie_le timestamptz;

-- Ajouter un créneau (la fin peut être le lendemain : 22 h → 5 h)
create or replace function public.admin_planning_ajouter(adresse text, j date, de time, a time, remarque text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare i uuid;
begin
  perform verifier_fondateur();
  if a = de then raise exception 'L’heure de fin doit être différente de l’heure de début'; end if;
  if not exists (select 1 from admins where lower(email) = lower(adresse)) then raise exception 'Agent introuvable'; end if;
  insert into planning_agents (email, jour, debut, fin, note) values (lower(adresse), j, de, a, nullif(trim(coalesce(remarque, '')), '')) returning id into i;
  return i;
end $$;

-- Déplacer / modifier un créneau (autre jour, autre personne, autres heures)
create or replace function public.admin_planning_modifier(i uuid, adresse text, j date, de time, a time, remarque text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  if a = de then raise exception 'L’heure de fin doit être différente de l’heure de début'; end if;
  if not exists (select 1 from admins where lower(email) = lower(adresse)) then raise exception 'Agent introuvable'; end if;
  update planning_agents set email = lower(adresse), jour = j, debut = de, fin = a,
    note = nullif(trim(coalesce(remarque, '')), ''), modifie_le = now() where id = i;
  if not found then raise exception 'Créneau introuvable'; end if;
end $$;
grant execute on function public.admin_planning_modifier(uuid, text, date, time, time, text) to authenticated;

-- Échanger les personnes de deux créneaux
create or replace function public.admin_planning_echanger(i1 uuid, i2 uuid) returns void
language plpgsql security definer set search_path = public as $$
declare e1 text; e2 text;
begin
  perform verifier_fondateur();
  select email into e1 from planning_agents where id = i1;
  select email into e2 from planning_agents where id = i2;
  if e1 is null or e2 is null then raise exception 'Créneau introuvable'; end if;
  update planning_agents set email = e2, modifie_le = now() where id = i1;
  update planning_agents set email = e1, modifie_le = now() where id = i2;
end $$;
grant execute on function public.admin_planning_echanger(uuid, uuid) to authenticated;

-- Remplir une période d'un coup (génération automatique). « remplacer » efface d'abord
-- les créneaux existants de ces personnes sur la période.
create or replace function public.admin_planning_generer(du date, au date, lignes jsonb, remplacer boolean default true) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  perform verifier_fondateur();
  if jsonb_typeof(lignes) <> 'array' or jsonb_array_length(lignes) > 500 then raise exception 'Liste invalide'; end if;
  if au < du or au - du > 62 then raise exception 'Période invalide'; end if;
  if remplacer then
    delete from planning_agents p where p.jour between du and au
      and lower(p.email) in (select lower(x ->> 'email') from jsonb_array_elements(lignes) x);
  end if;
  insert into planning_agents (email, jour, debut, fin, note)
  select lower(x ->> 'email'), (x ->> 'jour')::date, (x ->> 'debut')::time, (x ->> 'fin')::time, nullif(trim(coalesce(x ->> 'note', '')), '')
  from jsonb_array_elements(lignes) x
  where (x ->> 'jour')::date between du and au and (x ->> 'debut') <> (x ->> 'fin')
    and exists (select 1 from admins a where lower(a.email) = lower(x ->> 'email'));
  get diagnostics n = row_count;
  perform journaliser_admin('Planning généré', du || ' → ' || au, n || ' créneaux');
  return n;
end $$;
grant execute on function public.admin_planning_generer(date, date, jsonb, boolean) to authenticated;

-- Lien d'agenda : chacun récupère le sien ; le fondateur peut récupérer celui d'un agent
create or replace function public.planning_jeton_pour(adresse text) returns text
language plpgsql security definer set search_path = public as $$
declare j text;
begin
  select planning_jeton into j from admins where lower(email) = lower(adresse);
  if j is null then
    j := encode(extensions.gen_random_bytes(18), 'hex');
    update admins set planning_jeton = j where lower(email) = lower(adresse);
  end if;
  return j;
end $$;
revoke all on function public.planning_jeton_pour(text) from public, anon, authenticated;

create or replace function public.mon_lien_planning() returns text
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_admin();
  return planning_jeton_pour(auth.jwt() ->> 'email');
end $$;
grant execute on function public.mon_lien_planning() to authenticated;

create or replace function public.admin_lien_planning(adresse text, nouveau boolean default false) returns text
language plpgsql security definer set search_path = public as $$
begin
  if lower(adresse) <> lower(coalesce(auth.jwt() ->> 'email', '')) then perform verifier_fondateur(); else perform verifier_admin(); end if;
  if not exists (select 1 from admins where lower(email) = lower(adresse)) then raise exception 'Agent introuvable'; end if;
  -- « nouveau » : l'ancien lien ne marche plus (si un téléphone a été perdu, par exemple)
  if nouveau then update admins set planning_jeton = null where lower(email) = lower(adresse); end if;
  return planning_jeton_pour(adresse);
end $$;
grant execute on function public.admin_lien_planning(text, boolean) to authenticated;
