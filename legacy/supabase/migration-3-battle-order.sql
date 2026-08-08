-- ============================================================
-- Migração 3: Rastreador de Iniciativa / Ordem de Combate
-- Cole no SQL Editor e Run. Idempotente (pode rodar de novo).
-- ============================================================

create table if not exists public.battle_order (
  mesa_id uuid primary key references public.mesas (id) on delete cascade,
  -- combatants: [{ key, name, kind: 'pokemon'|'trainer'|'npc',
  --   initiative, spriteId?, ownerLabel? }, ...], já ordenado por iniciativa
  combatants jsonb not null default '[]'
    check (pg_column_size(combatants) <= 20000),
  -- key (não índice!) de quem está na vez — imune a reordenação ao
  -- adicionar/remover combatentes
  current_key text,
  -- enquanto false (fase de montar a lista), quem tem a vez é sempre
  -- recalculado como a maior iniciativa; vira true no 1º "Passar a vez"
  started boolean not null default false,
  round integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

-- caso a tabela já exista de uma execução anterior desta migração
alter table public.battle_order
  add column if not exists started boolean not null default false;

-- cria a linha para mesas que já existiam
insert into public.battle_order (mesa_id)
select id from public.mesas
where not exists (
  select 1 from public.battle_order where battle_order.mesa_id = mesas.id
);

alter table public.battle_order enable row level security;

drop policy if exists "mesa lê a ordem de combate" on public.battle_order;
drop policy if exists "mesa edita a ordem de combate" on public.battle_order;

create policy "mesa lê a ordem de combate" on public.battle_order
  for select to authenticated
  using (public.is_mesa_member(mesa_id));

create policy "mesa edita a ordem de combate" on public.battle_order
  for update to authenticated
  using (public.is_mesa_member(mesa_id))
  with check (public.is_mesa_member(mesa_id));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'battle_order'
  ) then
    alter publication supabase_realtime add table public.battle_order;
  end if;
end $$;

-- cria a linha de battle_order automaticamente para mesas novas
create or replace function public.handle_new_mesa()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.mesa_members (mesa_id, user_id, role)
  values (new.id, new.owner_id, 'gm')
  on conflict do nothing;

  insert into public.mesa_notes (mesa_id, content)
  values (new.id, '')
  on conflict do nothing;

  insert into public.battle_order (mesa_id)
  values (new.id)
  on conflict do nothing;

  return new;
end;
$$;

-- ── Diagnóstico ──────────────────────────────────────────────
select tablename, policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'battle_order'
order by policyname;
