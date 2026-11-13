-- =====================================================================
-- COTIZ — MISE À JOUR n°32 : PERSONNES À RELANCER + IDÉES & PROJETS
-- • Voir les inscriptions inachevées (numéro saisi, mais compte pas terminé)
--   pour rappeler les personnes.
-- • Voir qui est actif (aujourd'hui, 7 jours, 30 jours).
-- • Suivre l'avancement des idées pour attirer plus de monde.
-- Supabase > SQL Editor > New query > coller TOUT > Run  →  « Success »
-- Relançable sans danger. À lancer APRÈS la n°31.
-- =====================================================================

-- Tentatives d'inscription : enregistrées dès que la personne tape son nom et son numéro,
-- pour pouvoir la rappeler si elle n'arrive pas au bout (SMS non reçu, code refusé…)
create table if not exists public.tentatives_inscription (
  telephone text primary key,
  nom text,
  etape text not null default 'formulaire',
  erreur text,
  nb integer not null default 1,
  premier timestamptz not null default now(),
  dernier timestamptz not null default now()
);
alter table public.tentatives_inscription enable row level security;
-- (aucune règle de lecture : seul l'admin y accède, par la fonction ci-dessous)

create or replace function public.noter_tentative(tel text, nom text, etape text, erreur text default null) returns void
language plpgsql security definer set search_path = public as $$
declare t text := right(regexp_replace(coalesce(tel, ''), '\D', '', 'g'), 10);
begin
  if length(t) <> 10 then return; end if;
  if etape not in ('formulaire', 'code_envoye', 'erreur_envoi', 'code_refuse', 'terminee', 'erreur') then return; end if;
  insert into tentatives_inscription (telephone, nom, etape, erreur)
  values (t, left(nullif(trim(nom), ''), 80), etape, left(erreur, 300))
  on conflict (telephone) do update set
    nom = coalesce(excluded.nom, tentatives_inscription.nom),
    etape = excluded.etape,
    erreur = excluded.erreur,
    nb = least(tentatives_inscription.nb + 1, 100000),
    dernier = now();
end $$;
revoke all on function public.noter_tentative(text, text, text, text) from public;
grant execute on function public.noter_tentative(text, text, text, text) to anon, authenticated;

-- Inscriptions inachevées : tentatives sans compte terminé, plus les comptes créés sans nom
drop function if exists public.admin_inscriptions_inachevees();
create or replace function public.admin_inscriptions_inachevees() returns table (
  telephone text, nom text, etape text, erreur text, nb integer, premier timestamptz, dernier timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_admin();
  perform purger_tentatives();
  return query
    select x.telephone, x.nom, x.etape, x.erreur, x.nb, x.premier, x.dernier from (
      select t.telephone, t.nom, t.etape, t.erreur, t.nb, t.premier, t.dernier
      from tentatives_inscription t
      where t.etape <> 'terminee'
        and not exists (select 1 from profiles p where right(regexp_replace(p.phone, '\D', '', 'g'), 10) = t.telephone)
      union all
      select right(regexp_replace(u.phone, '\D', '', 'g'), 10), null::text,
             case when u.phone_confirmed_at is null then 'code_envoye' else 'profil_vide' end, null::text, 1, u.created_at, coalesce(u.last_sign_in_at, u.created_at)
      from auth.users u
      where coalesce(u.phone, '') <> '' and coalesce(u.is_anonymous, false) = false
        and not exists (select 1 from profiles p where p.id = u.id)
        and not exists (select 1 from tentatives_inscription t where t.telephone = right(regexp_replace(u.phone, '\D', '', 'g'), 10))
    ) x
    order by x.dernier desc
    limit 500;
end $$;
grant execute on function public.admin_inscriptions_inachevees() to authenticated;

-- Ménage : tentatives de plus de 6 mois effacées
create or replace function public.purger_tentatives() returns void
language sql security definer set search_path = public as $$
  delete from tentatives_inscription where dernier < now() - interval '180 days';
$$;
revoke all on function public.purger_tentatives() from public, anon, authenticated;

-- Personnes actives sur les N derniers jours (onglet Santé)
create or replace function public.admin_actifs(jours integer) returns table (
  id uuid, nom text, telephone text, dernier_jour date, nb_jours bigint
)
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  return query
    select p.id, p.name, p.phone, max(a.jour), count(*)
    from actifs_jour a join profiles p on p.id = a.profile_id
    where a.jour > current_date - greatest(1, least(jours, 400))
    group by p.id, p.name, p.phone
    order by max(a.jour) desc, count(*) desc
    limit 1000;
end $$;
grant execute on function public.admin_actifs(integer) to authenticated;

-- Idées & projets : avancement enregistré en JSON {"cagnottes": "en_cours", …}
create or replace function public.admin_feuille_route_lire() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_admin();
  return coalesce((select valeur::jsonb from parametres_app where cle = 'feuille_route'), '{}'::jsonb);
end $$;
grant execute on function public.admin_feuille_route_lire() to authenticated;

create or replace function public.admin_feuille_route(v jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  if jsonb_typeof(v) <> 'object' or length(v::text) > 5000 then raise exception 'Format invalide'; end if;
  insert into parametres_app (cle, valeur, maj_le, maj_par) values ('feuille_route', v::text, now(), auth.jwt() ->> 'email')
  on conflict (cle) do update set valeur = excluded.valeur, maj_le = now(), maj_par = excluded.maj_par;
end $$;
grant execute on function public.admin_feuille_route(jsonb) to authenticated;
