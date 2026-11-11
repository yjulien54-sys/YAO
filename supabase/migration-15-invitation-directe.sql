-- =====================================================================
-- COTIZ — MISE À JOUR SQL N°15 : INVITATION DIRECTE PAR LE RESPONSABLE
-- Invité par le créateur du groupe ou le trésorier : la personne entre
-- directement dans le groupe, sans attendre de validation.
-- Invité par un simple membre : la demande attend que le créateur ou le
-- trésorier l'accepte (ou la refuse), et on voit qui a invité.
-- Supabase > SQL Editor > New query (vide) > coller > Run
-- =====================================================================

-- 1. Clé secrète d'invitation de chaque groupe (lisible seulement par le créateur et le trésorier)
create table if not exists public.cles_invitation (
  group_id uuid primary key references public.groups on delete cascade,
  cle text not null default encode(extensions.gen_random_bytes(12), 'hex')
);
alter table public.cles_invitation enable row level security;   -- aucune règle : personne ne la lit directement
revoke all on public.cles_invitation from anon, authenticated;

-- 2. Qui a invité la personne en attente
alter table public.members add column if not exists invite_par uuid references auth.users on delete set null;

-- 3. Lien du responsable : renvoie la clé si on est créateur ou trésorier, sinon rien
create or replace function public.cle_invitation(g uuid) returns text
language plpgsql security definer set search_path = public as $$
declare k text;
begin
  if not public.can_manage(g) then return null; end if;
  insert into cles_invitation (group_id) values (g) on conflict (group_id) do nothing;
  select cle into k from cles_invitation where group_id = g;
  return k;
end $$;

-- 4. Rejoindre : avec la clé du responsable → membre tout de suite ; sinon → demande en attente
drop function if exists public.join_group(uuid);
create or replace function public.join_group(g uuid, cle text default null, par uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare p profiles; m_id uuid; direct boolean; inviteur uuid;
begin
  select * into p from profiles where id = auth.uid();
  if p is null then raise exception 'profil manquant'; end if;
  if p.bloque then raise exception 'compte bloqué'; end if;
  if not exists (select 1 from groups where id = g) then raise exception 'groupe introuvable'; end if;

  direct := exists (select 1 from groups where id = g and created_by = auth.uid())
         or (cle is not null and exists (select 1 from cles_invitation k where k.group_id = g and k.cle = join_group.cle));

  -- Déjà dans le groupe : si c'était une demande et qu'on arrive avec le lien du responsable, on entre
  select id into m_id from members where group_id = g and profile_id = auth.uid() order by turn_position limit 1;
  if m_id is not null then
    if direct then update members set en_attente = false where group_id = g and profile_id = auth.uid() and en_attente; end if;
    return m_id;
  end if;

  -- Le trésorier avait déjà ajouté ce numéro : reconnu tout de suite (toutes ses parts)
  perform set_config('cotiz.rattachement', 'on', true);
  update members set profile_id = auth.uid()
   where group_id = g and profile_id is null
     and right(regexp_replace(phone,'\D','','g'),10) = right(regexp_replace(p.phone,'\D','','g'),10);
  perform set_config('cotiz.rattachement', 'off', true);
  select id into m_id from members where group_id = g and profile_id = auth.uid() order by turn_position limit 1;
  if m_id is not null then return m_id; end if;

  -- Qui a invité ? (seulement si c'est vraiment un membre du groupe)
  select profile_id into inviteur from members
   where group_id = g and profile_id = par and profile_id <> auth.uid() and not en_attente limit 1;

  insert into members (group_id, profile_id, name, phone, role, turn_position, en_attente, invite_par)
  values (g, auth.uid(), p.name, p.phone, 'membre',
          coalesce((select max(turn_position) + 1 from members where group_id = g), 0),
          not direct, case when direct then null else inviteur end)
  returning id into m_id;
  return m_id;
end $$;

grant execute on function public.join_group(uuid, text, uuid), public.cle_invitation(uuid) to authenticated;
