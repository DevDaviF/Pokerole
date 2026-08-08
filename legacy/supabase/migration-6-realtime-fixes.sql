-- ============================================================
-- Migração 6: corrige dois bugs relatados em produção.
-- Cole no SQL Editor e Run. Idempotente (pode rodar de novo).
-- ============================================================

-- 1) "Compartilhar minha ficha" demorava a aparecer para os outros
--    jogadores: shared_sheets nunca tinha sido adicionada à publicação
--    de realtime (só era buscada uma vez, ao entrar na mesa).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'shared_sheets'
  ) then
    alter publication supabase_realtime add table public.shared_sheets;
  end if;
end $$;

-- 2) "Cannot read properties of undefined (reading 'length')" na Ordem
--    de Combate: com REPLICA IDENTITY padrão, updates em colunas jsonb
--    grandes (TOAST) podem chegar incompletos via realtime para quem
--    está assistindo. REPLICA IDENTITY FULL garante que a linha
--    completa sempre vá junto no evento.
alter table public.battle_order replica identity full;
alter table public.shared_sheets replica identity full;
alter table public.scout_rolls replica identity full;
alter table public.mesa_notes replica identity full;
