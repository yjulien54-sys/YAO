-- =====================================================================
-- COTIZ — Mise à jour n°2 : frais, statut des paiements, versements
-- À coller dans Supabase > SQL Editor > New query (vide) > Run
-- =====================================================================

-- Paiements : statut (pour CinetPay), frais Mobile Money, identifiant de transaction
alter table public.payments add column if not exists status text not null default 'reussi';
alter table public.payments add column if not exists fees integer not null default 0;
alter table public.payments add column if not exists transaction_id text;
do $$ begin
  alter table public.payments add constraint payments_status_check check (status in ('en_attente','reussi','echoue'));
exception when duplicate_object then null; end $$;
create index if not exists payments_tx_idx on public.payments (transaction_id);

-- Versements : argent sorti de la caisse (bénéficiaire du tour, famille, dépense de l'association)
create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups on delete cascade,
  round integer not null default 1,
  member_id uuid references public.members on delete set null,
  beneficiary_name text not null,
  amount integer not null check (amount > 0),
  method text not null check (method in ('wave','orange','mtn','moov','especes','virement','cinetpay')),
  status text not null default 'verse' check (status in ('en_cours','verse','echoue')),
  note text,
  reference text not null unique,
  created_by uuid default auth.uid() references auth.users,
  created_at timestamptz not null default now()
);
create index if not exists payouts_group_idx on public.payouts (group_id, round);

alter table public.payouts enable row level security;
drop policy if exists "versements: lecture" on public.payouts;
drop policy if exists "versements: ajout" on public.payouts;
create policy "versements: lecture" on public.payouts for select using (public.is_member(group_id));
create policy "versements: ajout"   on public.payouts for insert with check (public.can_manage(group_id));

do $$ begin
  begin alter publication supabase_realtime add table public.payouts; exception when others then null; end;
end $$;

-- Paiement direct au trésorier (mode « manuel »)
alter table public.groups add column if not exists payment_phone text;

-- Un membre ne peut que DÉCLARER un paiement (en attente) ; seul le trésorier valide
drop policy if exists "paiements: ajout" on public.payments;
create policy "paiements: ajout" on public.payments for insert with check (
  public.can_manage(group_id)
  or (public.is_member(group_id) and status = 'en_attente' and method <> 'especes')
);
drop policy if exists "paiements: validation" on public.payments;
create policy "paiements: validation" on public.payments for update
  using (public.can_manage(group_id)) with check (public.can_manage(group_id));
