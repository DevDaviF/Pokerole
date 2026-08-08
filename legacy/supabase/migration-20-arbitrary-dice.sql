-- ============================================================
-- Migração 20: permite rolar dados "avulsos" (fora do sistema de
-- sucessos do Pokérole) pelo servidor — d4/d6/d8/d10/d12/d20/d100
-- com um modificador somado, tipo "3d6+20". Usado pelo comando de
-- chat (digitar "3d6+20" na caixa de mensagem) e pelo modo "🔢 Dado
-- avulso" do rolador flutuante.
--
-- Precisa recriar roll_dice_shared (migration-18/19) com um novo
-- parâmetro `_sides` e o modo 'sum'. Como muda a assinatura (arity),
-- derruba a versão antiga antes de criar a nova pra não sobrar as
-- duas (o que causaria "function is not unique" nas chamadas).
--
-- Cole no SQL Editor e Run. Idempotente.
-- ============================================================

drop function if exists public.roll_dice_shared(uuid, int, text, text, int, text);

create or replace function public.roll_dice_shared(
  _mesa_id uuid,
  _pool int,
  _label text default '',
  _mode text default 'standard',
  _bonus int default 0,
  _sides int default 6,
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
  _faces int;
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
  if _mode not in ('standard', 'chance', 'additive', 'sum') then
    raise exception 'Modo de rolagem inválido';
  end if;
  if _mode = 'sum' and _sides not in (2, 4, 6, 8, 10, 12, 20, 100) then
    raise exception 'Tipo de dado inválido';
  end if;

  -- Só o modo 'sum' (dado avulso) pode usar um número de faces diferente
  -- de 6 — os demais modos são mecânicas do Corebook, sempre d6.
  _faces := case when _mode = 'sum' then _sides else 6 end;

  if _mode = 'additive' then
    _dice := array[(1 + floor(random() * 6))::int];
  else
    select array_agg((1 + floor(random() * _faces))::int)
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
  elsif _mode = 'sum' then
    _roll := jsonb_build_object(
      'pool', array_length(_dice, 1), 'dice', to_jsonb(_dice),
      'successes', 0, 'sixes', _sixes,
      'mode', 'sum', 'sides', _sides, 'bonus', coalesce(_bonus, 0),
      'total', (select coalesce(sum(val), 0) from unnest(_dice) as val) + coalesce(_bonus, 0)
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

revoke execute on function public.roll_dice_shared(uuid, int, text, text, int, int, text) from public;
grant execute on function public.roll_dice_shared(uuid, int, text, text, int, int, text) to authenticated;
