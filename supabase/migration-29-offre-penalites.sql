-- =====================================================================
-- COTIZ — MISE À JOUR SQL N°29 : OFFRE SPÉCIALE SUR LES PÉNALITÉS
-- Le fondateur lance une offre pour 1, 2 ou 3 mois : une part différente
-- pour Cotiz sur les pénalités pendant cette période. Une annonce est créée
-- automatiquement dans le carrousel de l'accueil (elle disparaît seule à la
-- fin), et tous les inscrits peuvent être prévenus par notification.
-- À la fin de la période, la part habituelle revient toute seule.
-- À lancer APRÈS la n°28.  Supabase > SQL Editor > New query > Run
-- =====================================================================
create or replace function public.admin_offre_penalite(part integer, mois integer, publier boolean default true, notifier boolean default false) returns json
language plpgsql security definer set search_path = public as $$
declare fin timestamptz; ann uuid; groupe integer; n integer := 0; jour text;
begin
  perform verifier_fondateur();
  if part < 0 or part > 100 then raise exception 'Part entre 0 et 100 %%'; end if;
  if mois not between 1 and 12 then raise exception 'Durée entre 1 et 12 mois'; end if;
  fin := date_trunc('day', now() + make_interval(months => mois)) + interval '23 hours 59 minutes';
  groupe := 100 - part;
  jour := to_char(fin, 'DD/MM/YYYY');

  -- l'ancienne annonce d'offre est retirée
  update annonces set actif = false where id::text = (select valeur from parametres_app where cle = 'frais_service_promo_annonce');

  if publier then
    insert into annonces (titre, texte, lien, bouton, couleur, actif, ordre, debut, fin)
    values ('Offre spéciale : ' || groupe || ' % des pénalités pour votre groupe',
            'Jusqu’au ' || jour || ', ' || groupe || ' % des pénalités payées en ligne restent dans la caisse de votre groupe.',
            null, null, 'orange', true, 0, now(), fin)
    returning id into ann;
  end if;

  if notifier then
    insert into notifications (profile_id, type, titre, texte, lien)
    select id, 'offre', 'Offre spéciale sur les pénalités 🎉',
           'Jusqu’au ' || jour || ', ' || groupe || ' % des pénalités payées en ligne restent dans la caisse de votre groupe.', '/groupes'
    from profiles where not coalesce(bloque, false);
    get diagnostics n = row_count;
  end if;

  insert into parametres_app (cle, valeur, maj_le, maj_par) values
    ('frais_service_promo_part', part::text, now(), auth.jwt() ->> 'email'),
    ('frais_service_promo_fin', fin::text, now(), auth.jwt() ->> 'email'),
    ('frais_service_promo_annonce', coalesce(ann::text, ''), now(), auth.jwt() ->> 'email')
  on conflict (cle) do update set valeur = excluded.valeur, maj_le = now(), maj_par = excluded.maj_par;

  perform journaliser_admin('Offre pénalités lancée', part || ' % Cotiz / ' || groupe || ' % groupe', 'jusqu’au ' || jour || case when n > 0 then ' · ' || n || ' notifications' else '' end);
  return json_build_object('fin', fin, 'annonce', ann, 'notifications', n);
end $$;

create or replace function public.admin_offre_penalite_arreter() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  update annonces set actif = false where id::text = (select valeur from parametres_app where cle = 'frais_service_promo_annonce');
  update parametres_app set valeur = null, maj_le = now(), maj_par = auth.jwt() ->> 'email'
   where cle in ('frais_service_promo_fin', 'frais_service_promo_annonce');
  perform journaliser_admin('Offre pénalités arrêtée', null);
end $$;

grant execute on function public.admin_offre_penalite(integer, integer, boolean, boolean), public.admin_offre_penalite_arreter() to authenticated;
