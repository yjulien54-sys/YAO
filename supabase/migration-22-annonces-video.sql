-- =====================================================================
-- COTIZ — MISE À JOUR SQL N°22 : VIDÉOS DANS LES ANNONCES
-- Une annonce peut contenir une vidéo : quand c'est son tour dans le
-- carrousel de l'accueil, la vidéo passe en entier, puis l'annonce suivante.
-- À lancer APRÈS la n°21.  Supabase > SQL Editor > New query > Run
-- =====================================================================
alter table public.annonces add column if not exists video text;
do $$ begin
  alter table public.annonces add constraint annonces_video_lien check (video is null or video ~ '^(https://|/pub/)');
exception when duplicate_object then null; end $$;
