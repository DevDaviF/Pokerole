-- ============================================================
-- Migração 4: Batedores compartilhados (soma de rolls de vários
-- Treinadores) + transferência do cargo de Mestre.
-- Cole no SQL Editor e Run. Idempotente (pode rodar de novo).
-- ============================================================

-- ── Contagem compartilhada de batedores ──────────────────────
create table if not exists public.scout_rolls (
  mesa_id uuid primary key references public.mesas (id) on delete cascade,
  total integer not null default 0,
  -- contributors: [{ name, successes, at }, ...]
  contributors jsonb not null default '[]'
    check (pg_column_size(contributors) <= 10000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

insert into public.scout_rolls (mesa_id)
select id from public.mesas
where not exists (
  select 1 from public.scout_rolls where scout_rolls.mesa_id = mesas.id
);

alter table public.scout_rolls enable row level security;

drop policy if exists "mesa lê batedores" on public.scout_rolls;
drop policy if exists "mesa contribui com batedores" on public.scout_rolls;

create policy "mesa lê batedores" on public.scout_rolls
  for select to authenticated
  using (public.is_mesa_member(mesa_id));

create policy "mesa contribui com batedores" on public.scout_rolls
  for update to authenticated
  using (public.is_mesa_member(mesa_id))
  with check (public.is_mesa_member(mesa_id));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'scout_rolls'
  ) then
    alter publication supabase_realtime add table public.scout_rolls;
  end if;
end $$;

-- cria a linha de scout_rolls automaticamente para mesas novas
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

  insert into public.scout_rolls (mesa_id)
  values (new.id)
  on conflict do nothing;

  return new;
end;
$$;

-- ── Transferência do cargo de Mestre ──────────────────────────
create or replace function public.is_mesa_gm(_mesa uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.mesa_members
    where mesa_id = _mesa and user_id = auth.uid() and role = 'gm'
  );
$$;

drop policy if exists "mestre transfere papéis" on public.mesa_members;
create policy "mestre transfere papéis" on public.mesa_members
  for update to authenticated
  using (public.is_mesa_gm(mesa_id))
  with check (public.is_mesa_gm(mesa_id));

-- ── Diagnóstico ──────────────────────────────────────────────
select tablename, policyname, cmd from pg_policies
where schemaname = 'public' and tablename in ('scout_rolls', 'mesa_members')
order by tablename, policyname;
