-- ============================================================
-- Migração 19: eleva o limite de dados por rolagem em
-- roll_dice_shared (migration-18) de 20 para 100.
--
-- 20 era baixo demais — Pokémon de Rank alto (ex: gerados pelo
-- Mestre com STAB + bônus) podem facilmente passar disso. Acima do
-- limite a função rejeitava a chamada, e o roll caía no fallback
-- local do client (não aparecia no chat da mesa pra ninguém).
--
-- 100 continua bem acima de qualquer pool real do jogo, mas evita
-- generate_series de um número absurdo caso alguém tente abusar
-- (ex: pool = 2 bilhões).
--
-- Cole no SQL Editor e Run. Idempotente (create or replace).
-- ============================================================

create or replace function public.roll_dice_shared(
  _mesa_id uuid,
  _pool int,
  _label text default '',
  _mode text default 'standard',
  _bonus int default 0,
  _icon text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _dice int[];
  _successes int;
  _sixes int;
  _roll jsonb;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;
  if not public.is_mesa_member(_mesa_id) then
    raise exception 'Você não é membro dessa mesa';
  end if;
  if _pool is null or _pool < 1 or _pool > 100 then
    raise exception 'Pool de dados inválida (1 a 100)';
  end if;
  if _mode not in ('standard', 'chance', 'additive') then
    raise exception 'Modo de rolagem inválido';
  end if;

  if _mode = 'additive' then
    _dice := array[(1 + floor(random() * 6))::int];
  else
    select array_agg((1 + floor(random() * 6))::int)
      into _dice
      from generate_series(1, _pool);
  end if;

  _sixes := (select count(*) from unnest(_dice) as val where val = 6);

  if _mode = 'chance' then
    _roll := jsonb_build_object(
      'pool', array_length(_dice, 1), 'dice', to_jsonb(_dice),
      'successes', _sixes, 'sixes', _sixes,
      'mode', 'chance', 'triggered', _sixes > 0
    );
  elsif _mode = 'additive' then
    _roll := jsonb_build_object(
      'pool', 1, 'dice', to_jsonb(_dice),
      'successes', 0, 'sixes', _sixes,
      'mode', 'additive', 'bonus', coalesce(_bonus, 0),
      'total', _dice[1] + coalesce(_bonus, 0)
    );
  else
    _successes := (select count(*) from unnest(_dice) as val where val >= 4);
    _roll := jsonb_build_object(
      'pool', array_length(_dice, 1), 'dice', to_jsonb(_dice),
      'successes', _successes, 'sixes', _sixes
    );
  end if;

  if _icon is not null and length(_icon) <= 3000 then
    _roll := _roll || jsonb_build_object('icon', _icon);
  end if;

  insert into public.messages (mesa_id, user_id, kind, content, roll)
  values (_mesa_id, auth.uid(), 'roll', coalesce(_label, ''), _roll);

  return _roll;
end;
$$;

revoke execute on function public.roll_dice_shared(uuid, int, text, text, int, text) from public;
grant execute on function public.roll_dice_shared(uuid, int, text, text, int, text) to authenticated;
