-- =====================================================================
-- SIKAKLO — MISE À JOUR n°45 : NOUVEAU NOM (Cotiz devient Sikaklo)
-- Les notifications créées par la base de données (paiements, service client…)
-- affichent désormais « Sikaklo » au lieu de « Cotiz ».
-- Les anciennes notifications ne sont pas modifiées.
-- Supabase > SQL Editor > New query > coller TOUT > Run  →  « Success »
-- Relançable sans danger. À lancer APRÈS la n°44.
-- =====================================================================

create or replace function public.notification_nouveau_nom() returns trigger
language plpgsql set search_path = public as $$
begin
  new.titre := replace(new.titre, 'Cotiz', 'Sikaklo');
  new.texte := replace(new.texte, 'Cotiz', 'Sikaklo');
  return new;
end $$;

drop trigger if exists notification_nouveau_nom on public.notifications;
create trigger notification_nouveau_nom before insert on public.notifications
  for each row execute function public.notification_nouveau_nom();
