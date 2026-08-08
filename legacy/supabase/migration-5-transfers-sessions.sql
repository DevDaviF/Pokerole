-- ============================================================
-- Migração 5: Transferência de fichas (captura) + Histórico de
-- sessões (anotações arquivadas).
-- Cole no SQL Editor e Run. Idempotente (pode rodar de novo).
-- ============================================================

-- ── Transferência de fichas de Pokémon entre jogadores ───────
-- Usado quando o Mestre entrega um Pokémon (ex: capturado) para
-- um jogador. O destinatário aceita e a ficha entra no Dexie dele.
create table if not exists public.sheet_transfers (
  id uuid primary key default gen_random_uuid(),
  mesa_id uuid not null references public.mesas (id) on delete cascade,
  from_user_id uuid not null references auth.users (id) on delete cascade,
  to_user_id uuid not null references auth.users (id) on delete cascade,
  payload jsonb not null check (pg_column_size(payload) <= 65536),
  created_at timestamptz not null default now()
);

create index if not exists sheet_transfers_to_user
  on public.sheet_transfers (to_user_id, mesa_id);

alter table public.sheet_transfers enable row level security;

drop policy if exists "remetente ou destinatario veem a transferencia" on public.sheet_transfers;
drop policy if exists "membro cria transferencia" on public.sheet_transfers;
drop policy if exists "remetente ou destinatario apagam a transferencia" on public.sheet_transfers;

create policy "remetente ou destinatario veem a transferencia" on public.sheet_transfers
  for select to authenticated
  using (to_user_id = auth.uid() or from_user_id = auth.uid());

create policy "membro cria transferencia" on public.sheet_transfers
  for insert to authenticated
  with check (
    from_user_id = auth.uid()
    and public.is_mesa_member(mesa_id)
    and exists (
      select 1 from public.mesa_members
      where mesa_id = sheet_transfers.mesa_id and user_id = sheet_transfers.to_user_id
    )
  );

create policy "remetente ou destinatario apagam a transferencia" on public.sheet_transfers
  for delete to authenticated
  using (to_user_id = auth.uid() or from_user_id = auth.uid());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'sheet_transfers'
  ) then
    alter publication supabase_realtime add table public.sheet_transfers;
  end if;
end $$;

-- ── Histórico de sessões (anotações arquivadas por data) ─────
create table if not exists public.session_notes (
  id uuid primary key default gen_random_uuid(),
  mesa_id uuid not null references public.mesas (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 80),
  content text not null default '' check (char_length(content) <= 20000),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists session_notes_mesa
  on public.session_notes (mesa_id, created_at desc);

alter table public.session_notes enable row level security;

drop policy if exists "mesa le o historico" on public.session_notes;
drop policy if exists "membro arquiva sessao" on public.session_notes;
drop policy if exists "membro edita sessao arquivada" on public.session_notes;
drop policy if exists "autor ou mestre apaga sessao" on public.session_notes;

create policy "mesa le o historico" on public.session_notes
  for select to authenticated
  using (public.is_mesa_member(mesa_id));

create policy "membro arquiva sessao" on public.session_notes
  for insert to authenticated
  with check (public.is_mesa_member(mesa_id) and created_by = auth.uid());

create policy "membro edita sessao arquivada" on public.session_notes
  for update to authenticated
  using (public.is_mesa_member(mesa_id))
  with check (public.is_mesa_member(mesa_id));

create policy "autor ou mestre apaga sessao" on public.session_notes
  for delete to authenticated
  using (created_by = auth.uid() or public.is_mesa_gm(mesa_id));

-- ── Diagnóstico ──────────────────────────────────────────────
select tablename, policyname, cmd from pg_policies
where schemaname = 'public' and tablename in ('sheet_transfers', 'session_notes')
order by tablename, policyname;
