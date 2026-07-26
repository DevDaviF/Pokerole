-- ============================================================
-- Migração 8: itens personalizados do Mestre, disponíveis na
-- loja de todos os treinadores da mesa.
-- Cole no SQL Editor e Run. Idempotente (pode rodar de novo).
-- ============================================================

create table if not exists public.custom_items (
  id uuid primary key default gen_random_uuid(),
  mesa_id uuid not null references public.mesas (id) on delete cascade,
  created_by uuid references auth.users (id),
  name text not null check (char_length(trim(name)) between 1 and 60),
  description text not null default '' check (char_length(description) <= 500),
  pocket text not null default 'TrainerItems',
  price integer not null check (price >= 0),
  one_use boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists custom_items_mesa on public.custom_items (mesa_id);

alter table public.custom_items enable row level security;

drop policy if exists "mesa ve itens personalizados" on public.custom_items;
drop policy if exists "mestre cria item personalizado" on public.custom_items;
drop policy if exists "mestre apaga item personalizado" on public.custom_items;

create policy "mesa ve itens personalizados" on public.custom_items
  for select to authenticated
  using (public.is_mesa_member(mesa_id));

create policy "mestre cria item personalizado" on public.custom_items
  for insert to authenticated
  with check (public.is_mesa_gm(mesa_id) and created_by = auth.uid());

create policy "mestre apaga item personalizado" on public.custom_items
  for delete to authenticated
  using (public.is_mesa_gm(mesa_id));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'custom_items'
  ) then
    alter publication supabase_realtime add table public.custom_items;
  end if;
end $$;

alter table public.custom_items replica identity full;
