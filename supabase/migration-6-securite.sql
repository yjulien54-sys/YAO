-- =====================================================================
-- COTIZ — Mise à jour n°6 : sécurité et traçabilité
-- À coller dans Supabase > SQL Editor > New query (vide) > Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Journal de toutes les actions (qui, quoi, quand, avant/après)
--    Lisible uniquement depuis le tableau Supabase (aucun accès depuis l'app).
-- ---------------------------------------------------------------------
create table if not exists public.journal (
  id bigserial primary key,
  at timestamptz not null default now(),
  acteur uuid default auth.uid(),
  table_nom text not null,
  action text not null,
  ligne_id text,
  group_id uuid,
  avant jsonb,
  apres jsonb
);
create index if not exists journal_group_idx on public.journal (group_id, at desc);
create index if not exists journal_acteur_idx on public.journal (acteur, at desc);
alter table public.journal enable row level security;   -- aucune règle : invisible depuis l'app

create or replace function public.journaliser() returns trigger
language plpgsql security definer set search_path = public as $$
declare ligne jsonb;
begin
  ligne := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  insert into journal (table_nom, action, ligne_id, group_id, avant, apres)
  values (
    tg_table_name, tg_op, ligne->>'id',
    case when tg_table_name = 'groups' then (ligne->>'id')::uuid else nullif(ligne->>'group_id', '')::uuid end,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return case when tg_op = 'DELETE' then old else new end;
end $$;

do $$
declare t text;
begin
  foreach t in array array['groups','members','payments','payouts','engagements','profiles'] loop
    execute format('drop trigger if exists journal_%1$s on public.%1$s', t);
    execute format('create trigger journal_%1$s after insert or update or delete on public.%1$s for each row execute function public.journaliser()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 2. Un paiement enregistré ne peut plus être modifié
--    (seul le statut « en attente » peut passer à « réussi » ou « échoué »)
-- ---------------------------------------------------------------------
create or replace function public.garde_paiements() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then return new; end if;
  if (new.amount, new.penalty, new.member_id, new.group_id, new.round, new.method, new.reference)
     is distinct from (old.amount, old.penalty, old.member_id, old.group_id, old.round, old.method, old.reference) then
    raise exception 'Un paiement enregistré ne peut pas être modifié';
  end if;
  if new.status is distinct from old.status and old.status <> 'en_attente' then
    raise exception 'Ce paiement a déjà été validé ou refusé';
  end if;
  return new;
end $$;
drop trigger if exists garde_paiements on public.payments;
create trigger garde_paiements before update on public.payments for each row execute function public.garde_paiements();

-- ---------------------------------------------------------------------
-- 3. Retirer un membre n'efface plus ses paiements : il est archivé
-- ---------------------------------------------------------------------
alter table public.members add column if not exists archive boolean not null default false;
alter table public.payments drop constraint if exists payments_member_id_fkey;
alter table public.payments add constraint payments_member_id_fkey
  foreign key (member_id) references public.members (id) on delete no action;   -- impossible de supprimer un membre qui a des paiements

-- ---------------------------------------------------------------------
-- 4. Alerte : date du dernier changement du numéro de réception
-- ---------------------------------------------------------------------
alter table public.groups add column if not exists payment_phone_changed_at timestamptz;

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
    or new.don_cause           is distinct from old.don_cause
    or new.payment_phone_changed_at is distinct from old.payment_phone_changed_at) then
    raise exception 'Seul le trésorier peut modifier ce réglage';
  end if;
  if new.payment_phone is distinct from old.payment_phone then
    new.payment_phone_changed_at := now();
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 5. Connexion par SMS : rattacher les places d'un numéro VÉRIFIÉ
--    (y compris celles d'anciens comptes non vérifiés du même numéro)
-- ---------------------------------------------------------------------
create or replace function public.garde_membres() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_setting('cotiz.rattachement', true) = 'on' then return new; end if;
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

create or replace function public.rattacher_numero_verifie() returns integer
language plpgsql security definer set search_path = public as $$
declare tel text; n integer;
begin
  select phone into tel from auth.users where id = auth.uid() and phone_confirmed_at is not null;
  if tel is null then return 0; end if;
  perform set_config('cotiz.rattachement', 'on', true);
  update members m set profile_id = auth.uid()
   where right(regexp_replace(m.phone, '\D', '', 'g'), 10) = right(regexp_replace(tel, '\D', '', 'g'), 10)
     and (m.profile_id is null or m.profile_id in (select id from auth.users where is_anonymous));
  get diagnostics n = row_count;
  perform set_config('cotiz.rattachement', 'off', true);
  return n;
end $$;
grant execute on function public.rattacher_numero_verifie() to authenticated;
