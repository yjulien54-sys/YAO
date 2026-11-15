-- =====================================================================
-- COTIZ — MISE À JOUR n°39 : REÇU PARTAGEABLE, DISCUSSION DE GROUPE,
-- TOUT LE GROUPE PRÉVENU DES PAIEMENTS
--  1. Un reçu partagé sur WhatsApp s'ouvre pour tout le monde, même sans être
--     dans le groupe (seul ce reçu est visible, rien d'autre du groupe).
--  2. Chaque groupe a sa discussion : un message prévient tous les membres.
--  3. Quand un paiement est confirmé, tous les membres du groupe sont prévenus
--     (« Awa a payé 25 000 F »).
-- Supabase > SQL Editor > New query > coller TOUT > Run  →  « Success »
-- Relançable sans danger. À lancer APRÈS la n°38.
-- =====================================================================

-- Montant lisible : 25000 → « 25 000 F »
create or replace function public.f_cfa(n numeric) returns text
language sql immutable as $$ select replace(to_char(coalesce(n, 0), 'FM999,999,999,999'), ',', ' ') || ' F' $$;

-- Prévenir TOUS les membres d'un groupe (sauf certaines personnes)
create or replace function public.notifier_groupe(g uuid, typ text, ti text, tx text, li text, sauf uuid[] default array[]::uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (profile_id, group_id, type, titre, texte, lien)
  select distinct p, g, typ, ti, tx, li from (
    select created_by as p from groups where id = g
    union
    select profile_id from members where group_id = g and not archive and not en_attente and profile_id is not null
  ) r where p is not null and not (p = any(coalesce(sauf, array[]::uuid[])));
end $$;
revoke all on function public.notifier_groupe(uuid, text, text, text, text, uuid[]) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 1. REÇU PUBLIC (lien partagé) : uniquement les informations du reçu
-- ---------------------------------------------------------------------
create or replace function public.recu_public(pid uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare p payments; g groups; m members; tres text;
begin
  select * into p from payments where id = pid and coalesce(status, 'reussi') = 'reussi';
  if p.id is null then return null; end if;
  select * into g from groups where id = p.group_id;
  select * into m from members where id = p.member_id;
  select name into tres from members where group_id = g.id and role = 'tresorier' order by turn_position limit 1;
  return json_build_object(
    'id', p.id, 'groupe', g.name, 'type', g.type, 'membre', coalesce(m.name, 'Ancien membre'),
    'montant', p.amount, 'penalite', p.penalty,
    'frais', coalesce(p.frais_service, 0) + coalesce(p.frais_operateur, 0),
    'moyen', p.method, 'tour', p.round, 'date', p.created_at, 'reference', p.reference,
    'tresorier', tres);
end $$;
revoke all on function public.recu_public(uuid) from public;
grant execute on function public.recu_public(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. DISCUSSION DE GROUPE
-- ---------------------------------------------------------------------
create table if not exists public.messages_groupe (
  id bigserial primary key,
  group_id uuid not null references public.groups on delete cascade,
  profile_id uuid not null default auth.uid() references auth.users on delete cascade,
  auteur text,
  texte text not null check (length(trim(texte)) between 1 and 1000),
  cree_le timestamptz not null default now()
);
create index if not exists messages_groupe_idx on public.messages_groupe (group_id, cree_le desc);
alter table public.messages_groupe enable row level security;

drop policy if exists "messages groupe: les membres lisent" on public.messages_groupe;
create policy "messages groupe: les membres lisent" on public.messages_groupe for select to authenticated
  using (group_id = any(array(select public.mes_groupes())) or exists (select 1 from groups x where x.id = group_id and x.created_by = auth.uid()));
drop policy if exists "messages groupe: les membres écrivent" on public.messages_groupe;
create policy "messages groupe: les membres écrivent" on public.messages_groupe for insert to authenticated
  with check (profile_id = auth.uid() and (group_id = any(array(select public.mes_groupes())) or exists (select 1 from groups x where x.id = group_id and x.created_by = auth.uid())));
drop policy if exists "messages groupe: l'auteur ou le trésorier efface" on public.messages_groupe;
create policy "messages groupe: l'auteur ou le trésorier efface" on public.messages_groupe for delete to authenticated
  using (profile_id = auth.uid() or public.can_manage(group_id));
grant select, insert, delete on public.messages_groupe to authenticated;
grant usage, select on sequence public.messages_groupe_id_seq to authenticated;

-- Nom de l'auteur rempli automatiquement + notification à tout le groupe
create or replace function public.message_groupe_avant() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.profile_id := auth.uid();
  new.texte := trim(new.texte);
  select coalesce((select name from members where group_id = new.group_id and profile_id = auth.uid() and not archive order by turn_position limit 1),
                  (select name from profiles where id = auth.uid()), 'Un membre') into new.auteur;
  return new;
end $$;
drop trigger if exists message_groupe_avant on public.messages_groupe;
create trigger message_groupe_avant before insert on public.messages_groupe for each row execute function public.message_groupe_avant();

create or replace function public.message_groupe_apres() returns trigger
language plpgsql security definer set search_path = public as $$
declare gname text;
begin
  select name into gname from groups where id = new.group_id;
  perform notifier_groupe(new.group_id, 'message_groupe', '💬 ' || coalesce(new.auteur, 'Un membre') || ' · ' || coalesce(gname, 'groupe'),
    left(new.texte, 140), '/groupes/' || new.group_id || '?onglet=discussion', array[new.profile_id]);
  return new;
end $$;
drop trigger if exists message_groupe_apres on public.messages_groupe;
create trigger message_groupe_apres after insert on public.messages_groupe for each row execute function public.message_groupe_apres();

-- Temps réel (les nouveaux messages apparaissent tout seuls)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages_groupe') then
    alter publication supabase_realtime add table public.messages_groupe;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3. PAIEMENT CONFIRMÉ → TOUT LE GROUPE EST PRÉVENU
-- ---------------------------------------------------------------------
create or replace function public.notif_paiement_groupe() returns trigger
language plpgsql security definer set search_path = public as $$
declare m members; gname text; gtype text;
begin
  if not ((tg_op = 'INSERT' and coalesce(new.status, 'reussi') = 'reussi')
       or (tg_op = 'UPDATE' and coalesce(old.status, '') <> 'reussi' and new.status = 'reussi')) then
    return new;
  end if;
  select * into m from members where id = new.member_id;
  select name, type into gname, gtype from groups where id = new.group_id;
  perform notifier_groupe(new.group_id, 'paiement_groupe',
    case when gtype = 'collecte' then '🎉 Nouvelle participation' else '💰 Nouveau paiement' end,
    coalesce(m.name, 'Un membre') || ' a ' || case when gtype = 'collecte' then 'participé pour ' else 'payé ' end
      || f_cfa(new.amount + new.penalty) || case when gtype <> 'collecte' then ' (tour ' || new.round || ')' else '' end || ' · ' || coalesce(gname, ''),
    '/groupes/' || new.group_id,
    -- la personne qui a payé et celle qui confirme ont déjà leur propre notification
    array_remove(array[m.profile_id, auth.uid()], null));
  return new;
end $$;
drop trigger if exists notif_paiement_groupe on public.payments;
create trigger notif_paiement_groupe after insert or update of status on public.payments for each row execute function public.notif_paiement_groupe();
