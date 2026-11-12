-- =====================================================================
-- COTIZ — MISE À JOUR SQL N°26 : SUPPRIMER DÉFINITIVEMENT UN COMPTE
-- Réservé au fondateur (un agent envoie un dossier).
-- • Efface : le compte, le profil, le code secret, les notifications,
--   les demandes « code oublié », les requêtes au service client.
-- • Garde : les paiements déjà faits (preuves), sous le nom de la personne,
--   pour que la caisse des groupes reste juste.
-- • Groupes qu'elle a créés : effacés si elle était seule, sinon confiés
--   au trésorier (ou à un autre membre).
-- Différence avec « Bloquer à vie » : après suppression, le numéro peut
-- se réinscrire ; après blocage, il ne peut plus jamais.
-- À lancer APRÈS la n°25.  Supabase > SQL Editor > New query > Run
-- =====================================================================

-- 1. Le fondateur peut confier un groupe à quelqu'un d'autre (contournement contrôlé)
create or replace function public.garde_groupes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_setting('cotiz.admin', true) = 'on' then return new; end if;
  if not public.can_manage(new.id) and (
       new.payment_phone is distinct from old.payment_phone
    or new.wave_link     is distinct from old.wave_link
    or new.add_policy    is distinct from old.add_policy
    or new.current_round is distinct from old.current_round
    or new.created_by    is distinct from old.created_by) then
    raise exception 'Seul le trésorier peut modifier ce réglage';
  end if;
  return new;
end $$;

-- 2. Suppression du compte
create or replace function public.admin_supprimer_compte(p uuid) returns json
language plpgsql security definer set search_path = public as $$
declare pr profiles; g record; repreneur uuid; n_suppr int := 0; n_confies int := 0; n_arch int := 0;
begin
  perform verifier_fondateur();
  select * into pr from profiles where id = p;
  if pr.id is null and not exists (select 1 from auth.users where id = p) then raise exception 'Compte introuvable'; end if;
  if exists (select 1 from auth.users u join admins a on lower(a.email) = lower(u.email) where u.id = p) then
    raise exception 'Ce compte fait partie de l’équipe : retire-le d’abord dans Équipe';
  end if;

  perform journaliser_admin('Compte supprimé définitivement', coalesce(pr.name, '—') || ' · ' || coalesce(pr.phone, '—'));
  perform set_config('cotiz.admin', 'on', true);
  perform set_config('cotiz.rattachement', 'on', true);

  -- Groupes créés par la personne
  for g in select id from groups where created_by = p loop
    select m.profile_id into repreneur from members m
     where m.group_id = g.id and m.profile_id is not null and m.profile_id <> p and not m.archive and not m.en_attente
     order by (m.role = 'tresorier') desc, (m.role = 'gestionnaire') desc, m.turn_position limit 1;
    if repreneur is null then
      delete from payouts where group_id = g.id;
      delete from payments where group_id = g.id;
      delete from groups where id = g.id;
      n_suppr := n_suppr + 1;
    else
      update groups set created_by = repreneur where id = g.id;
      update members set role = 'tresorier' where group_id = g.id and profile_id = repreneur and role <> 'tresorier'
        and not exists (select 1 from members x where x.group_id = g.id and x.role = 'tresorier' and x.profile_id is distinct from p);
      n_confies := n_confies + 1;
    end if;
  end loop;

  -- Ses places dans les groupes : sans paiement → retirées ; avec paiements → gardées (historique) mais archivées
  delete from members m where m.profile_id = p and not exists (select 1 from payments x where x.member_id = m.id);
  update members set archive = true, profile_id = null, role = case when role = 'tresorier' then 'membre' else role end
   where profile_id = p;
  get diagnostics n_arch = row_count;
  update members set invite_par = null where invite_par = p;
  update payments set created_by = null where created_by = p;
  update payouts set created_by = null where created_by = p;

  -- Données personnelles
  delete from codes_historique where profile_id = p;
  delete from codes_secrets where profile_id = p;
  delete from demandes_reinitialisation where profile_id = p;
  delete from notifications where profile_id = p;
  if pr.phone is not null then
    delete from tentatives_connexion where telephone = right(regexp_replace(pr.phone, '\D', '', 'g'), 10);
  end if;
  delete from profiles where id = p;
  delete from auth.users where id = p;

  perform set_config('cotiz.rattachement', 'off', true);
  perform set_config('cotiz.admin', 'off', true);
  return json_build_object('groupes_supprimes', n_suppr, 'groupes_confies', n_confies, 'places_gardees', n_arch);
end $$;
grant execute on function public.admin_supprimer_compte(uuid) to authenticated;

-- 3. Un agent peut demander la suppression par dossier ; le fondateur valide
create or replace function public.admin_dossier_traiter(dossier uuid, accepter boolean, reponse text default null) returns text
language plpgsql security definer set search_path = public as $$
declare d dossiers_admin; a text; x jsonb;
begin
  perform verifier_fondateur();
  select * into d from dossiers_admin where id = dossier for update;
  if d.id is null then raise exception 'Dossier introuvable'; end if;
  if d.statut <> 'ouvert' then raise exception 'Ce dossier est déjà traité'; end if;
  x := d.donnees; a := x ->> 'action';
  if accepter and a is not null then
    case a
      when 'confirmer_paiement' then perform admin_paiement_statut((x ->> 'paiement_id')::uuid, 'reussi');
      when 'refuser_paiement' then perform admin_paiement_statut((x ->> 'paiement_id')::uuid, 'echoue');
      when 'valider_versement' then perform admin_versement_decision((x ->> 'versement_id')::uuid, true);
      when 'refuser_versement' then perform admin_versement_decision((x ->> 'versement_id')::uuid, false);
      when 'modifier_profil' then perform admin_modifier_profil((x ->> 'profile_id')::uuid, x ->> 'nom', x ->> 'telephone', nullif(x ->> 'naissance', '')::date);
      when 'bloquer' then perform admin_bloquer((x ->> 'profile_id')::uuid, true, coalesce(x ->> 'motif', d.description));
      when 'debloquer' then perform admin_bloquer((x ->> 'profile_id')::uuid, false, null);
      when 'accepter_membre' then perform admin_modifier_membre((x ->> 'membre_id')::uuid, null, null, null);
      when 'retirer_membre' then perform admin_retirer_membre((x ->> 'membre_id')::uuid);
      when 'changer_role' then perform admin_modifier_membre((x ->> 'membre_id')::uuid, null, null, x ->> 'role');
      when 'supprimer_groupe' then perform admin_supprimer_groupe((x ->> 'groupe_id')::uuid);
      when 'supprimer_compte' then perform admin_supprimer_compte((x ->> 'profile_id')::uuid);
      else null;
    end case;
  end if;
  update dossiers_admin set statut = case when accepter then 'valide' else 'refuse' end,
    reponse = nullif(trim(coalesce(admin_dossier_traiter.reponse, '')), ''), traite_par = auth.jwt() ->> 'email', traite_le = now()
  where id = dossier;
  perform journaliser_admin(case when accepter then 'Dossier n°' || d.numero || ' validé' else 'Dossier n°' || d.numero || ' refusé' end,
    d.motif || coalesce(' · ' || d.client_nom, ''), nullif(trim(coalesce(admin_dossier_traiter.reponse, '')), ''));
  return case when accepter then 'valide' else 'refuse' end;
end $$;
grant execute on function public.admin_dossier_traiter(uuid, boolean, text) to authenticated;
