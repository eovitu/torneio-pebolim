import { readFile, writeFile } from 'node:fs/promises'

const htmlPath = new URL('../dist/index.html', import.meta.url)
const fallbackPath = new URL('../dist/index-no-canonical.html', import.meta.url)
const html = await readFile(htmlPath, 'utf8')
const canonicalTag =
  /<link\b(?=[^>]*\brel="canonical")(?=[^>]*\bhref="https:\/\/torneio-pebolim\.vercel\.app\/"\s*\/?>)[^>]*>/gi
const ogUrlTag =
  /<meta\b(?=[^>]*\bproperty="og:url")(?=[^>]*\bcontent="https:\/\/torneio-pebolim\.vercel\.app\/"\s*\/?>)[^>]*>/gi
const canonicalMatches = [...html.matchAll(canonicalTag)]
const ogUrlMatches = [...html.matchAll(ogUrlTag)]

if (canonicalMatches.length !== 1 || ogUrlMatches.length !== 1) {
  throw new Error(
    `Esperava remover uma canonical e um og:url da cópia SPA; encontrei ${canonicalMatches.length} e ${ogUrlMatches.length}.`,
  )
}

const fallbackHtml = html.replace(canonicalTag, '').replace(ogUrlTag, '')
await writeFile(fallbackPath, fallbackHtml, 'utf8')
