-- ============================================================
-- Migração 9: Mestre presenteia itens (do catálogo oficial ou
-- personalizados, mesmo os "Not for Sale") direto pro inventário
-- de um jogador.
-- Cole no SQL Editor e Run. Idempotente (pode rodar de novo).
-- ============================================================

create table if not exists public.item_gifts (
  id uuid primary key default gen_random_uuid(),
  mesa_id uuid not null references public.mesas (id) on delete cascade,
  from_user_id uuid not null references auth.users (id) on delete cascade,
  to_user_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null,
  item_name text not null,
  qty integer not null check (qty > 0),
  created_at timestamptz not null default now()
);

create index if not exists item_gifts_to_user on public.item_gifts (to_user_id, mesa_id);

alter table public.item_gifts enable row level security;

drop policy if exists "remetente ou destinatario veem o presente" on public.item_gifts;
drop policy if exists "mestre presenteia item" on public.item_gifts;
drop policy if exists "remetente ou destinatario apagam o presente" on public.item_gifts;

create policy "remetente ou destinatario veem o presente" on public.item_gifts
  for select to authenticated
  using (to_user_id = auth.uid() or from_user_id = auth.uid());

create policy "mestre presenteia item" on public.item_gifts
  for insert to authenticated
  with check (
    from_user_id = auth.uid()
    and public.is_mesa_gm(mesa_id)
    and exists (
      select 1 from public.mesa_members
      where mesa_id = item_gifts.mesa_id and user_id = item_gifts.to_user_id
    )
  );

create policy "remetente ou destinatario apagam o presente" on public.item_gifts
  for delete to authenticated
  using (to_user_id = auth.uid() or from_user_id = auth.uid());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'item_gifts'
  ) then
    alter publication supabase_realtime add table public.item_gifts;
  end if;
end $$;

alter table public.item_gifts replica identity full;
