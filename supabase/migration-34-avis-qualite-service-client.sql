-- =====================================================================
-- COTIZ — MISE À JOUR n°34 : AVIS DES CLIENTS ET QUALITÉ DU SERVICE CLIENT
-- • À la fin de chaque conversation, le client donne une note (1 à 5 étoiles)
--   et un commentaire. S'il n'est pas satisfait (1 ou 2 étoiles), il peut
--   rouvrir la conversation.
-- • On garde la trace : qui a fermé, quand, délai de la 1re réponse.
-- • Le fondateur voit un tableau de qualité par agent.
-- Supabase > SQL Editor > New query > coller TOUT > Run  →  « Success »
-- Relançable sans danger. À lancer APRÈS la n°33.
-- =====================================================================

alter table public.requetes_clients add column if not exists premiere_reponse_le timestamptz;
alter table public.requetes_clients add column if not exists fermee_le timestamptz;
alter table public.requetes_clients add column if not exists fermee_par text;
alter table public.requetes_clients add column if not exists note smallint check (note between 1 and 5);
alter table public.requetes_clients add column if not exists avis text;
alter table public.requetes_clients add column if not exists avis_le timestamptz;
alter table public.requetes_clients add column if not exists rouverte_par_client integer not null default 0;

-- Reprise de l'historique
update requetes_clients r set premiere_reponse_le = (select min(m.cree_le) from requetes_messages m where m.requete_id = r.id and m.auteur = 'agent')
where premiere_reponse_le is null;
update requetes_clients set fermee_le = maj_le, fermee_par = agent_email where statut = 'resolue' and fermee_le is null;

-- L'agent répond (même chose qu'avant + traçabilité)
create or replace function public.admin_requete_repondre(r uuid, texte text, resoudre boolean default true) returns void
language plpgsql security definer set search_path = public as $$
declare q requetes_clients;
begin
  perform verifier_admin();
  if length(trim(coalesce(texte, ''))) < 2 then raise exception 'Écris une réponse'; end if;
  if not exists (select 1 from requetes_clients where id = r) then raise exception 'Requête introuvable'; end if;
  insert into requetes_messages (requete_id, auteur, agent_email, texte) values (r, 'agent', auth.jwt() ->> 'email', left(trim(texte), 2000));
  update requetes_clients set reponse = trim(texte), agent_email = coalesce(agent_email, auth.jwt() ->> 'email'),
    statut = case when resoudre then 'resolue' else 'en_cours' end, dernier_auteur = 'agent', nb_messages = nb_messages + 1, maj_le = now(),
    premiere_reponse_le = coalesce(premiere_reponse_le, now()),
    fermee_le = case when resoudre then now() else null end,
    fermee_par = case when resoudre then auth.jwt() ->> 'email' else null end
  where id = r returning * into q;
  insert into notifications (profile_id, type, titre, texte, lien)
  values (q.profile_id, 'service_client', case when resoudre then 'Le service client a répondu : donne ton avis' else 'Nouveau message du service client' end,
          left(trim(texte), 300), '/aide#mes-requetes');
end $$;

create or replace function public.admin_requete_fermer(r uuid, fermer boolean default true) returns void
language plpgsql security definer set search_path = public as $$
declare q requetes_clients;
begin
  perform verifier_admin();
  update requetes_clients set statut = case when fermer then 'resolue' else 'en_cours' end,
    agent_email = coalesce(agent_email, auth.jwt() ->> 'email'), maj_le = now(),
    fermee_le = case when fermer then now() else null end,
    fermee_par = case when fermer then auth.jwt() ->> 'email' else null end
  where id = r returning * into q;
  if fermer and q.id is not null then
    insert into notifications (profile_id, type, titre, texte, lien)
    values (q.profile_id, 'service_client', 'Conversation fermée : donne ton avis', 'Dis-nous comment le service client t''a aidé.', '/aide#mes-requetes');
  end if;
  perform journaliser_admin(case when fermer then 'Conversation fermée' else 'Conversation rouverte' end, 'requête n°' || q.numero, null);
