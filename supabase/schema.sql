-- =====================================================================
-- COTIZ : script à coller dans Supabase > SQL Editor > New query > Run
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Tables ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  phone text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('tontine','association','collecte')),
  description text,
  amount integer not null default 0,
  frequency text not null check (frequency in ('hebdomadaire','mensuelle','unique')),
  start_date timestamptz not null,
  penalty integer not null default 0,
  target integer,
  current_round integer not null default 1,
  created_by uuid not null default auth.uid() references auth.users,
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups on delete cascade,
  profile_id uuid references auth.users on delete set null,
  name text not null,
  phone text not null default '',
  role text not null default 'membre' check (role in ('tresorier','membre')),
  turn_position integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists members_group_idx on public.members (group_id);
create index if not exists members_profile_idx on public.members (profile_id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups on delete cascade,
  member_id uuid not null references public.members on delete cascade,
  round integer not null,
  amount integer not null,
  penalty integer not null default 0,
  method text not null check (method in ('wave','orange','mtn','moov','especes')),
  reference text not null unique,
  created_by uuid default auth.uid() references auth.users,
  created_at timestamptz not null default now()
);
create index if not exists payments_group_idx on public.payments (group_id, round);

-- ---------- Fonctions d'accès ----------
create or replace function public.is_member(g uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from members where group_id = g and profile_id = auth.uid());
$$;

create or replace function public.can_manage(g uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from groups where id = g and created_by = auth.uid())
      or exists (select 1 from members where group_id = g and profile_id = auth.uid() and role = 'tresorier');
$$;

-- Rejoindre un groupe via le lien d'invitation
create or replace function public.join_group(g uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare p profiles; m_id uuid;
begin
  select * into p from profiles where id = auth.uid();
  if p is null then raise exception 'profil manquant'; end if;
  if not exists (select 1 from groups where id = g) then raise exception 'groupe introuvable'; end if;
  select id into m_id from members where group_id = g and profile_id = auth.uid();
  if m_id is not null then return m_id; end if;
  -- membre ajouté par le trésorier avec le même numéro : on le relie
  update members set profile_id = auth.uid()
    where id = (select id from members where group_id = g and profile_id is null
                and right(regexp_replace(phone,'\D','','g'),10) = right(regexp_replace(p.phone,'\D','','g'),10) limit 1)
    returning id into m_id;
  if m_id is null then
    insert into members (group_id, profile_id, name, phone, role, turn_position)
    values (g, auth.uid(), p.name, p.phone, 'membre',
            coalesce((select max(turn_position) + 1 from members where group_id = g), 0))
    returning id into m_id;
  end if;
  return m_id;
end $$;

-- Aperçu public d'un groupe (page d'invitation)
create or replace function public.group_preview(g uuid)
returns table (name text, type text, members_count bigint)
language sql security definer stable set search_path = public as $$
  select gr.name, gr.type, (select count(*) from members where group_id = gr.id) from groups gr where gr.id = g;
$$;

-- ---------- Sécurité (RLS) ----------
alter table public.profiles enable row level security;
alter table public.groups   enable row level security;
alter table public.members  enable row level security;
alter table public.payments enable row level security;

drop policy if exists "profil: lecture" on public.profiles;
drop policy if exists "profil: écriture" on public.profiles;
create policy "profil: lecture"  on public.profiles for select using (id = auth.uid());
create policy "profil: écriture" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "groupe: lecture" on public.groups;
drop policy if exists "groupe: création" on public.groups;
drop policy if exists "groupe: modification" on public.groups;
drop policy if exists "groupe: suppression" on public.groups;
create policy "groupe: lecture"      on public.groups for select using (created_by = auth.uid() or public.is_member(id));
create policy "groupe: création"     on public.groups for insert with check (created_by = auth.uid());
create policy "groupe: modification" on public.groups for update using (public.can_manage(id));
create policy "groupe: suppression"  on public.groups for delete using (created_by = auth.uid());

drop policy if exists "membres: lecture" on public.members;
drop policy if exists "membres: gestion" on public.members;
create policy "membres: lecture" on public.members for select using (public.is_member(group_id) or public.can_manage(group_id));
create policy "membres: gestion" on public.members for all using (public.can_manage(group_id)) with check (public.can_manage(group_id));

drop policy if exists "paiements: lecture" on public.payments;
drop policy if exists "paiements: ajout" on public.payments;
create policy "paiements: lecture" on public.payments for select using (public.is_member(group_id));
-- Phase pilote : paiements simulés enregistrés par les membres.
-- En production, les paiements Mobile Money seront insérés par le webhook de l'agrégateur.
create policy "paiements: ajout" on public.payments for insert
  with check (public.is_member(group_id) and (method <> 'especes' or public.can_manage(group_id)));

grant execute on function public.join_group(uuid), public.group_preview(uuid) to authenticated;

-- ---------- Temps réel ----------
do $$ begin
  begin alter publication supabase_realtime add table public.groups;   exception when others then null; end;
  begin alter publication supabase_realtime add table public.members;  exception when others then null; end;
  begin alter publication supabase_realtime add table public.payments; exception when others then null; end;
end $$;
