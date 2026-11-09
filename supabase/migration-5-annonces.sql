-- =====================================================================
-- COTIZ — Mise à jour n°5 : annonces (publicités, nouveautés, mises à jour)
-- À coller dans Supabase > SQL Editor > New query (vide) > Run
-- Ensuite, pour gérer les annonces : Supabase > Table Editor > annonces
-- =====================================================================

create table if not exists public.annonces (
  id uuid primary key default gen_random_uuid(),
  titre text not null,                 -- ex : « Nouveau : le tirage au sort »
  texte text,                          -- une phrase courte
  lien text,                           -- facultatif : page ou site à ouvrir (ex : /telecharger ou https://…)
  bouton text,                         -- facultatif : texte du bouton (ex : « Découvrir »)
  couleur text not null default 'vert' check (couleur in ('vert','orange','bleu','sombre')),
  actif boolean not null default true, -- décocher pour masquer sans supprimer
  ordre integer not null default 0,    -- plus petit = affiché en premier
  debut timestamptz,                   -- facultatif : date de début d'affichage
  fin timestamptz,                     -- facultatif : date de fin d'affichage
  created_at timestamptz not null default now()
);

alter table public.annonces enable row level security;
drop policy if exists "annonces: lecture" on public.annonces;
create policy "annonces: lecture" on public.annonces for select
  using (actif and (debut is null or debut <= now()) and (fin is null or fin >= now()));
-- Pas de règle d'écriture : seules les personnes ayant accès au tableau Supabase (toi) peuvent les modifier.

insert into public.annonces (titre, texte, lien, bouton, couleur, ordre)
select * from (values
  ('Bienvenue sur Cotiz', 'Tontines, associations et collectes : tout le monde voit qui a payé.', null, null, 'vert', 1),
  ('Nouveau : le tirage au sort', 'Le trésorier lance le tirage, et tout le monde voit le résultat avec la date et l’heure.', '/aide', 'En savoir plus', 'orange', 2),
  ('Cotiz sur ton téléphone', 'Installe l’application Android en quelques secondes.', '/telecharger', 'Télécharger', 'sombre', 3)
) as v(titre, texte, lien, bouton, couleur, ordre)
where not exists (select 1 from public.annonces);
