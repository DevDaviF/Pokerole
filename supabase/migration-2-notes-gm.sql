-- ============================================================
-- Migração 2: Anotações da Mesa + papel de Mestre (GM)
-- Cole no SQL Editor e Run. Idempotente (pode rodar de novo).
-- ============================================================

-- ── Papel na mesa (gm / player) ──────────────────────────────
alter table public.mesa_members
  add column if not exists role text not null default 'player'
    check (role in ('gm', 'player'));

-- Corrige o dono de mesas já existentes: o ADD COLUMN acima marca todo
-- mundo como 'player' por padrão, mas quem é dono (mesas.owner_id) deve
-- ser 'gm'.
update public.mesa_members mm
set role = 'gm'
from public.mesas m
where m.id = mm.mesa_id
  and m.owner_id = mm.user_id
  and mm.role <> 'gm';

-- ── Anotações compartilhadas da mesa ─────────────────────────
create table if not exists public.mesa_notes (
  mesa_id uuid primary key references public.mesas (id) on delete cascade,
  content text not null default '' check (char_length(content) <= 20000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

-- Cria a linha para mesas que já existiam antes desta migração
insert into public.mesa_notes (mesa_id, content)
select id, '' from public.mesas
where not exists (
  select 1 from public.mesa_notes where mesa_notes.mesa_id = mesas.id
);

alter table public.mesa_notes enable row level security;

drop policy if exists "mesa lê anotações" on public.mesa_notes;
drop policy if exists "mesa edita anotações" on public.mesa_notes;

create policy "mesa lê anotações" on public.mesa_notes
  for select to authenticated
  using (public.is_mesa_member(mesa_id));

-- Qualquer membro pode editar (bloco de notas compartilhado da campanha)
create policy "mesa edita anotações" on public.mesa_notes
  for update to authenticated
  using (public.is_mesa_member(mesa_id))
  with check (public.is_mesa_member(mesa_id));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'mesa_notes'
  ) then
    alter publication supabase_realtime add table public.mesa_notes;
  end if;
end $$;

-- ── O dono da mesa entra automaticamente como 'gm' ───────────
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

  return new;
end;
$$;

drop trigger if exists on_mesa_created on public.mesas;
create trigger on_mesa_created
  after insert on public.mesas
  for each row execute function public.handle_new_mesa();

-- ── Quem entra por código vira 'player' ───────────────────────
create or replace function public.join_mesa(_code text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  _mesa uuid;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;
  select id into _mesa from public.mesas
    where invite_code = upper(trim(_code));
  if _mesa is null then
    raise exception 'Código de convite inválido';
  end if;
  insert into public.mesa_members (mesa_id, user_id, role)
    values (_mesa, auth.uid(), 'player')
    on conflict do nothing;
  return _mesa;
end;
$$;

revoke execute on function public.join_mesa(text) from public, anon;
grant execute on function public.join_mesa(text) to authenticated;

-- ── Diagnóstico ──────────────────────────────────────────────
select tablename, policyname, cmd from pg_policies
where schemaname = 'public' and tablename in ('mesa_notes', 'mesa_members')
order by tablename, policyname;
