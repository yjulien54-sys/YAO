-- =====================================================================
-- COTIZ — REMISE À ZÉRO COMPLÈTE (repartir de zéro)
-- Supprime TOUS les comptes utilisateurs, TOUS les groupes, paiements,
-- versements, codes secrets, notifications et l'historique.
-- GARDE : les comptes de l'équipe (table admins : fondateur et agents), leur
-- planning et leurs salaires, le journal admin, les réglages et les annonces.
-- ⚠️ DÉFINITIF : rien ne peut être récupéré après.
-- Supabase > SQL Editor > New query (vide) > coller > Run
-- =====================================================================
begin;

-- Groupes et tout ce qui s'y rattache
delete from public.notifications;
delete from public.validations_versement;
delete from public.demandes_versement;
delete from public.payouts;
delete from public.payments;
delete from public.engagements;
delete from public.groups;            -- supprime aussi les membres

-- Codes secrets, demandes « code oublié », tentatives de connexion
delete from public.codes_historique;
delete from public.codes_secrets;
delete from public.demandes_reinitialisation;
delete from public.tentatives_connexion;

-- Profils et comptes (sauf le compte administrateur)
delete from public.profiles
 where id in (select id from auth.users
              where email is null or lower(email) not in (select lower(email) from public.admins));
delete from auth.users
 where email is null or lower(email) not in (select lower(email) from public.admins);

-- Requêtes des clients et dossiers du service client (si les mises à jour 17 et 18 sont faites)
do $$ begin
  if to_regclass('public.requetes_clients') is not null then delete from public.requetes_clients; end if;
  if to_regclass('public.dossiers_admin') is not null then delete from public.dossiers_admin; end if;
end $$;

-- Historique de sécurité (en dernier : les suppressions ci-dessus y écrivent)
delete from public.journal;

commit;

-- Vérification : il ne doit rester que ton compte administrateur
select (select count(*) from auth.users) as comptes_restants,
       (select count(*) from public.profiles) as profils,
       (select count(*) from public.groups) as groupes;
