-- =====================================================================
-- COTIZ — MISE À JOUR n°44 : LE FONDATEUR VOIT LES DISCUSSIONS DES GROUPES
-- Pour la surveillance (arnaques, insultes, litiges) : le fondateur, et lui seul,
-- peut lire les discussions des groupes et effacer un message abusif.
-- Chaque consultation et chaque effacement sont inscrits dans le journal admin.
-- Supabase > SQL Editor > New query > coller TOUT > Run  →  « Success »
-- Relançable sans danger. À lancer APRÈS la n°43.
-- =====================================================================

-- Liste des groupes qui ont une discussion (le plus récent en premier)
create or replace function public.admin_discussions() returns table (
  group_id uuid, nom text, type text, nb_messages integer, nb_prives integer, dernier_le timestamptz, dernier_auteur text, dernier_texte text)
language plpgsql security definer set search_path = public as $$
begin
  perform verifier_fondateur();
  return query
    select g.id, g.name, g.type, count(m.id)::integer, count(m.id) filter (where m.destinataires is not null)::integer,
           max(m.cree_le),
           (array_agg(m.auteur order by m.cree_le desc))[1],
           (array_agg(left(m.texte, 120) order by m.cree_le desc))[1]
      from messages_groupe m join groups g on g.id = m.group_id
     group by g.id, g.name, g.type
     order by max(m.cree_le) desc
     limit 300;
end $$;
revoke all on function public.admin_discussions() from public, anon;
grant execute on function public.admin_discussions() to authenticated;

-- Lire la discussion d'un groupe (consultation inscrite dans le journal)
create or replace function public.admin_discussion(g uuid) returns table (
  id bigint, auteur text, texte text, cree_le timestamptz, prive boolean, destinataires text)
language plpgsql security definer set search_path = public as $$
declare gname text;
begin
  perform verifier_fondateur();
  select name into gname from groups where groups.id = g;
  perform journaliser_admin('consulter_discussion', g::text, coalesce(gname, ''));
  return query
    select m.id, m.auteur, m.texte, m.cree_le, m.destinataires is not null,
           case when m.destinataires is null then null else (
             select string_agg(coalesce((select mb.name from members mb where mb.group_id = g and mb.profile_id = d limit 1),
                                        (select p.name from profiles p where p.id = d), 'membre'), ', ')
               from unnest(m.destinataires) d) end
      from messages_groupe m
     where m.group_id = g
     order by m.cree_le desc
     limit 500;
end $$;
revoke all on function public.admin_discussion(uuid) from public, anon;
grant execute on function public.admin_discussion(uuid) to authenticated;

-- Effacer un message abusif (inscrit dans le journal, avec le texte effacé)
create or replace function public.admin_message_effacer(mid bigint) returns void
language plpgsql security definer set search_path = public as $$
declare m messages_groupe;
begin
  perform verifier_fondateur();
  select * into m from messages_groupe where messages_groupe.id = mid;
  if m.id is null then return; end if;
  perform journaliser_admin('effacer_message_groupe', m.group_id::text, coalesce(m.auteur, '') || ' : ' || left(m.texte, 300));
  delete from messages_groupe where messages_groupe.id = mid;
end $$;
revoke all on function public.admin_message_effacer(bigint) from public, anon;
grant execute on function public.admin_message_effacer(bigint) to authenticated;
