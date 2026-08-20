import '@testing-library/jest-dom/vitest'

/**
 * O jsdom não implementa `ResizeObserver`, que o modal de regras usa para
 * remedir a rolagem quando a altura muda. Sem este substituto, montar o modal
 * num teste estoura antes de qualquer asserção.
 *
 * É um substituto inerte de propósito: o que os testes verificam é o efeito de
 * ter observado, não o agendamento do navegador.
 */
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}
