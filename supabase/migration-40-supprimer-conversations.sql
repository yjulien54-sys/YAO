-- =====================================================================
-- COTIZ — MISE À JOUR n°40 : SUPPRIMER UNE CONVERSATION TERMINÉE
-- Un client peut retirer de SA liste une conversation du service client
-- quand elle est terminée. L'équipe Cotiz la garde (traçabilité, avis).
-- Supabase > SQL Editor > New query > coller TOUT > Run  →  « Success »
-- Relançable sans danger. À lancer APRÈS la n°39.
-- =====================================================================

alter table public.requetes_clients add column if not exists masquee_client boolean not null default false;

create or replace function public.requete_masquer(r uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update requetes_clients set masquee_client = true
   where id = r and profile_id = auth.uid() and statut = 'resolue';
  if not found then raise exception 'Seules vos conversations terminées peuvent être supprimées'; end if;
end $$;
revoke all on function public.requete_masquer(uuid) from public, anon;
grant execute on function public.requete_masquer(uuid) to authenticated;
