-- =====================================================================
-- COTIZ — MISE À JOUR n°43 : MESSAGES PRIVÉS ET MESSAGES NON LUS
--  1. Dans la discussion du groupe, on peut écrire à TOUT le groupe ou seulement
--     à une ou plusieurs personnes choisies (message privé : les autres ne le voient pas).
--  2. « Mes groupes » affiche le nombre de nouveaux messages sur chaque groupe.
-- Supabase > SQL Editor > New query > coller TOUT > Run  →  « Success »
-- Relançable sans danger. À lancer APRÈS la n°42.
-- =====================================================================

-- null = tout le groupe ; sinon la liste des personnes qui reçoivent le message
alter table public.messages_groupe add column if not exists destinataires uuid[];
create index if not exists messages_groupe_dest_idx on public.messages_groupe using gin (destinataires);

-- Lecture : un message privé n'est visible que par son auteur et ses destinataires
drop policy if exists "messages groupe: les membres lisent" on public.messages_groupe;
create policy "messages groupe: les membres lisent" on public.messages_groupe for select to authenticated
  using (
    (group_id = any(array(select public.mes_groupes())) or exists (select 1 from groups x where x.id = group_id and x.created_by = auth.uid()))
    and (destinataires is null or profile_id = auth.uid() or auth.uid() = any(destinataires))
  );

-- Les destinataires doivent être des membres du groupe ; on garde seulement les bons
create or replace function public.message_groupe_avant() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.profile_id := auth.uid();
  new.texte := trim(new.texte);
  select coalesce((select name from members where group_id = new.group_id and profile_id = auth.uid() and not archive order by turn_position limit 1),
                  (select name from profiles where id = auth.uid()), 'Un membre') into new.auteur;
  if new.destinataires is not null then
    select array_agg(distinct d) into new.destinataires
      from unnest(new.destinataires) d
     where d <> auth.uid()
       and (exists (select 1 from members m where m.group_id = new.group_id and m.profile_id = d and not m.archive and not m.en_attente)
            or exists (select 1 from groups x where x.id = new.group_id and x.created_by = d));
    if new.destinataires is null or cardinality(new.destinataires) = 0 then
      raise exception 'Choisissez au moins un membre du groupe';
    end if;
  end if;
  return new;
end $$;

-- Notification : tout le groupe, ou seulement les destinataires d'un message privé
create or replace function public.message_groupe_apres() returns trigger
language plpgsql security definer set search_path = public as $$
declare gname text;
begin
  select name into gname from groups where id = new.group_id;
  if new.destinataires is null then
    perform notifier_groupe(new.group_id, 'message_groupe', '💬 ' || coalesce(new.auteur, 'Un membre') || ' · ' || coalesce(gname, 'groupe'),
      left(new.texte, 140), '/groupes/' || new.group_id || '?onglet=discussion', array[new.profile_id]);
  else
    insert into notifications (profile_id, group_id, type, titre, texte, lien)
    select d, new.group_id, 'message_groupe', '🔒 ' || coalesce(new.auteur, 'Un membre') || ' (privé) · ' || coalesce(gname, 'groupe'),
           left(new.texte, 140), '/groupes/' || new.group_id || '?onglet=discussion'
      from unnest(new.destinataires) d;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- MESSAGES NON LUS
-- ---------------------------------------------------------------------
create table if not exists public.lectures_discussion (
  group_id uuid not null references public.groups on delete cascade,
  profile_id uuid not null references auth.users on delete cascade,
  lu_le timestamptz not null default now(),
  primary key (group_id, profile_id)
);
alter table public.lectures_discussion enable row level security;
drop policy if exists "lectures: chacun les siennes" on public.lectures_discussion;
create policy "lectures: chacun les siennes" on public.lectures_discussion for select to authenticated using (profile_id = auth.uid());

-- J'ai ouvert la discussion de ce groupe
create or replace function public.discussion_lue(g uuid) returns void
language sql security definer set search_path = public as $$
  insert into lectures_discussion (group_id, profile_id, lu_le) values (g, auth.uid(), now())
  on conflict (group_id, profile_id) do update set lu_le = now();
$$;
revoke all on function public.discussion_lue(uuid) from public, anon;
grant execute on function public.discussion_lue(uuid) to authenticated;

-- Nombre de nouveaux messages (qui me sont visibles) par groupe
create or replace function public.mes_messages_non_lus() returns table (group_id uuid, nb integer, prives integer)
language sql stable security definer set search_path = public as $$
  select m.group_id, count(*)::integer, count(*) filter (where m.destinataires is not null)::integer
    from messages_groupe m
    left join lectures_discussion l on l.group_id = m.group_id and l.profile_id = auth.uid()
   where m.group_id = any(array(select public.mes_groupes()))
     and m.profile_id <> auth.uid()
     and (m.destinataires is null or auth.uid() = any(m.destinataires))
     and m.cree_le > coalesce(l.lu_le, now() - interval '30 days')
   group by m.group_id;
$$;
revoke all on function public.mes_messages_non_lus() from public, anon;
grant execute on function public.mes_messages_non_lus() to authenticated;
