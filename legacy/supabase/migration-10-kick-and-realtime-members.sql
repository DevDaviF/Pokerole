-- ============================================================
-- Migração 10: Mestre pode expulsar membro da mesa, e a lista de
-- membros atualiza em tempo real (entrar/sair/expulsar).
-- Cole no SQL Editor e Run. Idempotente (pode rodar de novo).
-- ============================================================

drop policy if exists "mestre expulsa membro" on public.mesa_members;

create policy "mestre expulsa membro" on public.mesa_members
  for delete to authenticated
  using (public.is_mesa_gm(mesa_id));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'mesa_members'
  ) then
    alter publication supabase_realtime add table public.mesa_members;
  end if;
end $$;

alter table public.mesa_members replica identity full;
