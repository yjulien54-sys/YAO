-- =====================================================================
-- COTIZ — Mise à jour n°4 : engagement au règlement (reconnaissance de dette)
-- À coller dans Supabase > SQL Editor > New query (vide) > Run
-- =====================================================================

create table if not exists public.engagements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups on delete cascade,
  profile_id uuid not null default auth.uid() references auth.users on delete cascade,
  nom text not null,
  telephone text not null,
  texte text not null,            -- règlement exact accepté (copie figée)
  accepted_at timestamptz not null default now(),
  unique (group_id, profile_id)
);

alter table public.engagements enable row level security;
drop policy if exists "engagements: lecture" on public.engagements;
drop policy if exists "engagements: signature" on public.engagements;
create policy "engagements: lecture" on public.engagements for select using (public.is_member(group_id));
-- On ne peut signer que pour soi-même, dans un groupe dont on est membre. Pas de modification ni de suppression.
create policy "engagements: signature" on public.engagements for insert
  with check (profile_id = auth.uid() and public.is_member(group_id));

do $$ begin
  begin alter publication supabase_realtime add table public.engagements; exception when others then null; end;
end $$;
