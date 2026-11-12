-- =====================================================================
-- COTIZ — MISE À JOUR SQL N°27 : FRAIS INCLUS DANS LE PAIEMENT
--                                ET PART DE COTIZ SUR LES PÉNALITÉS
-- • Paiement en ligne : le membre paie cotisation + tous les frais
--   (service Cotiz + opérateur) ; la caisse du groupe reçoit la cotisation
--   entière. Les frais ne sont visibles que sur le reçu.
-- • Pénalités payées en ligne : une part (réglable, 50 % par défaut) revient
--   à Cotiz, le reste au groupe.  Réglage : /admin → Mes revenus.
-- À lancer APRÈS la n°26.  Supabase > SQL Editor > New query > Run
-- =====================================================================
alter table public.payments add column if not exists frais_operateur integer not null default 0;
alter table public.payments add column if not exists penalite_cotiz integer not null default 0;

create or replace function public.admin_parametre(c text, v text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  if c not in ('caisse_cotiz_actif', 'caisse_cotiz_lien', 'caisse_cotiz_nom', 'frais_service_actif', 'frais_service_tranches', 'frais_service_pourcent', 'frais_service_part_penalite') then
    raise exception 'Réglage inconnu';
  end if;
  if c = 'caisse_cotiz_lien' and coalesce(v, '') <> '' and v !~ '^https://(pay|qr)\.wave\.com/' then
    raise exception 'Le lien doit être un lien Wave (https://pay.wave.com/… ou https://qr.wave.com/…)';
  end if;
  if c = 'frais_service_tranches' then
    -- liste JSON de tranches : [{"max": 5000, "frais": 50}, …, {"max": null, "frais": 300}]
    if jsonb_typeof(v::jsonb) <> 'array' or jsonb_array_length(v::jsonb) not between 1 and 10 then
      raise exception 'Tranches invalides';
    end if;
    if exists (select 1 from jsonb_array_elements(v::jsonb) t
               where (t ->> 'frais')::numeric < 0 or (t ->> 'frais')::numeric > 5000) then
      raise exception 'Frais entre 0 et 5 000 F par paiement';
    end if;
  end if;
  if c = 'frais_service_pourcent' and (coalesce(v, '') !~ '^\d+(\.\d+)?$' or v::numeric > 10) then
    raise exception 'Pourcentage entre 0 et 10 %%';
  end if;
  if c = 'frais_service_part_penalite' and (coalesce(v, '') !~ '^\d+$' or v::int > 100) then
    raise exception 'Part des pénalités entre 0 et 100 %%';
  end if;
  insert into parametres_app (cle, valeur, maj_le, maj_par) values (c, nullif(trim(coalesce(v, '')), ''), now(), auth.jwt() ->> 'email')
  on conflict (cle) do update set valeur = excluded.valeur, maj_le = now(), maj_par = excluded.maj_par;
  perform journaliser_admin('Réglage modifié', c, left(coalesce(v, '—'), 200));
end $$;
grant execute on function public.admin_parametre(text, text) to authenticated;

insert into parametres_app (cle, valeur) values ('frais_service_part_penalite', '50') on conflict (cle) do nothing;

-- Revenus : frais de service + part des pénalités
create or replace function public.admin_revenus(du date, au date) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  return json_build_object(
    'total', (select coalesce(sum(frais_service + penalite_cotiz), 0) from payments where status = 'reussi' and created_at::date between du and au),
    'frais', (select coalesce(sum(frais_service), 0) from payments where status = 'reussi' and created_at::date between du and au),
    'penalites', (select coalesce(sum(penalite_cotiz), 0) from payments where status = 'reussi' and created_at::date between du and au),
    'nb', (select count(*) from payments where status = 'reussi' and frais_service > 0 and created_at::date between du and au),
    'volume', (select coalesce(sum(p.amount + p.penalty), 0) from payments p
               where p.status = 'reussi' and p.created_at::date between du and au
                 and p.transaction_id in (select transaction_id from payments where frais_service > 0 or penalite_cotiz > 0)),
    'par_jour', coalesce((select json_agg(x order by x.jour) from (
        select created_at::date as jour, sum(frais_service + penalite_cotiz) as montant, count(*) filter (where frais_service > 0) as nb
        from payments where status = 'reussi' and (frais_service > 0 or penalite_cotiz > 0) and created_at::date between du and au
        group by 1) x), '[]'),
    'par_groupe', coalesce((select json_agg(x order by x.montant desc) from (
        select g.name as groupe, sum(p.frais_service + p.penalite_cotiz) as montant, count(*) filter (where p.frais_service > 0) as nb
        from payments p join groups g on g.id = p.group_id
        where p.status = 'reussi' and (p.frais_service > 0 or p.penalite_cotiz > 0) and p.created_at::date between du and au
        group by g.name limit 20) x), '[]'),
    'depuis_debut', (select coalesce(sum(frais_service + penalite_cotiz), 0) from payments where status = 'reussi')
  );
end $$;
grant execute on function public.admin_revenus(date, date) to authenticated;
