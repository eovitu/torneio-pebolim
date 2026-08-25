/**
 * Truncamento de nome de jogador para listas e telas compactas.
 *
 * CSS sozinho (`text-overflow: ellipsis`) depende do container encolher de
 * verdade, o que quebra fácil em layouts flex/grid aninhados — daí o nome
 * ainda quebrando linha no celular mesmo com a regra de CSS presente. Cortar
 * o texto em JS garante o limite não importa o container.
 *
 * Usado em listas de torneio e na tela de partida, onde o espaço é apertado.
 * A página de perfil do jogador (`Jogador.tsx`, `Perfil.tsx`) mostra o nome
 * completo — lá tem espaço de sobra.
 */
export function truncarNome(nome: string, maximo = 15): string {
  const aparado = nome.trim()
  if (aparado.length <= maximo) return aparado
  return `${aparado.slice(0, maximo).trimEnd()}…`
}
