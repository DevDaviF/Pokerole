-- ============================================================
-- Migração 7: modo de cálculo de bônus da Captura (dados extras
-- vs. modificador direto), configurável por mesa pelo Mestre.
-- Cole no SQL Editor e Run. Idempotente (pode rodar de novo).
-- ============================================================

alter table public.mesas
  add column if not exists capture_bonus_mode text not null default 'dice'
  check (capture_bonus_mode in ('dice', 'flat'));

drop policy if exists "mestre edita configuracoes da mesa" on public.mesas;

create policy "mestre edita configuracoes da mesa" on public.mesas
  for update to authenticated
  using (public.is_mesa_gm(id))
  with check (public.is_mesa_gm(id));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'mesas'
  ) then
    alter publication supabase_realtime add table public.mesas;
  end if;
end $$;
