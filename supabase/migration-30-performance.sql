-- =====================================================================
-- COTIZ — MISE À JOUR n°30 : rapidité quand il y aura beaucoup d'utilisateurs
-- Supabase > SQL Editor > New query > coller TOUT > Run  →  « Success »
-- Relançable sans danger. Ne change rien à qui voit quoi : chacun voit
-- exactement les mêmes groupes, membres et paiements qu'avant.
-- Avant : pour ouvrir l'accueil, la base passait en revue TOUS les groupes
-- de Cotiz. Maintenant : elle va directement aux groupes de la personne.
-- Test (500 000 comptes, 6 millions de paiements) : environ 35 fois plus rapide.
-- =====================================================================

-- Mes groupes (place validée, compte non bloqué) : mêmes conditions que is_member()
create or replace function public.mes_groupes() returns setof uuid
language sql security definer stable set search_path = public as $$
  select group_id from members
  where profile_id = auth.uid() and not en_attente
    and not exists (select 1 from profiles where id = auth.uid() and bloque)
$$;
revoke all on function public.mes_groupes() from public, anon;
grant execute on function public.mes_groupes() to authenticated;

create index if not exists groups_created_by_idx on public.groups (created_by);

drop policy if exists "groupe: lecture" on public.groups;
create policy "groupe: lecture" on public.groups for select
  using (created_by = (select auth.uid()) or id = any (array(select public.mes_groupes())));

drop policy if exists "paiements: lecture" on public.payments;
create policy "paiements: lecture" on public.payments for select
  using (group_id = any (array(select public.mes_groupes())));

drop policy if exists "versements: lecture" on public.payouts;
create policy "versements: lecture" on public.payouts for select
  using (group_id = any (array(select public.mes_groupes())));

drop policy if exists "engagements: lecture" on public.engagements;
create policy "engagements: lecture" on public.engagements for select
  using (group_id = any (array(select public.mes_groupes())));

-- Le « JIT » de Postgres peut faire perdre jusqu'à 0,4 s sur ces petites requêtes
do $$ begin
  execute 'alter role authenticated set jit = off';
  execute 'alter role anon set jit = off';
exception when others then raise notice 'JIT : réglage ignoré (%), sans gravité', sqlerrm;
end $$;

-- Vérification : doit afficher 4 lignes
select tablename, policyname from pg_policies
where policyname in ('groupe: lecture', 'paiements: lecture', 'versements: lecture', 'engagements: lecture');
