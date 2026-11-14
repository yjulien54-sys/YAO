-- =====================================================================
-- COTIZ — MISE À JOUR n°37 : CAGNOTTES PUBLIQUES PARTAGEABLES
-- Le trésorier d'une collecte (mariage, funérailles, baptême, santé…) peut la
-- rendre publique : une belle page avec photo, jauge de l'objectif et liste
-- des donateurs, à envoyer sur WhatsApp. Toute personne qui a le lien voit la
-- page et peut participer (elle entre directement dans la collecte).
-- Supabase > SQL Editor > New query > coller TOUT > Run  →  « Success »
-- Relançable sans danger. À lancer APRÈS la n°36.
-- =====================================================================

alter table public.groups add column if not exists public_slug text;
alter table public.groups add column if not exists public_actif boolean not null default false;
alter table public.groups add column if not exists public_photo text;
alter table public.groups add column if not exists public_montants boolean not null default true;
alter table public.groups add column if not exists public_message text;
alter table public.groups add column if not exists public_fin date;
alter table public.groups add column if not exists public_vues integer not null default 0;
create unique index if not exists groups_public_slug_idx on public.groups (public_slug) where public_slug is not null;

-- Photos des cagnottes : stockage public (lecture par tous), écriture par le responsable du groupe
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public) values ('cagnottes', 'cagnottes', true) on conflict (id) do update set public = true;
    drop policy if exists "cagnottes: responsable ajoute" on storage.objects;
    create policy "cagnottes: responsable ajoute" on storage.objects for insert to authenticated
      with check (bucket_id = 'cagnottes' and public.can_manage(((storage.foldername(name))[1])::uuid));
    drop policy if exists "cagnottes: responsable remplace" on storage.objects;
    create policy "cagnottes: responsable remplace" on storage.objects for update to authenticated
      using (bucket_id = 'cagnottes' and public.can_manage(((storage.foldername(name))[1])::uuid));
    drop policy if exists "cagnottes: responsable retire" on storage.objects;
    create policy "cagnottes: responsable retire" on storage.objects for delete to authenticated
      using (bucket_id = 'cagnottes' and public.can_manage(((storage.foldername(name))[1])::uuid));
  end if;
end $$;

-- Publier / modifier / retirer la page publique (créateur, trésorier ou co-gestionnaire)
create or replace function public.cagnotte_publier(g uuid, actif boolean, montants boolean default true, message text default null, photo text default null, fin date default null) returns text
language plpgsql security definer set search_path = public as $$
declare q groups; s text; base text;
begin
  if not public.can_manage(g) then raise exception 'Seul le trésorier peut publier la cagnotte'; end if;
  select * into q from groups where id = g;
  if q.type <> 'collecte' then raise exception 'Seules les collectes peuvent devenir des cagnottes publiques'; end if;
  s := q.public_slug;
  if s is null then
    base := trim(both '-' from regexp_replace(lower(translate(q.name, 'àâäáãéèêëíìîïóòôöõúùûüçñÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucnAAAEEEEIIOOUUUC')), '[^a-z0-9]+', '-', 'g'));
    s := left(coalesce(nullif(base, ''), 'cagnotte'), 40) || '-' || encode(extensions.gen_random_bytes(3), 'hex');
  end if;
  update groups set public_slug = s, public_actif = actif, public_montants = montants,
    public_message = left(nullif(trim(coalesce(message, '')), ''), 600),
    public_photo = case when photo is null then public_photo when photo = '' then null else left(photo, 500) end,
    public_fin = fin
  where id = g;
  if actif then insert into cles_invitation (group_id) values (g) on conflict (group_id) do nothing; end if;
  return s;
end $$;
revoke all on function public.cagnotte_publier(uuid, boolean, boolean, text, text, date) from public, anon;
grant execute on function public.cagnotte_publier(uuid, boolean, boolean, text, text, date) to authenticated;

-- La page publique (lisible par tout le monde, sans compte) : seulement si le trésorier l'a publiée
drop function if exists public.cagnotte_publique(text);
create or replace function public.cagnotte_publique(s text, compter boolean default true) returns json
language plpgsql security definer set search_path = public as $$
declare q groups; total integer; nb integer; k text; tres text;
begin
  select * into q from groups where public_slug = s and public_actif;
  if q.id is null then return null; end if;
  if compter then update groups set public_vues = public_vues + 1 where id = q.id; end if;
  select coalesce(sum(p.amount), 0), count(distinct p.member_id) into total, nb
    from payments p where p.group_id = q.id and coalesce(p.status, 'reussi') = 'reussi';
  select cle into k from cles_invitation where group_id = q.id;
  select split_part(trim(m.name), ' ', 1) into tres from members m where m.group_id = q.id and m.role = 'tresorier' order by m.turn_position limit 1;
  return json_build_object(
    'id', q.id, 'nom', q.name, 'description', q.description, 'cause', q.don_cause, 'message', q.public_message,
    'photo', q.public_photo, 'objectif', q.target, 'montant_suggere', nullif(q.amount, 0), 'collecte', total, 'donateurs_nb', nb,
    'montants', q.public_montants, 'fin', q.public_fin, 'tresorier', tres, 'cle', k, 'cree_le', q.created_at,
    'donateurs', (select coalesce(json_agg(d order by d.le desc), '[]') from (
      select split_part(trim(m.name), ' ', 1) || case when position(' ' in trim(m.name)) > 0 then ' ' || left(split_part(trim(m.name), ' ', 2), 1) || '.' else '' end as nom,
             case when q.public_montants then sum(p.amount) end as montant, max(p.created_at) as le
      from payments p join members m on m.id = p.member_id
      where p.group_id = q.id and coalesce(p.status, 'reussi') = 'reussi'
      group by m.id, m.name order by max(p.created_at) desc limit 40) d)
  );
end $$;
revoke all on function public.cagnotte_publique(text, boolean) from public;
grant execute on function public.cagnotte_publique(text, boolean) to anon, authenticated;

-- Pour l'écran du trésorier : l'état de la page publique de son groupe
create or replace function public.cagnotte_etat(g uuid) returns json
language plpgsql security definer set search_path = public as $$
declare q groups;
begin
  if not public.can_manage(g) then return null; end if;
  select * into q from groups where id = g;
  return json_build_object('slug', q.public_slug, 'actif', q.public_actif, 'photo', q.public_photo, 'montants', q.public_montants,
    'message', q.public_message, 'fin', q.public_fin, 'vues', q.public_vues);
end $$;
grant execute on function public.cagnotte_etat(uuid) to authenticated;
