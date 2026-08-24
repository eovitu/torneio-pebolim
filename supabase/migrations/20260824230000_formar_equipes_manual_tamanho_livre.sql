-- =============================================================================
-- Montagem manual de equipes com tamanho livre (1 ou 2 por equipe)
--
-- `formar_equipes_manual` já deixava o admin escolher QUEM entra em cada
-- equipe, mas travava a FORMA da montagem: o número de duplas e de "jogando
-- sozinho" tinha que bater exatamente com `composicao_de_equipes`, calculada
-- só a partir da quantidade de inscritos. Decisão do proprietário: o admin
-- passa a decidir livremente, equipe por equipe, se ela tem 1 ou 2 pessoas —
-- nunca mais que 2. A única exigência que continua é que todo mundo inscrito
-- esteja em alguma equipe.
--
-- `sortear_equipes` (o sorteio automático) não muda: continua usando
-- `composicao_de_equipes` normalmente.
-- =============================================================================

create or replace function formar_equipes_manual(p_tournament_id uuid, p_equipes jsonb)
returns table (team_id uuid, equipe text, player_id uuid, jogador text)
language plpgsql security definer set search_path = public as $$
declare
  t          tournaments%rowtype;
  inscritos  uuid[];
  usados     uuid[] := '{}';
  item       jsonb;
  ids        uuid[];
  tamanho_max int := 1;
  novo_time  uuid;
  nome_time  text;
  clube      clubs%rowtype;
  jid        uuid;
  i          int;
begin
  if not is_admin(auth.uid()) then
    raise exception 'somente administrador pode formar as equipes';
  end if;

  select * into t from tournaments where id = p_tournament_id for update;
  if t.id is null then raise exception 'torneio inexistente'; end if;
  if t.status <> 'CONFIGURACAO' then
    raise exception 'as equipes só são formadas com o torneio em configuração (está em %)', t.status;
  end if;
  if exists (select 1 from teams where tournament_id = p_tournament_id) then
    raise exception 'este torneio já tem equipes formadas; desfaça antes de montar de novo';
  end if;
  if jsonb_typeof(p_equipes) <> 'array' then
    raise exception 'a lista de equipes está malformada';
  end if;

  select array_agg(tp.player_id) into inscritos
    from tournament_participants tp where tp.tournament_id = p_tournament_id;

  -- Primeira passagem: conferir a montagem inteira antes de criar qualquer coisa.
  -- Cada equipe tem 1 ou 2 pessoas — nunca mais — e a forma entre as equipes é
  -- livre: o admin decide quantas duplas e quantos solos existem.
  for item in select * from jsonb_array_elements(p_equipes) loop
    select array_agg(value::uuid) into ids
      from jsonb_array_elements_text(coalesce(item->'jogadores', '[]'::jsonb));
    if ids is null or array_length(ids, 1) = 0 then
      raise exception 'há uma equipe sem ninguém';
    end if;
    if array_length(ids, 1) > 2 then
      raise exception 'uma equipe não pode ter mais de 2 jogadores';
    end if;
    tamanho_max := greatest(tamanho_max, array_length(ids, 1));
    foreach jid in array ids loop
      if not (jid = any(inscritos)) then
        raise exception 'há alguém na montagem que não está inscrito neste torneio';
      end if;
      if jid = any(usados) then
        raise exception 'a mesma pessoa aparece em duas equipes';
      end if;
      usados := usados || jid;
    end loop;
  end loop;

  if coalesce(array_length(usados, 1), 0) <> coalesce(array_length(inscritos, 1), 0) then
    raise exception 'todos os % inscritos precisam estar em alguma equipe; foram distribuídos %',
      coalesce(array_length(inscritos, 1), 0), coalesce(array_length(usados, 1), 0);
  end if;

  -- Segunda passagem: criar.
  i := 0;
  for item in select * from jsonb_array_elements(p_equipes) loop
    i := i + 1;
    clube := null;
    if item ? 'club_id' and jsonb_typeof(item->'club_id') = 'string' then
      select * into clube from clubs where id = (item->>'club_id')::uuid;
      if clube.id is null then raise exception 'time guardado inexistente'; end if;
    end if;

    nome_time := coalesce(nullif(trim(coalesce(item->>'nome', '')), ''),
                          clube.nome,
                          'Equipe ' || i);

    insert into teams (tournament_id, nome, descricao, logo_url, cor_primaria, club_id)
    values (p_tournament_id, nome_time, clube.descricao, clube.logo_url,
            clube.cor_primaria, clube.id)
    returning id into novo_time;

    select array_agg(value::uuid) into ids
      from jsonb_array_elements_text(item->'jogadores');
    foreach jid in array ids loop
      insert into team_players (team_id, player_id, tournament_id)
      values (novo_time, jid, p_tournament_id);
    end loop;
  end loop;

  update tournaments
     set max_equipes          = jsonb_array_length(p_equipes),
         jogadores_por_equipe = tamanho_max,
         updated_at           = now()
   where id = p_tournament_id;

  perform registrar_auditoria(
    p_acao          => 'MONTAR_EQUIPES_MANUALMENTE',
    p_entidade      => 'teams',
    p_entidade_id   => null,
    p_tournament_id => p_tournament_id,
    p_depois        => jsonb_build_object('participantes', coalesce(array_length(inscritos, 1), 0),
                                          'equipes', jsonb_array_length(p_equipes),
                                          'montagem', p_equipes),
    p_motivo        => 'Equipes montadas à mão pelo administrador, com tamanho livre por equipe');

  return query
    select tm.id, tm.nome, p.id, p.nome
      from teams tm
      join team_players tp on tp.team_id = tm.id
      join players p on p.id = tp.player_id
     where tm.tournament_id = p_tournament_id
     order by tm.nome, p.nome;
end $$;
