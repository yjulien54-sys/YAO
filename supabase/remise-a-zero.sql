-- =====================================================================
-- COTIZ — Remise à zéro des données (ATTENTION : définitif)
-- Efface tous les groupes, membres, paiements, versements, engagements,
-- profils et comptes de test (connexions anonymes).
-- GARDE : la structure (tables, règles de sécurité) et les annonces.
-- =====================================================================

delete from public.groups;      -- efface aussi membres, paiements, versements, engagements (cascade)
delete from public.profiles;
delete from auth.users where is_anonymous = true;   -- comptes créés par « nom + numéro »
