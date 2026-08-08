-- ============================================================
-- Migração 14: ocultar ficha compartilhada sem precisar parar de
-- compartilhar. O dono pode ligar/desligar `hidden` — enquanto ligado,
-- a mesa vê só o nome (igual já acontecia com selvagem/ginásio não
-- capturado), sem precisar excluir a linha e perder a atualização
-- automática de HP/status feita pelo Rastreador de Combate.
-- Cole no SQL Editor e Run. Idempotente (pode rodar de novo).
-- ============================================================

alter table public.shared_sheets
  add column if not exists hidden boolean not null default false;
