-- ============================================================
-- Diagnóstico + reaplicação das políticas (pode rodar quantas
-- vezes quiser — é idempotente). Cole tudo no SQL Editor e Run.
-- O resultado no final lista as políticas ativas.
-- ============================================================

-- Recria as funções/triggers de apoio (create or replace = seguro)
create or replace function public.is_mesa_member(_mesa uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.mesa_members
    where mesa_id = _mesa and user_id = auth.uid()
  );
$$;

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
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_new_mesa()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.mesa_members (mesa_id, user_id)
  values (new.id, new.owner_id)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_mesa_created on public.mesas;
create trigger on_mesa_created
  after insert on public.mesas
  for each row execute function public.handle_new_mesa();

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
  insert into public.mesa_members (mesa_id, user_id)
    values (_mesa, auth.uid())
    on conflict do nothing;
  return _mesa;
end;
$$;

revoke execute on function public.join_mesa(text) from public, anon;
grant execute on function public.join_mesa(text) to authenticated;

-- Cria o perfil do seu usuário se ele foi cadastrado antes do trigger existir
insert into public.profiles (id, username)
select u.id, coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'username'), ''),
    'Treinador-' || substr(u.id::text, 1, 4))
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- Garante RLS ligada
alter table public.profiles enable row level security;
alter table public.mesas enable row level security;
alter table public.mesa_members enable row level security;
alter table public.messages enable row level security;
alter table public.shared_sheets enable row level security;

-- ── profiles ─────────────────────────────────────────────────
drop policy if exists "ver perfis da mesa" on public.profiles;
drop policy if exists "editar o próprio perfil" on public.profiles;

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

-- ── mesas ────────────────────────────────────────────────────
drop policy if exists "membro vê a mesa" on public.mesas;
drop policy if exists "criar mesa" on public.mesas;
drop policy if exists "dono exclui a mesa" on public.mesas;

create policy "membro vê a mesa" on public.mesas
  for select to authenticated
  using (owner_id = auth.uid() or public.is_mesa_member(id));

create policy "criar mesa" on public.mesas
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy "dono exclui a mesa" on public.mesas
  for delete to authenticated
  using (owner_id = auth.uid());

-- ── mesa_members ─────────────────────────────────────────────
drop policy if exists "ver membros da mesa" on public.mesa_members;
drop policy if exists "sair da mesa" on public.mesa_members;

create policy "ver membros da mesa" on public.mesa_members
  for select to authenticated
  using (public.is_mesa_member(mesa_id));

create policy "sair da mesa" on public.mesa_members
  for delete to authenticated
  using (user_id = auth.uid());

-- ── messages ─────────────────────────────────────────────────
drop policy if exists "membro lê mensagens" on public.messages;
drop policy if exists "membro envia mensagem" on public.messages;

create policy "membro lê mensagens" on public.messages
  for select to authenticated
  using (public.is_mesa_member(mesa_id));

create policy "membro envia mensagem" on public.messages
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_mesa_member(mesa_id));

-- ── shared_sheets ────────────────────────────────────────────
drop policy if exists "mesa vê fichas compartilhadas" on public.shared_sheets;
drop policy if exists "dono publica ficha" on public.shared_sheets;
drop policy if exists "dono atualiza ficha" on public.shared_sheets;
drop policy if exists "dono remove ficha" on public.shared_sheets;

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

-- ── Diagnóstico: lista o que ficou ativo ─────────────────────
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
