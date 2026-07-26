-- ============================================================
-- Migração 11: bucket de Storage pra hospedar o PDF do Corebook.
-- Cole no SQL Editor e Run. Idempotente (pode rodar de novo).
--
-- Depois de rodar isso, faça o upload do PDF manualmente:
-- Dashboard do Supabase → Storage → bucket "corebook" → Upload file
-- → escolha o POKEROLE COREBOOK 3.0.pdf → salve com o nome exato
-- "pokerole-corebook-3.0.pdf" (tudo minúsculo, com hífens).
-- O arquivo é grande (~170MB) — o upload pelo Dashboard pode demorar
-- alguns minutos dependendo da sua internet.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('corebook', 'corebook', true)
on conflict (id) do update set public = true;

drop policy if exists "corebook e publico pra leitura" on storage.objects;

create policy "corebook e publico pra leitura" on storage.objects
  for select
  using (bucket_id = 'corebook');
