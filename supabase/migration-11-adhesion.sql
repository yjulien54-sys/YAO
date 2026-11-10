-- =====================================================================
-- COTIZ — Mise à jour n°11 : le trésorier accepte les nouveaux venus,
--                            et on peut annuler sa déclaration de paiement
-- À lancer APRÈS la mise à jour n°10.
-- Supabase > SQL Editor > New query (vide) > coller > Run
-- =====================================================================

-- 1. Une personne qui ouvre le lien d'un groupe sans y avoir été ajoutée
--    reste « en attente » jusqu'à ce que le trésorier (ou un co-gestionnaire) l'accepte.
alter table public.members add column if not exists en_attente boolean not null default false;

-- Un membre en attente ne voit pas encore le groupe et ne peut pas payer
create or replace function public.is_member(g uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from members where group_id = g and profile_id = auth.uid() and not en_attente);
$$;

create or replace function public.join_group(g uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare p profiles; m_id uuid;
begin
  select * into p from profiles where id = auth.uid();
  if p is null then raise exception 'profil manquant'; end if;
  if not exists (select 1 from groups where id = g) then raise exception 'groupe introuvable'; end if;

  -- Déjà dans le groupe (membre ou demande en cours)
  select id into m_id from members where group_id = g and profile_id = auth.uid() order by turn_position limit 1;
  if m_id is not null then return m_id; end if;

  -- Le trésorier avait déjà ajouté ce numéro : on est reconnu tout de suite (toutes ses parts)
  perform set_config('cotiz.rattachement', 'on', true);
  update members set profile_id = auth.uid()
   where group_id = g and profile_id is null
     and right(regexp_replace(phone,'\D','','g'),10) = right(regexp_replace(p.phone,'\D','','g'),10);
  perform set_config('cotiz.rattachement', 'off', true);
  select id into m_id from members where group_id = g and profile_id = auth.uid() order by turn_position limit 1;
  if m_id is not null then return m_id; end if;

  -- Inconnu du groupe : demande en attente (sauf le créateur du groupe)
  insert into members (group_id, profile_id, name, phone, role, turn_position, en_attente)
  values (g, auth.uid(), p.name, p.phone, 'membre',
          coalesce((select max(turn_position) + 1 from members where group_id = g), 0),
          not exists (select 1 from groups where id = g and created_by = auth.uid()))
  returning id into m_id;
  return m_id;
end $$;

-- Où en est ma demande ? 'membre', 'en_attente' ou 'aucun'
create or replace function public.etat_adhesion(g uuid) returns text
language sql security definer stable set search_path = public as $$
  select case
    when exists (select 1 from members where group_id = g and profile_id = auth.uid() and not en_attente) then 'membre'
    when exists (select 1 from members where group_id = g and profile_id = auth.uid() and en_attente) then 'en_attente'
    else 'aucun' end;
$$;

grant execute on function public.join_group(uuid), public.etat_adhesion(uuid) to authenticated;

-- Accepter = passer en_attente à false ; refuser = supprimer la ligne.
-- (Déjà permis aux gestionnaires par les règles « membres: modification » et « membres: retrait ».)

-- 2. Annuler sa propre déclaration de paiement tant que le trésorier ne l'a pas confirmée
drop policy if exists "paiements: annuler sa déclaration" on public.payments;
create policy "paiements: annuler sa déclaration" on public.payments for delete
  using (status = 'en_attente' and created_by = auth.uid());
