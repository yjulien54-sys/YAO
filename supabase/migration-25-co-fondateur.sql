-- =====================================================================
-- COTIZ — MISE À JOUR SQL N°25 : PLUSIEURS FONDATEURS
-- Un fondateur peut nommer un co-fondateur (mêmes pouvoirs), ou le
-- repasser agent. Protections : on ne change pas son propre rôle, et il
-- reste toujours au moins un fondateur.
-- À lancer APRÈS la n°24.  Supabase > SQL Editor > New query > Run
-- =====================================================================
create or replace function public.admin_changer_role(adresse text, nouveau_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  if nouveau_role not in ('fondateur', 'agent') then raise exception 'Rôle invalide'; end if;
  if lower(adresse) = lower(coalesce(auth.jwt() ->> 'email', '')) then
    raise exception 'Tu ne peux pas changer ton propre rôle';
  end if;
  if nouveau_role = 'agent' and (select count(*) from admins where role = 'fondateur') <= 1 then
    raise exception 'Il doit rester au moins un fondateur';
  end if;
  update admins set role = nouveau_role where lower(email) = lower(adresse);
  if not found then raise exception 'Membre de l’équipe introuvable'; end if;
  perform journaliser_admin(case when nouveau_role = 'fondateur' then 'Nommé co-fondateur' else 'Repassé agent' end,
    (select coalesce(nom, email) || ' · ' || coalesce(numero::text, '—') from admins where lower(email) = lower(adresse)));
end $$;
grant execute on function public.admin_changer_role(text, text) to authenticated;
