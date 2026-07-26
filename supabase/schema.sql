-- ============================================================
-- Pokérole 3.0 — schema + RLS
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute.
-- Princípios: RLS em tudo; ninguém lê nada de mesa que não é sua;
-- entrada em mesa só por código de convite via função controlada.
-- ============================================================

-- ── Perfis (username público dentro das mesas) ───────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (char_length(trim(username)) between 3 and 24),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
      'Treinador-' || substr(new.id::text, 1, 4)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Mesas e membros ──────────────────────────────────────────
create table public.mesas (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 40),
  invite_code text not null unique
    default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)),
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.mesa_members (
  mesa_id uuid not null references public.mesas (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'player' check (role in ('gm', 'player')),
  joined_at timestamptz not null default now(),
  primary key (mesa_id, user_id)
);

-- Helper security definer: evita recursão de RLS e centraliza a checagem
create or replace function public.is_mesa_member(_mesa uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.mesa_members
    where mesa_id = _mesa and user_id = auth.uid()
  );
$$;

-- Dono vira membro (com papel de Mestre) automaticamente
create or replace function public.handle_new_mesa()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.mesa_members (mesa_id, user_id, role)
  values (new.id, new.owner_id, 'gm');

  insert into public.mesa_notes (mesa_id, content)
  values (new.id, '');

  insert into public.battle_order (mesa_id)
  values (new.id);

  insert into public.scout_rolls (mesa_id)
  values (new.id);

  return new;
end;
$$;

create trigger on_mesa_created
  after insert on public.mesas
  for each row execute function public.handle_new_mesa();

-- Entrar numa mesa por código, sem expor SELECT geral em mesas
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

-- ── Chat + rolls ─────────────────────────────────────────────
create table public.messages (
  id bigint generated always as identity primary key,
  mesa_id uuid not null references public.mesas (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'chat' check (kind in ('chat', 'roll')),
  content text not null default '' check (char_length(content) <= 2000),
  roll jsonb check (roll is null or pg_column_size(roll) <= 4096),
  created_at timestamptz not null default now()
);

create index messages_mesa_created on public.messages (mesa_id, created_at desc);

-- ── Fichas compartilhadas (snapshot somente leitura p/ a mesa) ─
create table public.shared_sheets (
  id uuid primary key default gen_random_uuid(),
  mesa_id uuid not null references public.mesas (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('trainer', 'pokemon')),
  local_id integer not null,
  payload jsonb not null check (pg_column_size(payload) <= 65536),
  updated_at timestamptz not null default now(),
  unique (mesa_id, owner_id, kind, local_id)
);

-- ── Anotações compartilhadas da mesa ─────────────────────────
create table public.mesa_notes (
  mesa_id uuid primary key references public.mesas (id) on delete cascade,
  content text not null default '' check (char_length(content) <= 20000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

-- ── Rastreador de Iniciativa / Ordem de Combate ──────────────
create table public.battle_order (
  mesa_id uuid primary key references public.mesas (id) on delete cascade,
  combatants jsonb not null default '[]'
    check (pg_column_size(combatants) <= 20000),
  current_key text,
  started boolean not null default false,
  round integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

-- ── Batedores compartilhados (soma de rolls de vários Treinadores) ─
create table public.scout_rolls (
  mesa_id uuid primary key references public.mesas (id) on delete cascade,
  total integer not null default 0,
  contributors jsonb not null default '[]'
    check (pg_column_size(contributors) <= 10000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

-- Helper: caller é Mestre desta mesa? (usado para transferir o cargo)
create or replace function public.is_mesa_gm(_mesa uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.mesa_members
    where mesa_id = _mesa and user_id = auth.uid() and role = 'gm'
  );
$$;

-- ── RLS ──────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.mesas enable row level security;
alter table public.mesa_members enable row level security;
alter table public.messages enable row level security;
alter table public.shared_sheets enable row level security;
alter table public.mesa_notes enable row level security;
alter table public.battle_order enable row level security;
alter table public.scout_rolls enable row level security;

-- profiles: você vê o seu e o de quem divide mesa com você
create policy "ver perfis da mesa" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.mesa_members me
      join public.mesa_members outro on outro.mesa_id = me.mesa_id
      where me.user_id = auth.uid() and outro.user_id = profiles.id
    )
  );

create policy "editar o próprio perfil" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- mesas: dono/membro vê; qualquer autenticado cria (como dono); dono exclui
-- (o dono precisa constar explicitamente: no INSERT ... RETURNING a checagem
-- de SELECT roda antes do trigger que o adiciona como membro)
create policy "membro vê a mesa" on public.mesas
  for select to authenticated
  using (owner_id = auth.uid() or public.is_mesa_member(id));

create policy "criar mesa" on public.mesas
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy "dono exclui a mesa" on public.mesas
  for delete to authenticated
  using (owner_id = auth.uid());

-- mesa_members: membro vê a lista da própria mesa; sair = deletar a si mesmo
create policy "ver membros da mesa" on public.mesa_members
  for select to authenticated
  using (public.is_mesa_member(mesa_id));

create policy "sair da mesa" on public.mesa_members
  for delete to authenticated
  using (user_id = auth.uid());

create policy "mestre transfere papéis" on public.mesa_members
  for update to authenticated
  using (public.is_mesa_gm(mesa_id))
  with check (public.is_mesa_gm(mesa_id));

-- messages: só membros leem/escrevem; escreve sempre em nome próprio
create policy "membro lê mensagens" on public.messages
  for select to authenticated
  using (public.is_mesa_member(mesa_id));

create policy "membro envia mensagem" on public.messages
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_mesa_member(mesa_id));

-- shared_sheets: mesa lê; só o dono cria/atualiza/remove
create policy "mesa vê fichas compartilhadas" on public.shared_sheets
  for select to authenticated
  using (public.is_mesa_member(mesa_id));

create policy "dono publica ficha" on public.shared_sheets
  for insert to authenticated
  with check (owner_id = auth.uid() and public.is_mesa_member(mesa_id));

create policy "dono atualiza ficha" on public.shared_sheets
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and public.is_mesa_member(mesa_id));

create policy "dono remove ficha" on public.shared_sheets
  for delete to authenticated
  using (owner_id = auth.uid());

-- mesa_notes: mesa lê; qualquer membro edita (bloco de notas compartilhado)
create policy "mesa lê anotações" on public.mesa_notes
  for select to authenticated
  using (public.is_mesa_member(mesa_id));

create policy "mesa edita anotações" on public.mesa_notes
  for update to authenticated
  using (public.is_mesa_member(mesa_id))
  with check (public.is_mesa_member(mesa_id));

-- battle_order: mesa lê; qualquer membro edita (avança turno, adiciona/remove)
create policy "mesa lê a ordem de combate" on public.battle_order
  for select to authenticated
  using (public.is_mesa_member(mesa_id));

create policy "mesa edita a ordem de combate" on public.battle_order
  for update to authenticated
  using (public.is_mesa_member(mesa_id))
  with check (public.is_mesa_member(mesa_id));

-- scout_rolls: mesa lê; qualquer membro contribui com sua rolagem
create policy "mesa lê batedores" on public.scout_rolls
  for select to authenticated
  using (public.is_mesa_member(mesa_id));

create policy "mesa contribui com batedores" on public.scout_rolls
  for update to authenticated
  using (public.is_mesa_member(mesa_id))
  with check (public.is_mesa_member(mesa_id));

-- ── Realtime no chat, anotações, combate e batedores ───────────
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.mesa_notes;
alter publication supabase_realtime add table public.battle_order;
alter publication supabase_realtime add table public.scout_rolls;

-- ── Transferência de fichas de Pokémon entre jogadores ───────
create table public.sheet_transfers (
  id uuid primary key default gen_random_uuid(),
  mesa_id uuid not null references public.mesas (id) on delete cascade,
  from_user_id uuid not null references auth.users (id) on delete cascade,
  to_user_id uuid not null references auth.users (id) on delete cascade,
  payload jsonb not null check (pg_column_size(payload) <= 65536),
  created_at timestamptz not null default now()
);

create index sheet_transfers_to_user on public.sheet_transfers (to_user_id, mesa_id);

alter table public.sheet_transfers enable row level security;

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

alter publication supabase_realtime add table public.sheet_transfers;

-- ── Histórico de sessões (anotações arquivadas por data) ─────
create table public.session_notes (
  id uuid primary key default gen_random_uuid(),
  mesa_id uuid not null references public.mesas (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 80),
  content text not null default '' check (char_length(content) <= 20000),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index session_notes_mesa on public.session_notes (mesa_id, created_at desc);

alter table public.session_notes enable row level security;

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
