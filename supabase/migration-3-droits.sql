-- =====================================================================
-- COTIZ — Mise à jour n°3 : droits (trésorier, co-gestionnaires, qui peut ajouter)
-- À coller dans Supabase > SQL Editor > New query (vide) > Run
-- =====================================================================

alter table public.groups add column if not exists wave_link text;
alter table public.groups add column if not exists add_policy text not null default 'tresorier';
do $$ begin
  alter table public.groups add constraint groups_add_policy_check check (add_policy in ('tresorier','gestionnaires','tous'));
exception when duplicate_object then null; end $$;

-- Nouveau rôle : co-gestionnaire
alter table public.members drop constraint if exists members_role_check;
alter table public.members add constraint members_role_check check (role in ('tresorier','gestionnaire','membre'));

-- Trésorier OU co-gestionnaire
create or replace function public.is_gestionnaire(g uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select public.can_manage(g)
      or exists (select 1 from members where group_id = g and profile_id = auth.uid() and role = 'gestionnaire');
$$;

-- Qui peut ajouter des membres, selon le réglage du groupe
create or replace function public.peut_ajouter(g uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select public.can_manage(g)
      or exists (
        select 1 from groups gr where gr.id = g and (
          (gr.add_policy in ('gestionnaires','tous') and exists (select 1 from members where group_id = g and profile_id = auth.uid() and role = 'gestionnaire'))
          or (gr.add_policy = 'tous' and public.is_member(g))
        ));
$$;

-- Règles sur les membres
drop policy if exists "membres: gestion" on public.members;
drop policy if exists "membres: ajout" on public.members;
drop policy if exists "membres: modification" on public.members;
drop policy if exists "membres: retrait" on public.members;
create policy "membres: ajout" on public.members for insert
  with check (public.peut_ajouter(group_id) and (role = 'membre' or public.can_manage(group_id)));
create policy "membres: modification" on public.members for update
  using (public.is_gestionnaire(group_id)) with check (public.is_gestionnaire(group_id));
create policy "membres: retrait" on public.members for delete
  using (public.is_gestionnaire(group_id) and role <> 'tresorier');

-- Garde-fou : seuls le trésorier / créateur changent les rôles
create or replace function public.garde_membres() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not public.can_manage(new.group_id) then
    raise exception 'Seul le trésorier peut changer les rôles';
  end if;
  if new.profile_id is distinct from old.profile_id
     and not public.can_manage(new.group_id)
     and not (old.profile_id is null and new.profile_id = auth.uid()) then
    raise exception 'Modification non autorisée';
  end if;
  return new;
end $$;
drop trigger if exists garde_membres on public.members;
create trigger garde_membres before update on public.members for each row execute function public.garde_membres();

-- Règles sur le groupe : trésorier et co-gestionnaires peuvent modifier…
drop policy if exists "groupe: modification" on public.groups;
create policy "groupe: modification" on public.groups for update
  using (public.is_gestionnaire(id)) with check (public.is_gestionnaire(id));

-- … mais l'argent et les droits restent au trésorier
create or replace function public.garde_groupes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage(new.id) and (
       new.payment_phone is distinct from old.payment_phone
    or new.wave_link     is distinct from old.wave_link
    or new.add_policy    is distinct from old.add_policy
    or new.current_round is distinct from old.current_round
    or new.created_by    is distinct from old.created_by) then
    raise exception 'Seul le trésorier peut modifier ce réglage';
  end if;
  return new;
end $$;
drop trigger if exists garde_groupes on public.groups;
create trigger garde_groupes before update on public.groups for each row execute function public.garde_groupes();

-- ---------------------------------------------------------------------
-- Fréquences : jour, 3 jours, semaine, 2 semaines, mois, 3 mois, 6 mois, an
-- ---------------------------------------------------------------------
alter table public.groups drop constraint if exists groups_frequency_check;
alter table public.groups add constraint groups_frequency_check check (frequency in
  ('quotidienne','3jours','hebdomadaire','2semaines','mensuelle','trimestrielle','semestrielle','annuelle','unique'));

-- ---------------------------------------------------------------------
-- Tirage au sort public (tontine)
-- ---------------------------------------------------------------------
alter table public.groups add column if not exists tirage_prevu timestamptz;
alter table public.groups add column if not exists tirage_fait timestamptz;
alter table public.groups add column if not exists tirage_par text;

create or replace function public.garde_groupes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage(new.id) and (
       new.payment_phone is distinct from old.payment_phone
    or new.wave_link     is distinct from old.wave_link
    or new.add_policy    is distinct from old.add_policy
    or new.current_round is distinct from old.current_round
    or new.created_by    is distinct from old.created_by
    or new.tirage_prevu  is distinct from old.tirage_prevu
    or new.tirage_fait   is distinct from old.tirage_fait
    or new.tirage_par    is distinct from old.tirage_par) then
    raise exception 'Seul le trésorier peut modifier ce réglage';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Reconnaissance par numéro : à la connexion, on rattache automatiquement
-- les places réservées à ce numéro par un trésorier (encore libres).
-- ---------------------------------------------------------------------
create or replace function public.rattacher_par_numero() returns integer
language plpgsql security definer set search_path = public as $$
declare p profiles; n integer;
begin
  select * into p from profiles where id = auth.uid();
  if p is null then return 0; end if;
  update members set profile_id = auth.uid()
   where profile_id is null
     and length(regexp_replace(p.phone, '\D', '', 'g')) >= 8
     and right(regexp_replace(phone, '\D', '', 'g'), 10) = right(regexp_replace(p.phone, '\D', '', 'g'), 10);
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.rattacher_par_numero() to authenticated;

-- Rejoindre par lien : rattache aussi toutes les parts de la personne
create or replace function public.join_group(g uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare p profiles; m_id uuid;
begin
  select * into p from profiles where id = auth.uid();
  if p is null then raise exception 'profil manquant'; end if;
  if not exists (select 1 from groups where id = g) then raise exception 'groupe introuvable'; end if;
  update members set profile_id = auth.uid()
   where group_id = g and profile_id is null
     and right(regexp_replace(phone,'\D','','g'),10) = right(regexp_replace(p.phone,'\D','','g'),10);
  select id into m_id from members where group_id = g and profile_id = auth.uid() order by turn_position limit 1;
  if m_id is not null then return m_id; end if;
  insert into members (group_id, profile_id, name, phone, role, turn_position)
  values (g, auth.uid(), p.name, p.phone, 'membre',
          coalesce((select max(turn_position) + 1 from members where group_id = g), 0))
  returning id into m_id;
  return m_id;
end $$;
