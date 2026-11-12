-- =====================================================================
-- COTIZ — OUTIL : DONNER L'ACCÈS ADMINISTRATEUR À UNE ADRESSE E-MAIL
-- 1. Crée d'abord le compte dans Supabase > Authentication > Users >
--    Add user > Create new user (e-mail + mot de passe, coche Auto Confirm).
-- 2. Remplace l'adresse ci-dessous par la sienne, puis Run.
--    role : 'fondateur' (tous les pouvoirs) ou 'agent' (service client).
-- Astuce : pour un agent, utilise plutôt /admin → Équipe → Ajouter.
-- =====================================================================
insert into public.admins (email, role)
values ('adresse@exemple.com', 'fondateur')
on conflict (email) do update set role = excluded.role;

-- Vérifier qui a accès :
select email, role, numero from public.admins order by numero;
