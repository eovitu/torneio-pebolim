import { describe, expect, it } from 'vitest'
import {
  displayMs,
  elapsedMs,
  finish,
  formatClock,
  goldenGoalElapsedMs,
  initialClock,
  isRegulationOver,
  pause,
  remainingMs,
  resume,
  start,
} from '../src/clock.js'
import { MATCH_DURATION_MS } from '../src/types.js'

const T0 = 1_700_000_000_000
const s = (n: number) => n * 1000

describe('duração oficial', () => {
  it('é de 180 segundos', () => {
    expect(MATCH_DURATION_MS).toBe(180_000)
  })

  it('começa exibindo 03:00', () => {
    const c = start(initialClock(), T0)
    expect(formatClock(remainingMs(c, T0))).toBe('03:00')
  })
})

describe('cronômetro baseado em timestamp', () => {
  it('calcula o tempo pelo relógio absoluto, não por contagem de renderizações', () => {
    const c = start(initialClock(), T0)
    expect(remainingMs(c, T0 + s(30))).toBe(s(150))
    // Um "salto" no tempo (aba em segundo plano) não distorce nada:
    expect(remainingMs(c, T0 + s(120))).toBe(s(60))
  })

  it('nunca fica negativo depois do fim do tempo regulamentar', () => {
    const c = start(initialClock(), T0)
    expect(remainingMs(c, T0 + s(500))).toBe(0)
    expect(formatClock(remainingMs(c, T0 + s(500)))).toBe('00:00')
  })

  it('marca o fim do tempo exatamente em 180 s', () => {
    const c = start(initialClock(), T0)
    expect(isRegulationOver(c, T0 + s(179))).toBe(false)
    expect(isRegulationOver(c, T0 + s(180))).toBe(true)
  })
})

describe('pausa', () => {
  it('congela o tempo restante enquanto pausada', () => {
    let c = start(initialClock(), T0)
    c = pause(c, T0 + s(60))
    expect(remainingMs(c, T0 + s(60))).toBe(s(120))
    // 5 minutos parados no mundo real, nada muda no relógio da partida:
    expect(remainingMs(c, T0 + s(360))).toBe(s(120))
  })

  it('continua do ponto correto ao retomar, sem reiniciar', () => {
    let c = start(initialClock(), T0)
    c = pause(c, T0 + s(60))
    c = resume(c, T0 + s(360))
    expect(remainingMs(c, T0 + s(360))).toBe(s(120))
    expect(remainingMs(c, T0 + s(370))).toBe(s(110))
  })

  it('acumula corretamente várias pausas', () => {
    let c = start(initialClock(), T0)
    c = pause(c, T0 + s(30))
    c = resume(c, T0 + s(90))
    c = pause(c, T0 + s(120))
    c = resume(c, T0 + s(200))
    // Jogou 30 s, parou 60 s, jogou 30 s, parou 80 s → 60 s jogados
    expect(elapsedMs(c, T0 + s(200))).toBe(s(60))
    expect(remainingMs(c, T0 + s(200))).toBe(s(120))
  })

  it('ignora pausa em partida não iniciada e retomada sem pausa', () => {
    expect(pause(initialClock(), T0).pausedAt).toBeNull()
    const running = start(initialClock(), T0)
    expect(resume(running, T0 + s(10))).toEqual(running)
  })
})

describe('gol de ouro', () => {
  it('conta progressivamente a partir de 00:00 depois dos 180 s', () => {
    const c = start(initialClock(), T0)
    expect(goldenGoalElapsedMs(c, T0 + s(180))).toBe(0)
    expect(formatClock(goldenGoalElapsedMs(c, T0 + s(181)))).toBe('00:01')
    expect(formatClock(goldenGoalElapsedMs(c, T0 + s(243)))).toBe('01:03')
  })

  it('exibe contagem progressiva em GOLDEN_GOAL e regressiva nos demais estados', () => {
    const c = start(initialClock(), T0)
    expect(displayMs(c, 'GOLDEN_GOAL', T0 + s(200))).toBe(s(20))
    expect(displayMs(c, 'LIVE', T0 + s(60))).toBe(s(120))
  })

  it('não tem limite de tempo', () => {
    const c = start(initialClock(), T0)
    expect(goldenGoalElapsedMs(c, T0 + s(3600))).toBe(s(3420))
  })
})

describe('encerramento', () => {
  it('congela o cronômetro ao finalizar', () => {
    let c = start(initialClock(), T0)
    c = finish(c, T0 + s(180))
    expect(elapsedMs(c, T0 + s(999))).toBe(s(180))
  })

  it('encerra corretamente uma partida que estava pausada', () => {
    let c = start(initialClock(), T0)
    c = pause(c, T0 + s(60))
    c = finish(c, T0 + s(300))
    expect(elapsedMs(c, T0 + s(999))).toBe(s(60))
  })
})

describe('formatClock', () => {
  it('formata como MM:SS', () => {
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(s(9))).toBe('00:09')
    expect(formatClock(s(163))).toBe('02:43')
    expect(formatClock(s(180))).toBe('03:00')
    expect(formatClock(-5000)).toBe('00:00')
  })
})
