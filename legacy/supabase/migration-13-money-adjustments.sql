-- ============================================================
-- Migração 13: dinheiro só pode ser adicionado/removido pelo Mestre
-- (fora de compras na Loja, que já descontam certinho). O Mestre manda
-- um ajuste pra um jogador específico; o cliente do jogador aplica
-- sozinho (é uma correção autoritativa, não um presente pra recusar).
-- Cole no SQL Editor e Run. Idempotente (pode rodar de novo).
-- ============================================================

create table if not exists public.money_adjustments (
  id uuid primary key default gen_random_uuid(),
  mesa_id uuid not null references public.mesas (id) on delete cascade,
  from_user_id uuid not null references auth.users (id) on delete cascade,
  to_user_id uuid not null references auth.users (id) on delete cascade,
  amount integer not null check (amount <> 0),
  created_at timestamptz not null default now()
);

alter table public.money_adjustments enable row level security;

drop policy if exists "mestre ajusta dinheiro de jogador" on public.money_adjustments;
create policy "mestre ajusta dinheiro de jogador" on public.money_adjustments
  for insert to authenticated
  with check (from_user_id = auth.uid() and public.is_mesa_gm(mesa_id));

drop policy if exists "destinatario ve e apaga o ajuste aplicado" on public.money_adjustments;
create policy "destinatario ve e apaga o ajuste aplicado" on public.money_adjustments
  for select to authenticated
  using (to_user_id = auth.uid() or from_user_id = auth.uid());

drop policy if exists "destinatario apaga apos aplicar" on public.money_adjustments;
create policy "destinatario apaga apos aplicar" on public.money_adjustments
  for delete to authenticated
  using (to_user_id = auth.uid() or from_user_id = auth.uid());

alter publication supabase_realtime add table public.money_adjustments;
alter table public.money_adjustments replica identity full;
