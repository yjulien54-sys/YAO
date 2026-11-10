-- =====================================================================
-- COTIZ — Mise à jour n°9 : code oublié, réinitialisation automatique
-- À lancer APRÈS la mise à jour n°8.
-- Supabase > SQL Editor > New query (vide) > coller > Run
-- =====================================================================
-- La personne donne son nom et prénom + sa date de naissance.
-- Si c'est juste, le serveur efface son code tout de suite et l'application
-- lui demande un nouveau code. 3 essais par jour. Chaque demande est enregistrée.

alter table public.profiles add column if not exists date_naissance date;

-- La date de naissance ne peut plus être modifiée une fois enregistrée
-- (sinon on pourrait la changer pour réinitialiser le code d'un autre).
create or replace function public.garde_naissance() returns trigger
language plpgsql as $$
begin
  if old.date_naissance is not null and new.date_naissance is distinct from old.date_naissance then
    raise exception 'La date de naissance ne peut pas être modifiée. Contacte le service client.';
  end if;
  return new;
end $$;
drop trigger if exists garde_naissance on public.profiles;
create trigger garde_naissance before update on public.profiles
  for each row execute function public.garde_naissance();

-- Enregistrer sa date de naissance (une seule fois)
create or replace function public.definir_naissance(d date) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if d is null or d > current_date - interval '10 years' or d < date '1900-01-01' then
    raise exception 'Date de naissance invalide';
  end if;
  update profiles set date_naissance = d where id = auth.uid() and date_naissance is null;
  return found;
end $$;

-- Registre des demandes « code oublié » (lisible seulement par toi, dans Supabase)
create table if not exists public.demandes_reinitialisation (
  id bigserial primary key,
  profile_id uuid references public.profiles(id) on delete cascade,
  nom_saisi text,
  naissance_saisie date,
  resultat text not null check (resultat in ('reussie', 'echouee', 'bloquee', 'sans_naissance')),
  le timestamptz not null default now()
);
alter table public.demandes_reinitialisation enable row level security;

-- Nom comparé sans accents, sans majuscules, et dans n'importe quel ordre (« Yao Julien » = « julien YAO »)
create or replace function public.nom_normalise(n text) returns text
language sql immutable as $$
  select coalesce(string_agg(m, ' ' order by m), '')
  from unnest(regexp_split_to_array(
    trim(regexp_replace(translate(lower(coalesce(n, '')),
      'àâäáãçéèêëíìîïñóòôöõúùûüýÿœ', 'aaaaaceeeeiiiinooooouuuuyyo'), '[^a-z0-9]+', ' ', 'g')), ' ')) as m
  where m <> ''
$$;

-- Vérification instantanée : si c'est la bonne personne, le code est effacé
-- et l'application demande tout de suite un nouveau code.
create or replace function public.reinitialiser_par_naissance(nom text, naissance date) returns json
language plpgsql security definer set search_path = public as $$
declare p profiles; n integer;
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  select * into p from profiles where id = auth.uid();

  select count(*) into n from demandes_reinitialisation
   where profile_id = auth.uid() and resultat in ('echouee', 'bloquee') and le > now() - interval '24 hours';
  if n >= 3 then
    insert into demandes_reinitialisation (profile_id, nom_saisi, naissance_saisie, resultat) values (auth.uid(), nom, naissance, 'bloquee');
    return json_build_object('ok', false, 'raison', 'bloquee', 'restants', 0);
  end if;

  if p.date_naissance is null then
    insert into demandes_reinitialisation (profile_id, nom_saisi, naissance_saisie, resultat) values (auth.uid(), nom, naissance, 'sans_naissance');
    return json_build_object('ok', false, 'raison', 'sans_naissance', 'restants', 3 - n);
  end if;

  if p.date_naissance = naissance and nom_normalise(p.name) = nom_normalise(nom) then
    update codes_secrets set hash = null, essais = 0, bloque_jusqua = null, modifie_le = now() where profile_id = auth.uid();
    insert into codes_historique (profile_id, action) values (auth.uid(), 'reinitialisation');
    insert into demandes_reinitialisation (profile_id, nom_saisi, naissance_saisie, resultat) values (auth.uid(), nom, naissance, 'reussie');
    return json_build_object('ok', true);
  end if;

  insert into demandes_reinitialisation (profile_id, nom_saisi, naissance_saisie, resultat) values (auth.uid(), nom, naissance, 'echouee');
  return json_build_object('ok', false, 'raison', 'faux', 'restants', greatest(0, 2 - n));
end $$;

-- L'état du code indique aussi si la date de naissance est connue
create or replace function public.code_etat() returns json
language plpgsql security definer set search_path = public as $$
declare c codes_secrets; p profiles;
begin
  select * into c from codes_secrets where profile_id = auth.uid();
  select * into p from profiles where id = auth.uid();
  return json_build_object(
    'defini', c.hash is not null,
    'modifie_le', c.modifie_le,
    'attente', greatest(0, ceil(extract(epoch from (coalesce(c.bloque_jusqua, now()) - now()))))::int,
    'naissance', p.date_naissance is not null
  );
end $$;

grant execute on function public.definir_naissance(date), public.reinitialiser_par_naissance(text, date), public.code_etat() to authenticated;

-- ---------------------------------------------------------------------
-- Voir les demandes « code oublié » :
--   select d.le, p.name, p.phone, d.nom_saisi, d.naissance_saisie, d.resultat
--   from demandes_reinitialisation d left join profiles p on p.id = d.profile_id
--   order by d.le desc limit 50;
-- ---------------------------------------------------------------------
