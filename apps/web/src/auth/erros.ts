/**
 * Tradução das falhas de autenticação para mensagens em pt-BR.
 *
 * O Supabase responde em inglês e com textos voltados a quem desenvolve. Aqui
 * eles viram frases que fazem sentido para quem está na tela — sem revelar
 * mais do que o necessário: numa credencial errada, não dizemos se foi o
 * e-mail ou a senha que não bateu.
 */

export class ErroAutenticacao extends Error {
  constructor(mensagem: string) {
    super(mensagem)
    this.name = 'ErroAutenticacao'
  }
}

export function traduzirErroAuth(erro: unknown): string {
  const bruto = erro instanceof Error ? erro.message : String(erro)
  const texto = bruto.toLowerCase()

  if (texto.includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos.'
  }
  if (texto.includes('email not confirmed')) {
    return 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.'
  }
  if (texto.includes('user already registered') || texto.includes('already been registered')) {
    return 'Este e-mail já está cadastrado. Tente entrar.'
  }
  if (texto.includes('password should be at least')) {
    return 'A senha é curta demais. Use pelo menos 6 caracteres.'
  }
  if (texto.includes('unable to validate email') || texto.includes('invalid email')) {
    return 'E-mail inválido.'
  }
  if (texto.includes('rate limit') || texto.includes('too many requests')) {
    return 'Muitas tentativas seguidas. Espere um instante e tente de novo.'
  }
  if (texto.includes('failed to fetch') || texto.includes('networkerror')) {
    return 'Não foi possível falar com o servidor. Verifique sua conexão.'
  }
  return 'Não foi possível concluir. Tente novamente.'
}
