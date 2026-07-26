-- ============================================================
-- Migração 11: bucket de Storage pra hospedar o PDF do Corebook.
-- Cole no SQL Editor e Run. Idempotente (pode rodar de novo).
--
-- O plano free do Supabase limita upload a 50MB por arquivo, e o PDF
-- original tem ~172MB — por isso ele foi dividido em 6 partes bem
-- menores (14 a 41MB cada), geradas em
-- C:\Users\Davi\OneDrive\Documentos\book-chunks\
--
-- Depois de rodar isso, faça o upload manual das 6 partes:
-- Dashboard do Supabase → Storage → bucket "corebook" → Upload file
-- → selecione os 6 arquivos "pokerole-corebook-3.0-part1.pdf" até
-- "...part6.pdf" (pode selecionar os 6 de uma vez) → mantenha os
-- nomes exatos (minúsculo, com hífens).
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('corebook', 'corebook', true, 52428800) -- 50MB
on conflict (id) do update set public = true, file_size_limit = 52428800;

drop policy if exists "corebook e publico pra leitura" on storage.objects;

create policy "corebook e publico pra leitura" on storage.objects
  for select
  using (bucket_id = 'corebook');
