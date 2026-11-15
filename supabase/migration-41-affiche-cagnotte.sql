-- =====================================================================
-- COTIZ — MISE À JOUR n°41 : AFFICHE DE CAGNOTTE TOUTE PRÊTE
-- L'affiche (image partagée sur WhatsApp) est fabriquée à l'avance et rangée
-- comme une image : WhatsApp l'affiche tout de suite, sans attendre.
-- Supabase > SQL Editor > New query > coller TOUT > Run  →  « Success »
-- Relançable sans danger. À lancer APRÈS la n°40.
-- =====================================================================

alter table public.groups add column if not exists public_apercu text;
alter table public.groups add column if not exists public_apercu_le timestamptz;

-- La page publique (lisible par tout le monde, sans compte) : seulement si le trésorier l'a publiée
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
    'apercu', q.public_apercu, 'apercu_le', q.public_apercu_le,
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

