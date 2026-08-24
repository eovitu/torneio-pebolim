-- =============================================================================
-- Transição automática: fase de grupos encerrada → Copa (eliminação dupla)
--
-- Decisão do proprietário: ao encerrar uma fase de GRUPOS cuja próxima fase
-- (pela ordem) é uma Copa (DOUBLE_ELIMINATION) ainda sem chaveamento gerado,
-- os 4 melhores colocados da classificação avançam automaticamente para ela.
-- Quem não ficou entre os 4 primeiros não entra em nenhuma chave.
--
-- Critérios de classificação são os oficiais — pontos, depois saldo — os
-- mesmos de `computeStandings` em packages/domain/src/standings.ts. NÃO
-- inventamos um terceiro critério: se houver empate exatamente na fronteira
-- do 4º lugar (a ponto de não dar para saber quem são os 4), a promoção
-- automática é pulada e o administrador gera a chave manualmente pela tela
-- "Gerar a chave", exatamente como já funciona hoje. Fechar a fase de grupos
-- nunca fica bloqueado por causa disso.
-- =============================================================================

create or replace function encerrar_fase(p_phase_id uuid)
returns phases
language plpgsql security definer set search_path to 'public' as $$
declare
  f          phases%rowtype;
  pendentes  int;
  proxima    phases%rowtype;
  top4       uuid[];
  qtd_top4   int;
begin
  if not is_admin(auth.uid()) then
    raise exception 'somente administrador pode encerrar uma fase';
  end if;

  select * into f from phases where id = p_phase_id for update;
  if f.id is null then raise exception 'fase inexistente'; end if;
  if f.encerrada_em is not null then raise exception 'esta fase já foi encerrada'; end if;

  select count(*) into pendentes from matches
   where phase_id = p_phase_id and status <> 'FINISHED';
  if pendentes > 0 then
    raise exception 'ainda há % partida(s) não encerrada(s) nesta fase', pendentes;
  end if;
  if not exists (select 1 from matches where phase_id = p_phase_id) then
    raise exception 'esta fase não tem partidas';
  end if;

  update phases set encerrada_em = now() where id = p_phase_id returning * into f;

  perform registrar_auditoria('ENCERRAR_FASE', 'phases', f.id, f.tournament_id, null,
                              jsonb_build_object('nome', f.nome, 'encerrada_em', f.encerrada_em),
                              null);

  if f.kind = 'GROUP' then
    select * into proxima from phases
     where tournament_id = f.tournament_id and ordem > f.ordem
     order by ordem asc limit 1;

    if proxima.id is not null and proxima.kind = 'DOUBLE_ELIMINATION' and proxima.chaveamento is null then
      with resultados as (
        select m.id, m.team_a_id, m.team_b_id, s.gf_a, s.gf_b
          from matches m, lateral placar_partida(m.id) s
         where m.phase_id = p_phase_id and m.status = 'FINISHED'
      ),
      pontos as (
        select team_a_id as team_id,
               case when gf_a > gf_b then 3 when gf_a = gf_b then 1 else 0 end as pts,
               gf_a - gf_b as saldo
          from resultados
        union all
        select team_b_id as team_id,
               case when gf_b > gf_a then 3 when gf_a = gf_b then 1 else 0 end as pts,
               gf_b - gf_a as saldo
          from resultados
      ),
      agregado as (
        select tm.id as team_id,
               coalesce(sum(p.pts), 0) as pts,
               coalesce(sum(p.saldo), 0) as saldo
          from teams tm
          left join pontos p on p.team_id = tm.id
         where tm.tournament_id = f.tournament_id
         group by tm.id
      ),
      classificacao as (
        select team_id, pts, saldo,
               rank() over (order by pts desc, saldo desc) as pos
          from agregado
      )
      select array_agg(team_id order by pts desc, saldo desc, team_id) into top4
        from classificacao where pos <= 4;

      qtd_top4 := coalesce(array_length(top4, 1), 0);

      -- Só promove automaticamente quando os 4 primeiros estão inequivocamente
      -- definidos (nem empate que infla o grupo além de 4, nem menos de 4
      -- equipes no total). Caso contrário o administrador resolve na mão.
      if qtd_top4 = 4 then
        perform gerar_eliminacao_dupla(proxima.id, top4);
      end if;
    end if;
  end if;

  return f;
end $$;