end $$;

-- Le client note la conversation (une fois, modifiable pendant 7 jours) ; 1 ou 2 étoiles : il peut la rouvrir
create or replace function public.requete_noter(r uuid, note integer, commentaire text default null, rouvrir boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare q requetes_clients;
begin
  select * into q from requetes_clients where id = r and profile_id = auth.uid();
  if q.id is null then raise exception 'Conversation introuvable'; end if;
  if q.statut <> 'resolue' then raise exception 'Tu pourras donner ton avis quand la conversation sera fermée.'; end if;
  if note not between 1 and 5 then raise exception 'Choisis entre 1 et 5 étoiles'; end if;
  if q.avis_le is not null and q.avis_le < now() - interval '7 days' then raise exception 'Le délai pour modifier ton avis est passé.'; end if;
  update requetes_clients set note = requete_noter.note, avis = left(nullif(trim(commentaire), ''), 500), avis_le = now() where id = r;
  if rouvrir and requete_noter.note <= 2 then
    if q.rouverte_par_client >= 2 then raise exception 'Cette conversation a déjà été rouverte 2 fois. Écris un nouveau message.'; end if;
    insert into requetes_messages (requete_id, auteur, texte)
    values (r, 'client', 'Je ne suis pas satisfait (' || requete_noter.note || '/5)' || coalesce(' : ' || left(nullif(trim(commentaire), ''), 500), '.') || ' Je rouvre la conversation.');
    update requetes_clients set statut = 'en_cours', dernier_auteur = 'client', nb_messages = nb_messages + 1, maj_le = now(),
      fermee_le = null, fermee_par = null, rouverte_par_client = rouverte_par_client + 1 where id = r;
  end if;
end $$;
revoke all on function public.requete_noter(uuid, integer, text, boolean) from public, anon;
grant execute on function public.requete_noter(uuid, integer, text, boolean) to authenticated;

-- Tableau de qualité (fondateur) : par agent, sur une période
create or replace function public.admin_qualite(du date, au date) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  return json_build_object(
    'non_finalisees', (select count(*) from requetes_clients where statut <> 'resolue'),
    'finalisees', (select count(*) from requetes_clients where statut = 'resolue' and fermee_le::date between du and au),
    'notes', (select json_build_object('n', count(note), 'moyenne', round(avg(note)::numeric, 2),
                'n1', count(*) filter (where note = 1), 'n2', count(*) filter (where note = 2), 'n3', count(*) filter (where note = 3),
                'n4', count(*) filter (where note = 4), 'n5', count(*) filter (where note = 5))
              from requetes_clients where avis_le::date between du and au),
    'delai_reponse_min', (select round(avg(extract(epoch from premiere_reponse_le - cree_le) / 60)::numeric) from requetes_clients
                          where premiere_reponse_le is not null and cree_le::date between du and au),
    'agents', (select coalesce(json_agg(x order by x.traitees desc), '[]') from (
      select coalesce(r.fermee_par, r.agent_email) as email, a.nom, a.numero,
        count(*) filter (where r.statut = 'resolue') as traitees,
        count(*) filter (where r.statut <> 'resolue') as en_cours,
        count(r.note) as nb_notes,
        round(avg(r.note)::numeric, 2) as moyenne,
        count(*) filter (where r.note <= 2) as mauvaises,
        count(*) filter (where r.rouverte_par_client > 0) as rouvertes,
        round(avg(extract(epoch from r.premiere_reponse_le - r.cree_le) / 60)::numeric) as delai_reponse_min,
        round(avg(extract(epoch from r.fermee_le - r.cree_le) / 3600)::numeric, 1) as delai_fermeture_h
      from requetes_clients r left join admins a on lower(a.email) = lower(coalesce(r.fermee_par, r.agent_email))
      where coalesce(r.fermee_par, r.agent_email) is not null and r.cree_le::date between du and au
      group by coalesce(r.fermee_par, r.agent_email), a.nom, a.numero) x)
  );
end $$;
grant execute on function public.admin_qualite(date, date) to authenticated;
