-- Cole no SQL Editor e Run. Parte 1: função de diagnóstico que o app
-- usa para ver quem o banco enxerga na sua sessão.
create or replace function public.whoami()
returns jsonb
language sql stable
as $$
  select jsonb_build_object(
    'uid', auth.uid(),
    'role', auth.role()
  );
$$;

grant execute on function public.whoami() to authenticated, anon;

-- Parte 2: o que existe de política nas tabelas (me mande o resultado)
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
