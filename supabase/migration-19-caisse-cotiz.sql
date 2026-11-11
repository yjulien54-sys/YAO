-- =====================================================================
-- COTIZ — MISE À JOUR SQL N°19 : CAISSE COTIZ (COMPTE MARCHAND WAVE)
-- • Le fondateur peut activer « Caisse Cotiz » depuis /admin :
--   les membres paient par Wave sur le compte marchand de Cotiz.
-- • Ces paiements ne peuvent être confirmés QUE par le fondateur
--   (c'est lui qui voit l'argent arriver). Le trésorier est prévenu.
-- À lancer APRÈS la n°18.  Supabase > SQL Editor > New query > Run
-- =====================================================================

-- 1. Réglages de l'application (non secrets : lisibles par l'application)
create table if not exists public.parametres_app (
  cle text primary key,
  valeur text,
  maj_le timestamptz not null default now(),
  maj_par text
);
alter table public.parametres_app enable row level security;
drop policy if exists "paramètres: lecture" on public.parametres_app;
create policy "paramètres: lecture" on public.parametres_app for select using (cle like 'caisse_cotiz_%');
grant select on public.parametres_app to anon, authenticated;

create or replace function public.admin_parametre(c text, v text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  if c not in ('caisse_cotiz_actif', 'caisse_cotiz_lien', 'caisse_cotiz_nom') then raise exception 'Réglage inconnu'; end if;
  if c = 'caisse_cotiz_lien' and coalesce(v, '') <> '' and v !~ '^https://(pay|qr)\.wave\.com/' then
    raise exception 'Le lien doit être un lien Wave (https://pay.wave.com/… ou https://qr.wave.com/…)';
  end if;
  insert into parametres_app (cle, valeur, maj_le, maj_par) values (c, nullif(trim(coalesce(v, '')), ''), now(), auth.jwt() ->> 'email')
  on conflict (cle) do update set valeur = excluded.valeur, maj_le = now(), maj_par = excluded.maj_par;
  perform journaliser_admin('Réglage modifié', c, left(coalesce(v, '—'), 120));
end $$;
grant execute on function public.admin_parametre(text, text) to authenticated;

-- 2. Paiements envoyés sur le compte Cotiz
alter table public.payments add column if not exists encaisse_cotiz boolean not null default false;

create or replace function public.garde_caisse_cotiz() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.mon_role_admin(), '') = 'fondateur' then return new; end if;
  if new.encaisse_cotiz is distinct from old.encaisse_cotiz then
    raise exception 'Ce réglage ne peut pas être modifié';
  end if;
  if old.encaisse_cotiz and old.status = 'en_attente' and new.status is distinct from old.status then
    raise exception 'Ce paiement a été envoyé sur le compte Cotiz : c’est Cotiz qui le confirme après vérification.';
  end if;
  return new;
end $$;
drop trigger if exists garde_caisse_cotiz on public.payments;
create trigger garde_caisse_cotiz before update on public.payments for each row execute function public.garde_caisse_cotiz();

-- 3. Liste « paiements en attente » de l'administration : on voit lesquels sont sur le compte Cotiz
drop function if exists public.admin_paiements_attente();
create or replace function public.admin_paiements_attente() returns table (
  id uuid, le timestamptz, groupe text, membre text, montant integer, moyen text, tresorier_tel text,
  encaisse_cotiz boolean, reference text, membre_tel text
)
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_admin();
  return query
    select p.id, p.created_at, g.name, m.name, p.amount + p.penalty, p.method, pr.phone,
      p.encaisse_cotiz, case when p.transaction_id like 'DECL-%' then null else p.transaction_id end, m.phone
    from payments p join groups g on g.id = p.group_id join members m on m.id = p.member_id
    left join profiles pr on pr.id = g.created_by
    where p.status = 'en_attente' order by p.encaisse_cotiz desc, p.created_at desc limit 300;
end $$;
grant execute on function public.admin_paiements_attente() to authenticated;

-- 4. Notifications des paiements automatiques (Wave API / GeniusPay) et de la Caisse Cotiz
--    • paiement en ligne créé par le serveur : pas de « Paiement à confirmer » pour le trésorier
--    • paiement confirmé automatiquement (ou par Cotiz) : le membre ET le trésorier sont prévenus
create or replace function public.notif_paiements() returns trigger
language plpgsql security definer set search_path = public as $$
declare m members; gname text; auto boolean := auth.uid() is null;
begin
  select * into m from members where id = new.member_id;
  select name into gname from groups where id = new.group_id;
  if tg_op = 'INSERT' and new.status = 'en_attente' then
    if not auto then
      perform notifier_responsables(new.group_id, 'paiement_declare',
        case when new.encaisse_cotiz then 'Paiement envoyé sur le compte Cotiz' else 'Paiement à confirmer' end,
        coalesce(m.name, 'Un membre') || ' a ' || case when new.encaisse_cotiz then 'payé ' else 'déclaré ' end || (new.amount + new.penalty) || ' F · ' || gname
          || case when new.encaisse_cotiz then ' (vérification par Cotiz)' else '' end,
        '/groupes/' || new.group_id || '#a-confirmer', auth.uid(), true);
    end if;
  elsif tg_op = 'INSERT' and new.status = 'reussi' and m.profile_id is not null and m.profile_id is distinct from auth.uid() then
    insert into notifications (profile_id, group_id, type, titre, texte, lien)
    values (m.profile_id, new.group_id, 'paiement_confirme', 'Paiement enregistré ✓',
      'Le trésorier a enregistré ton paiement de ' || (new.amount + new.penalty) || ' F · ' || gname, '/groupes/' || new.group_id);
  elsif tg_op = 'UPDATE' and old.status = 'en_attente' and new.status in ('reussi', 'echoue') then
    if m.profile_id is not null then
      insert into notifications (profile_id, group_id, type, titre, texte, lien)
      values (m.profile_id, new.group_id,
        case when new.status = 'reussi' then 'paiement_confirme' else 'paiement_refuse' end,
        case when new.status = 'reussi' then 'Paiement confirmé ✓' else 'Paiement non reçu' end,
        case when new.status = 'reussi' then 'Ton paiement de ' || (new.amount + new.penalty) || ' F a été confirmé · ' || gname
             else 'Ton paiement de ' || (new.amount + new.penalty) || ' F n’a pas été reçu · ' || gname end,
        '/groupes/' || new.group_id);
    end if;
    -- Confirmé sans le trésorier (paiement automatique ou Caisse Cotiz) : on prévient le trésorier
    if new.status = 'reussi' and (auto or new.encaisse_cotiz) then
      perform notifier_responsables(new.group_id, 'paiement_recu', 'Paiement reçu ✓',
        coalesce(m.name, 'Un membre') || ' a payé ' || (new.amount + new.penalty) || ' F · ' || gname
          || case when new.encaisse_cotiz then ' (sur le compte Cotiz)' else '' end,
        '/groupes/' || new.group_id, null, false);
    end if;
  end if;
  return new;
end $$;
