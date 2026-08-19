import { tokens } from './tokens'
import type { Tokens } from './tokens'

export const theme = tokens

declare module 'styled-components' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface DefaultTheme extends Tokens {}
}
