-- =====================================================================
-- COTIZ — MISE À JOUR SQL N°28 : PART DES PÉNALITÉS PAR TRANCHES
-- Le fondateur règle la part de Cotiz selon le montant de la pénalité
-- (ex. moins de 1 000 F → 50 %, de 1 000 à 5 000 F → 60 %, au-delà → 70 %).
-- Réglage : /admin → Mes revenus.  À lancer APRÈS la n°27.
-- =====================================================================
create or replace function public.admin_parametre(c text, v text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  if c not in ('caisse_cotiz_actif', 'caisse_cotiz_lien', 'caisse_cotiz_nom', 'frais_service_actif', 'frais_service_tranches', 'frais_service_pourcent', 'frais_service_part_penalite', 'frais_service_penalite_tranches') then
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
  if c = 'frais_service_penalite_tranches' then
    -- liste JSON : [{"max": 1000, "part": 50}, …, {"max": null, "part": 70}]
    if jsonb_typeof(v::jsonb) <> 'array' or jsonb_array_length(v::jsonb) not between 1 and 10 then
      raise exception 'Tranches de pénalités invalides';
    end if;
    if exists (select 1 from jsonb_array_elements(v::jsonb) t where (t ->> 'part')::numeric < 0 or (t ->> 'part')::numeric > 100) then
      raise exception 'Part des pénalités entre 0 et 100 %%';
    end if;
  end if;
  insert into parametres_app (cle, valeur, maj_le, maj_par) values (c, nullif(trim(coalesce(v, '')), ''), now(), auth.jwt() ->> 'email')
  on conflict (cle) do update set valeur = excluded.valeur, maj_le = now(), maj_par = excluded.maj_par;
  perform journaliser_admin('Réglage modifié', c, left(coalesce(v, '—'), 200));
end $$;
grant execute on function public.admin_parametre(text, text) to authenticated;
