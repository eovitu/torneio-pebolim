/**
 * Regras oficiais do campeonato, em forma estruturada e versionada.
 *
 * Este conteúdo é a transcrição das regras definidas pelo proprietário do
 * projeto. Nenhuma regra competitiva é adicionada aqui. A página de regras e o
 * modal de aceite no cadastro renderizam a partir desta fonte, de modo que
 * texto exibido e comportamento do sistema nunca divergem.
 *
 * Ao alterar qualquer regra, incremente `RULES_VERSION` — usuários que
 * aceitaram uma versão anterior podem precisar aceitar a nova.
 */

/** Versão vigente das regras. Gravada em `accepted_rules_version` no aceite. */
export const RULES_VERSION = '1.0.0'

export interface RuleSection {
  id: string
  title: string
  items: string[]
}

export const RULES: readonly RuleSection[] = [
  {
    id: 'duracao',
    title: 'Duração da partida',
    items: [
      'A partida dura 3 minutos (180 segundos).',
      'A partida termina quando o cronômetro chega a 00:00.',
      'Não existe limite máximo nem mínimo de gols: o tempo é o único limite.',
      'A partida pode ser pausada pelo juiz. Ao retomar, o cronômetro continua do ponto em que parou.',
    ],
  },
  {
    id: 'gol',
    title: 'O gol',
    items: [
      'O gol é válido quando a bola desce dentro do gol — mesmo que depois suba novamente.',
      'Se a bola bate na trave e não entra, não é gol.',
      'O sistema não detecta o lance automaticamente: quem declara o tipo de gol é o juiz.',
      'Gol normal vale 1.',
    ],
  },
  {
    id: 'gol-de-goleiro',
    title: 'Gol de goleiro',
    items: [
      'O gol de goleiro vale 2 — sempre, em placar, saldo, estatísticas e artilharia.',
      'É gol de goleiro quando a bola sai diretamente do goleiro e entra.',
      'Também é gol de goleiro quando a bola sai do goleiro, bate na parede e entra.',
      'Também é gol de goleiro quando a bola sai do goleiro, bate em jogador adversário e entra.',
      'Se a bola bater primeiro em jogador do próprio time, o gol é considerado normal.',
    ],
  },
  {
    id: 'gol-contra',
    title: 'Gol contra',
    items: [
      'O gol contra vale 1 e nunca vale 2, mesmo quando cometido pelo goleiro.',
      'O time adversário recebe 1 no placar.',
      'O time de quem cometeu não perde pontos do próprio placar.',
      'O gol contra não conta como gol oficial do jogador.',
      'O gol contra desconta 1 da artilharia líquida do jogador e aparece separadamente nas estatísticas.',
    ],
  },
  {
    id: 'inicio',
    title: 'Início e reinício',
    items: [
      'A primeira bola começa no meio.',
      'Depois de um gol, o time que sofreu o gol inicia a próxima bola.',
    ],
  },
  {
    id: 'grupos',
    title: 'Fase de grupos e pontuação',
    items: [
      'Vitória vale 3 pontos.',
      'Empate vale 1 ponto para cada equipe.',
      'Derrota vale 0 ponto.',
      'Na fase de grupos o empate é um resultado válido: não há gol de ouro.',
    ],
  },
  {
    id: 'desempate',
    title: 'Desempate na classificação',
    items: [
      'O primeiro critério é o número de pontos.',
      'O segundo critério é o saldo de gols, calculado sobre o valor do placar.',
      'Equipes que permanecem empatadas nos dois critérios são exibidas na mesma posição.',
    ],
  },
  {
    id: 'mata-mata',
    title: 'Mata-mata e gol de ouro',
    items: [
      'No mata-mata a partida não pode terminar empatada.',
      'Se o tempo regulamentar terminar empatado, a partida entra em gol de ouro.',
      'No gol de ouro o cronômetro passa a contar progressivamente a partir de 00:00, sem limite de tempo.',
      'O próximo gol válido encerra a partida e define o vencedor.',
      'Gol normal, gol de goleiro e gol contra encerram a partida no gol de ouro.',
    ],
  },
  {
    id: 'artilharia',
    title: 'Artilharia',
    items: [
      'A artilharia é individual e calculada pelo valor dos gols, não pela contagem de eventos.',
      'Gol normal soma 1 e gol de goleiro soma 2.',
      'Cada gol contra desconta 1 da artilharia líquida.',
    ],
  },
  {
    id: 'registro',
    title: 'Registro dos lances',
    items: [
      'Podem registrar gols os jogadores da partida, o juiz responsável e os administradores.',
      'Espectadores e visitantes não podem registrar nada.',
      'Durante a partida, o juiz pode remover ou corrigir um gol.',
      'Depois que a partida termina, somente um administrador pode corrigir os eventos.',
      'Toda remoção fica registrada no histórico da partida.',
    ],
  },
]
