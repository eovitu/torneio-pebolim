/**
 * Peças de formulário.
 *
 * O botão vive em `ui/Botao` — aqui só é reexportado para que as telas antigas
 * continuem importando do mesmo lugar. Existe uma única implementação de
 * botão no produto (§19 do redesign).
 *
 * Campos têm 48px de altura e fonte de 16px: alvo confortável para o dedo e
 * sem o zoom automático do iOS ao focar (§43).
 */

import styled from 'styled-components'
import { Botao } from '../ui/Botao'
import { Erro as CaixaErro, Aviso as CaixaAviso } from '../ui/Estados'

export { Botao }
export type { VarianteBotao, TamanhoBotao } from '../ui/Botao'

/** Compatibilidade: era o botão "de contorno" das telas antigas. */
export const BotaoSecundario = styled(Botao).attrs({ $variante: 'contorno' as const })``

export const Formulario = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[4]};
`

export const Campo = styled.label`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[2]};
  font-size: ${({ theme }) => theme.fontSize.small};
  font-weight: 600;
  color: ${({ theme }) => theme.color.textSoft};
`

const baseControle = `
  font: inherit;
  font-size: 16px;
  width: 100%;
  min-height: 48px;
`

export const Entrada = styled.input`
  ${baseControle}
  color: ${({ theme }) => theme.color.text};
  background: ${({ theme }) => theme.color.surface};
  border: 1px solid ${({ theme }) => theme.color.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  padding: 0 ${({ theme }) => theme.space[4]};
  transition:
    border-color ${({ theme }) => theme.motion.rapido} ease,
    box-shadow ${({ theme }) => theme.motion.rapido} ease;

  &::placeholder {
    color: ${({ theme }) => theme.color.muted};
  }

  &:hover:not(:disabled) {
    border-color: ${({ theme }) => theme.color.borderStrong};
  }

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.color.accent};
    box-shadow: ${({ theme }) => theme.shadow.foco};
  }

  &:disabled {
    color: ${({ theme }) => theme.color.muted};
    background: ${({ theme }) => theme.color.surfaceSunken};
    cursor: not-allowed;
  }
`

export const AreaTexto = styled.textarea`
  ${baseControle}
  min-height: 104px;
  resize: vertical;
  padding: ${({ theme }) => theme.space[3]} ${({ theme }) => theme.space[4]};
  color: ${({ theme }) => theme.color.text};
  background: ${({ theme }) => theme.color.surface};
  border: 1px solid ${({ theme }) => theme.color.border};
  border-radius: ${({ theme }) => theme.radius.sm};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.color.accent};
    box-shadow: ${({ theme }) => theme.shadow.foco};
  }
`

/**
 * `<select>` estilizado. A seta é desenhada em CSS: um SVG embutido carregaria
 * um asset só para isso, e o nativo varia demais entre navegadores.
 */
export const Selecao = styled.select`
  ${baseControle}
  appearance: none;
  color: ${({ theme }) => theme.color.text};
  background-color: ${({ theme }) => theme.color.surface};
  background-image: linear-gradient(45deg, transparent 50%, currentColor 50%),
    linear-gradient(135deg, currentColor 50%, transparent 50%);
  background-position:
    calc(100% - 19px) calc(50% + 1px),
    calc(100% - 13px) calc(50% + 1px);
  background-size: 6px 6px, 6px 6px;
  background-repeat: no-repeat;
  border: 1px solid ${({ theme }) => theme.color.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  padding: 0 ${({ theme }) => theme.space[8]} 0 ${({ theme }) => theme.space[4]};
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.color.accent};
    box-shadow: ${({ theme }) => theme.shadow.foco};
  }

  &:disabled {
    color: ${({ theme }) => theme.color.muted};
    background-color: ${({ theme }) => theme.color.surfaceSunken};
    cursor: not-allowed;
  }
`

/** Caixa de marcação com alvo grande — o rótulo inteiro é clicável. */
export const CampoMarcacao = styled.label`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[3]};
  min-height: 44px;
  padding: ${({ theme }) => theme.space[2]} ${({ theme }) => theme.space[3]};
  border: 1px solid ${({ theme }) => theme.color.borderSoft};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.color.surface};
  font-size: ${({ theme }) => theme.fontSize.small};
  cursor: pointer;
  transition: border-color ${({ theme }) => theme.motion.rapido} ease;

  &:hover {
    border-color: ${({ theme }) => theme.color.marcaClara};
  }

  &:has(input:checked) {
    border-color: ${({ theme }) => theme.color.accent};
    background: ${({ theme }) => theme.color.bola[50]};
  }

  input {
    width: 20px;
    height: 20px;
    margin: 0;
    flex-shrink: 0;
    accent-color: ${({ theme }) => theme.color.accent};
  }
`

/** Erro do formulário inteiro. */
export const Alerta = CaixaErro
/** Aviso neutro do formulário. */
export const Aviso = CaixaAviso

/** Erro de um campo específico. */
export const ErroCampo = styled.span`
  display: block;
  font-size: ${({ theme }) => theme.fontSize.caption};
  font-weight: 500;
  color: ${({ theme }) => theme.color.perigo};
`

export const LinhaAlternativa = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSize.small};
  color: ${({ theme }) => theme.color.muted};

  a {
    color: ${({ theme }) => theme.color.accent};
    font-weight: 700;
  }
`
