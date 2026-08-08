-- ============================================================
-- Migração 12: "Passar o dia" vira uma decisão do Mestre pra mesa
-- inteira (não mais um botão livre por jogador) — o Mestre decreta e
-- cada jogador aplica o descanso na própria ficha local. Cole no SQL
-- Editor e Run. Idempotente (pode rodar de novo).
-- ============================================================

create table if not exists public.day_pass_triggers (
  mesa_id uuid primary key references public.mesas (id) on delete cascade,
  triggered_at timestamptz,
  triggered_by uuid references auth.users (id)
);

-- mesas já existentes não passam pelo trigger de criação — garante que
-- todo mundo tenha a linha
insert into public.day_pass_triggers (mesa_id)
select id from public.mesas
on conflict (mesa_id) do nothing;

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

  insert into public.day_pass_triggers (mesa_id)
  values (new.id);

  return new;
end;
$$;

alter table public.day_pass_triggers enable row level security;

drop policy if exists "mesa lê o gatilho de passar o dia" on public.day_pass_triggers;
create policy "mesa lê o gatilho de passar o dia" on public.day_pass_triggers
  for select to authenticated
  using (public.is_mesa_member(mesa_id));

drop policy if exists "mestre decreta o dia" on public.day_pass_triggers;
create policy "mestre decreta o dia" on public.day_pass_triggers
  for update to authenticated
  using (public.is_mesa_gm(mesa_id))
  with check (public.is_mesa_gm(mesa_id));

alter publication supabase_realtime add table public.day_pass_triggers;
alter table public.day_pass_triggers replica identity full;
