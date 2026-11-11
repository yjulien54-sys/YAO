-- =====================================================================
-- COTIZ — MISE À JOUR SQL N°20 : PLANNING VISIBLE PAR TOUTE L'ÉQUIPE
-- Chaque agent voit le planning de tous ses collègues (et peut filtrer
-- pour ne voir que le sien). Seul le fondateur ajoute, modifie ou supprime.
-- À lancer APRÈS la n°19.  Supabase > SQL Editor > New query > Run
-- =====================================================================
create or replace function public.admin_planning(du date, au date) returns table (id uuid, email text, nom text, numero integer, jour date, debut time, fin time, note text)
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_admin();
  return query select p.id, p.email, a.nom, a.numero, p.jour, p.debut, p.fin, p.note
    from planning_agents p left join admins a on lower(a.email) = lower(p.email)
    where p.jour between du and au
    order by p.jour, p.debut;
end $$;
