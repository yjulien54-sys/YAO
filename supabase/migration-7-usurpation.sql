-- =====================================================================
-- COTIZ — Mise à jour n°7 : protection contre l'usurpation de numéro
-- À lancer APRÈS la mise à jour n°6.
-- Supabase > SQL Editor > New query (vide) > coller > Run
-- =====================================================================
-- Faille corrigée : sans code SMS, quelqu'un pouvait taper le numéro d'un autre
-- (ou essayer des numéros au hasard) et être rattaché automatiquement à ses groupes.
-- Désormais :
--   • le rattachement automatique « partout » se fait uniquement avec un numéro vérifié par SMS ;
--   • sans SMS, on n'est reconnu que dans le groupe dont on a reçu le lien d'invitation ;
--   • le numéro d'un profil ne peut être changé qu'une fois par 24 heures.

create or replace function public.rattacher_par_numero() returns integer
language plpgsql security definer set search_path = public as $$
begin
  -- Seul un numéro confirmé par SMS donne accès à tous les groupes où il figure
  if exists (select 1 from auth.users where id = auth.uid() and phone_confirmed_at is not null) then
    return public.rattacher_numero_verifie();
  end if;
  return 0;
end $$;
grant execute on function public.rattacher_par_numero() to authenticated;

-- Limite les changements de numéro (empêche d'essayer des numéros en boucle)
alter table public.profiles add column if not exists phone_modifie_le timestamptz;

create or replace function public.garde_profils() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.phone is distinct from old.phone then
    if old.phone_modifie_le is not null and old.phone_modifie_le > now() - interval '24 hours' then
      raise exception 'Tu as déjà changé de numéro aujourd’hui. Réessaie demain ou contacte le service client.';
    end if;
    new.phone_modifie_le := now();
  end if;
  return new;
end $$;

drop trigger if exists garde_profils on public.profiles;
create trigger garde_profils before update on public.profiles
  for each row execute function public.garde_profils();
