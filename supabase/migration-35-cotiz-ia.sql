-- =====================================================================
-- COTIZ — MISE À JOUR n°35 : COTIZ IA (agent IA du service client)
-- • Chaque nouvelle requête est d'abord lue par « Cotiz IA » : elle répond
--   aux questions d'utilisation ; si la demande touche aux données (paiement
--   à confirmer, numéro à changer, fraude, remboursement…), elle transmet à
--   un agent humain avec la raison.
-- • Les conversations de Cotiz IA sont séparées de celles du personnel et le
--   fondateur les vérifie (case « Vérifié »).
-- Supabase > SQL Editor > New query > coller TOUT > Run  →  « Success »
-- Relançable sans danger. À lancer APRÈS la n°34.
-- =====================================================================

-- L'auteur d'un message peut être le client, un agent ou Cotiz IA
alter table public.requetes_messages drop constraint if exists requetes_messages_auteur_check;
alter table public.requetes_messages add constraint requetes_messages_auteur_check check (auteur in ('client', 'agent', 'ia'));

alter table public.requetes_clients add column if not exists ia_statut text check (ia_statut in ('en_cours', 'transmis', 'resolu'));
alter table public.requetes_clients add column if not exists ia_raison text;
alter table public.requetes_clients add column if not exists ia_messages integer not null default 0;
alter table public.requetes_clients add column if not exists ia_verifiee boolean not null default false;
alter table public.requetes_clients add column if not exists ia_verifiee_par text;
alter table public.requetes_clients add column if not exists ia_verifiee_le timestamptz;

-- Cotiz IA écrit dans le fil (appelée par le serveur de l'application avec la clé « service_role »)
create or replace function public.ia_requete_ecrire(r uuid, texte text, transmettre boolean, raison text default null, resoudre boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare q requetes_clients;
begin
  select * into q from requetes_clients where id = r;
  if q.id is null then raise exception 'Requête introuvable'; end if;
  -- Un agent humain a déjà pris la main : l'IA n'écrit plus
  if q.ia_statut = 'transmis' or (q.agent_email is not null and q.agent_email <> 'cotiz-ia') then return; end if;
  insert into requetes_messages (requete_id, auteur, agent_email, texte) values (r, 'ia', 'cotiz-ia', left(trim(texte), 2000));
  update requetes_clients set
    dernier_auteur = case when transmettre then 'client' else 'agent' end,
    nb_messages = nb_messages + 1, ia_messages = ia_messages + 1, maj_le = now(),
    premiere_reponse_le = coalesce(premiere_reponse_le, now()),
    ia_statut = case when transmettre then 'transmis' when resoudre then 'resolu' else 'en_cours' end,
    ia_raison = case when transmettre then left(raison, 300) else ia_raison end,
    agent_email = case when transmettre then null else 'cotiz-ia' end,
    statut = case when transmettre then 'nouvelle' when resoudre then 'resolue' else 'en_cours' end,
    fermee_le = case when resoudre and not transmettre then now() else fermee_le end,
    fermee_par = case when resoudre and not transmettre then 'cotiz-ia' else fermee_par end
  where id = r;
  insert into notifications (profile_id, type, titre, texte, lien)
  values (q.profile_id, 'service_client', case when transmettre then 'Ta demande est transmise à un conseiller' else 'Cotiz IA t''a répondu' end,
          left(trim(texte), 300), '/aide#mes-requetes');
end $$;
revoke all on function public.ia_requete_ecrire(uuid, text, boolean, text, boolean) from public, anon, authenticated;
grant execute on function public.ia_requete_ecrire(uuid, text, boolean, text, boolean) to service_role;

-- Quand un agent répond dans une conversation de l'IA, il prend la main
create or replace function public.requete_agent_prend_la_main() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.auteur = 'agent' then
    update requetes_clients set
      ia_statut = case when ia_statut in ('en_cours', 'resolu') then 'transmis' else ia_statut end,
      ia_raison = case when ia_statut in ('en_cours', 'resolu') then coalesce(ia_raison, 'Repris par un agent') else ia_raison end,
      agent_email = case when agent_email is null or agent_email = 'cotiz-ia' then new.agent_email else agent_email end
    where id = new.requete_id;
  end if;
  return new;
end $$;
drop trigger if exists requete_agent_prend_la_main on public.requetes_messages;
create trigger requete_agent_prend_la_main after insert on public.requetes_messages for each row execute function public.requete_agent_prend_la_main();

-- Revue du matin : le fondateur marque une conversation de Cotiz IA comme vérifiée
create or replace function public.admin_requete_ia_verifier(r uuid, ok boolean default true) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  update requetes_clients set ia_verifiee = ok, ia_verifiee_par = case when ok then auth.jwt() ->> 'email' end, ia_verifiee_le = case when ok then now() end where id = r;
end $$;
grant execute on function public.admin_requete_ia_verifier(uuid, boolean) to authenticated;

-- Réglage : Cotiz IA allumée ou éteinte (lecture publique pour que l'application sache s'il faut l'appeler)
create or replace function public.admin_ia_activer(actif boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  insert into parametres_app (cle, valeur, maj_le, maj_par) values ('cotiz_ia_actif', case when actif then 'oui' else 'non' end, now(), auth.jwt() ->> 'email')
  on conflict (cle) do update set valeur = excluded.valeur, maj_le = now(), maj_par = excluded.maj_par;
  perform journaliser_admin('Réglage modifié', 'Cotiz IA', case when actif then 'allumée' else 'éteinte' end);
end $$;
grant execute on function public.admin_ia_activer(boolean) to authenticated;

-- État du réglage (pour l'interrupteur de l'admin)
create or replace function public.admin_ia_etat() returns text
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_admin();
  return coalesce((select valeur from parametres_app where cle = 'cotiz_ia_actif'), 'oui');
end $$;
grant execute on function public.admin_ia_etat() to authenticated;
