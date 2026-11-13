-- =====================================================================
-- COTIZ — MISE À JOUR n°33 : SERVICE CLIENT EN CONVERSATION
-- Une requête devient un fil de discussion : le client et l'agent s'écrivent
-- dans le même fil tant que l'agent ne l'a pas fermé (plus besoin de refaire
-- une nouvelle requête pour donner une information demandée).
-- Les anciennes requêtes et réponses sont reprises dans leur fil.
-- Supabase > SQL Editor > New query > coller TOUT > Run  →  « Success »
-- Relançable sans danger. À lancer APRÈS la n°18 (et de préférence la n°32).
-- =====================================================================

create table if not exists public.requetes_messages (
  id uuid primary key default gen_random_uuid(),
  requete_id uuid not null references public.requetes_clients on delete cascade,
  cree_le timestamptz not null default now(),
  auteur text not null check (auteur in ('client', 'agent')),
  agent_email text,
  texte text not null check (length(texte) between 1 and 2000)
);
create index if not exists requetes_messages_fil_idx on public.requetes_messages (requete_id, cree_le);
alter table public.requetes_messages enable row level security;

-- Le client lit les messages de SES requêtes ; il écrit seulement par la fonction requete_ecrire()
drop policy if exists "messages: lire les miens" on public.requetes_messages;
create policy "messages: lire les miens" on public.requetes_messages for select
  using (exists (select 1 from requetes_clients r where r.id = requete_id and r.profile_id = auth.uid()));
grant select on public.requetes_messages to authenticated;

-- Qui a écrit en dernier (pour afficher « nouveau message du client » côté agent)
alter table public.requetes_clients add column if not exists dernier_auteur text default 'client';
alter table public.requetes_clients add column if not exists nb_messages integer not null default 1;

-- Reprise des anciennes requêtes : le message du client, puis la réponse de l'agent
insert into requetes_messages (requete_id, cree_le, auteur, texte)
select r.id, r.cree_le, 'client', r.message from requetes_clients r
where not exists (select 1 from requetes_messages m where m.requete_id = r.id);
insert into requetes_messages (requete_id, cree_le, auteur, agent_email, texte)
select r.id, greatest(r.maj_le, r.cree_le + interval '1 second'), 'agent', r.agent_email, r.reponse from requetes_clients r
where r.reponse is not null and not exists (select 1 from requetes_messages m where m.requete_id = r.id and m.auteur = 'agent');
update requetes_clients r set
  nb_messages = (select count(*) from requetes_messages m where m.requete_id = r.id),
  dernier_auteur = coalesce((select m.auteur from requetes_messages m where m.requete_id = r.id order by m.cree_le desc limit 1), 'client');

-- Une nouvelle requête crée aussi le 1er message de son fil
create or replace function public.requete_premier_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into requetes_messages (requete_id, cree_le, auteur, texte) values (new.id, new.cree_le, 'client', new.message);
  return new;
end $$;
drop trigger if exists requete_premier_message on public.requetes_clients;
create trigger requete_premier_message after insert on public.requetes_clients for each row execute function public.requete_premier_message();

-- Le client répond dans le même fil (tant que la conversation n'est pas fermée)
create or replace function public.requete_ecrire(r uuid, texte text) returns void
language plpgsql security definer set search_path = public as $$
declare q requetes_clients;
begin
  select * into q from requetes_clients where id = r and profile_id = auth.uid();
  if q.id is null then raise exception 'Conversation introuvable'; end if;
  if q.statut = 'resolue' then raise exception 'Cette conversation est fermée. Écris un nouveau message au service client.'; end if;
  if length(trim(coalesce(texte, ''))) < 1 then raise exception 'Écris ton message'; end if;
  -- 20 messages maximum par heure et par personne
  if (select count(*) from requetes_messages m join requetes_clients c on c.id = m.requete_id
      where c.profile_id = auth.uid() and m.auteur = 'client' and m.cree_le > now() - interval '1 hour') >= 20 then
    raise exception 'Tu as envoyé beaucoup de messages. L''agent te répond bientôt.';
  end if;
  insert into requetes_messages (requete_id, auteur, texte) values (r, 'client', left(trim(texte), 2000));
  update requetes_clients set dernier_auteur = 'client', nb_messages = nb_messages + 1, maj_le = now() where id = r;
end $$;
revoke all on function public.requete_ecrire(uuid, text) from public, anon;
grant execute on function public.requete_ecrire(uuid, text) to authenticated;

-- L'agent lit le fil
create or replace function public.admin_requete_messages(r uuid) returns setof public.requetes_messages
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_admin();
  return query select * from requetes_messages where requete_id = r order by cree_le;
end $$;
grant execute on function public.admin_requete_messages(uuid) to authenticated;

-- L'agent répond dans le fil ; « resoudre » ferme la conversation
create or replace function public.admin_requete_repondre(r uuid, texte text, resoudre boolean default true) returns void
language plpgsql security definer set search_path = public as $$
declare q requetes_clients;
begin
  perform verifier_admin();
  if length(trim(coalesce(texte, ''))) < 2 then raise exception 'Écris une réponse'; end if;
  if not exists (select 1 from requetes_clients where id = r) then raise exception 'Requête introuvable'; end if;
  insert into requetes_messages (requete_id, auteur, agent_email, texte) values (r, 'agent', auth.jwt() ->> 'email', left(trim(texte), 2000));
  update requetes_clients set reponse = trim(texte), agent_email = coalesce(agent_email, auth.jwt() ->> 'email'),
    statut = case when resoudre then 'resolue' else 'en_cours' end, dernier_auteur = 'agent', nb_messages = nb_messages + 1, maj_le = now()
  where id = r returning * into q;
  if q.id is null then raise exception 'Requête introuvable'; end if;
  insert into notifications (profile_id, type, titre, texte, lien)
  values (q.profile_id, 'service_client', case when resoudre then 'Le service client a répondu (conversation fermée)' else 'Nouveau message du service client' end,
          left(trim(texte), 300), '/aide#mes-requetes');
end $$;

-- Fermer ou rouvrir une conversation sans écrire
create or replace function public.admin_requete_fermer(r uuid, fermer boolean default true) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_admin();
  update requetes_clients set statut = case when fermer then 'resolue' else 'en_cours' end,
    agent_email = coalesce(agent_email, auth.jwt() ->> 'email'), maj_le = now()
  where id = r;
end $$;
grant execute on function public.admin_requete_fermer(uuid, boolean) to authenticated;

-- Liste des requêtes : celles où le client a écrit en dernier remontent en haut
create or replace function public.admin_requetes() returns setof public.requetes_clients
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_admin();
  return query select * from requetes_clients
  order by (statut = 'resolue'), (dernier_auteur = 'agent'), (statut = 'en_cours'), maj_le desc limit 500;
end $$;
