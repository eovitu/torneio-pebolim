import { readFile, writeFile } from 'node:fs/promises'

const htmlPath = new URL('../dist/index.html', import.meta.url)
const fallbackPath = new URL('../dist/index-no-canonical.html', import.meta.url)
const html = await readFile(htmlPath, 'utf8')
const canonicalTag =
  /<link\b(?=[^>]*\brel="canonical")(?=[^>]*\bhref="https:\/\/torneio-pebolim\.vercel\.app\/"\s*\/?>)[^>]*>/gi
const ogUrlTag =
  /<meta\b(?=[^>]*\bproperty="og:url")(?=[^>]*\bcontent="https:\/\/torneio-pebolim\.vercel\.app\/"\s*\/?>)[^>]*>/gi
const landingContent = /\s*<!-- INITIAL_HOME_START -->[\s\S]*?<!-- INITIAL_HOME_END -->/g
const canonicalMatches = [...html.matchAll(canonicalTag)]
const ogUrlMatches = [...html.matchAll(ogUrlTag)]
const landingMatches = [...html.matchAll(landingContent)]

if (canonicalMatches.length !== 1 || ogUrlMatches.length !== 1 || landingMatches.length !== 1) {
  throw new Error(
    `Esperava remover uma canonical, um og:url e o conteúdo inicial da landing; encontrei ${canonicalMatches.length}, ${ogUrlMatches.length} e ${landingMatches.length}.`,
  )
}

const fallbackHtml = html
  .replace(canonicalTag, '')
  .replace(ogUrlTag, '')
  .replace(landingContent, '')
await writeFile(fallbackPath, fallbackHtml, 'utf8')
