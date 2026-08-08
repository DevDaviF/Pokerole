-- ============================================================
-- Migração 17: nome de usuário único (case-insensitive) — hoje dois
-- jogadores podem ter o mesmo nome de exibição, abrindo espaço pra
-- se passar por outra pessoa na mesa (ex: fingir ser o Mestre).
-- Cole no SQL Editor e Run. Idempotente (pode rodar de novo).
-- ============================================================

-- Antes de travar a unicidade, resolve qualquer duplicata já
-- existente renomeando as repetidas com um sufixo curto (baseado no
-- próprio id, mesmo padrão do nome-padrão em handle_new_user) — sem
-- isso a criação do índice único abaixo falharia se já existir
-- alguma colisão hoje.
do $$
declare
  r record;
begin
  for r in
    select id, username,
      row_number() over (partition by lower(username) order by created_at, id) as rn
    from public.profiles
  loop
    if r.rn > 1 then
      update public.profiles
        set username = r.username || '-' || substr(r.id::text, 1, 4)
        where id = r.id;
    end if;
  end loop;
end $$;

-- Unicidade CASE-INSENSITIVE: "GameMaster" e "gamemaster" contam como
-- o mesmo nome — um UNIQUE simples na coluna não pegaria esse caso, e
-- é justamente o tipo de "quase igual" que confunde na mesa.
create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username));

-- Pré-checagem de disponibilidade ANTES de criar a conta: profiles
-- tem RLS (ninguém não-autenticado consegue ler a tabela), então o
-- formulário de cadastro precisa de uma função com acesso controlado
-- pra só responder "disponível ou não", sem expor a lista de usuários.
create or replace function public.username_available(_username text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select not exists (
    select 1 from public.profiles where lower(username) = lower(trim(_username))
  );
$$;

revoke execute on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;
