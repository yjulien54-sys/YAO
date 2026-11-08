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

-- ---------------------------------------------------------------------
-- À quoi servent les pénalités ? (bénéficiaire, solidarité, récompense, don)
-- ---------------------------------------------------------------------
alter table public.groups add column if not exists penalty_destination text not null default 'beneficiaire';
alter table public.groups add column if not exists don_cause text;
do $$ begin
  alter table public.groups add constraint groups_penalty_destination_check
    check (penalty_destination in ('beneficiaire','solidarite','recompense','don'));
exception when duplicate_object then null; end $$;

-- Nature d'une sortie de caisse : versement au bénéficiaire, don, aide solidaire, récompense
alter table public.payouts add column if not exists nature text not null default 'versement';
do $$ begin
  alter table public.payouts add constraint payouts_nature_check
    check (nature in ('versement','don','solidarite','recompense'));
exception when duplicate_object then null; end $$;

-- Seul le trésorier change la destination des pénalités
create or replace function public.garde_groupes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage(new.id) and (
       new.payment_phone       is distinct from old.payment_phone
    or new.wave_link           is distinct from old.wave_link
    or new.add_policy          is distinct from old.add_policy
    or new.current_round       is distinct from old.current_round
    or new.created_by          is distinct from old.created_by
    or new.tirage_prevu        is distinct from old.tirage_prevu
    or new.tirage_fait         is distinct from old.tirage_fait
    or new.tirage_par          is distinct from old.tirage_par
    or new.penalty_destination is distinct from old.penalty_destination
    or new.don_cause           is distinct from old.don_cause) then
    raise exception 'Seul le trésorier peut modifier ce réglage';
  end if;
  return new;
end $$;
