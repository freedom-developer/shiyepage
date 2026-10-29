import MarkdownIt from 'markdown-it'
import katexPlugin from 'markdown-it-katex'
import type { HighlighterCore } from 'shiki/core'
import { apiRequest, authState } from './api'
import type { KernelCodeTag } from './kernel-code'

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: false,
})

markdown.use(katexPlugin, { throwOnError: false, errorColor: '#b42318' })

let highlighterPromise: Promise<HighlighterCore> | undefined

export function getHighlighter(): Promise<HighlighterCore> {
  highlighterPromise ??= (async () => {
    const [
      { createHighlighterCore },
      { createJavaScriptRegexEngine },
      bash,
      asm,
      c,
      css,
      html,
      javascript,
      json,
      python,
      rust,
      sql,
      typescript,
      make,
      githubLight,
    ] = await Promise.all([
      import('shiki/core'),
      import('shiki/engine/javascript'),
      import('@shikijs/langs/bash'),
      import('@shikijs/langs/asm'),
      import('@shikijs/langs/c'),
      import('@shikijs/langs/css'),
      import('@shikijs/langs/html'),
      import('@shikijs/langs/javascript'),
      import('@shikijs/langs/json'),
      import('@shikijs/langs/python'),
      import('@shikijs/langs/rust'),
      import('@shikijs/langs/sql'),
      import('@shikijs/langs/typescript'),
      import('@shikijs/langs/make'),
      import('@shikijs/themes/github-light'),
    ])

    return createHighlighterCore({
      engine: createJavaScriptRegexEngine(),
      themes: [githubLight.default],
      langs: [
        bash.default,
        asm.default,
        c.default,
        css.default,
        html.default,
        javascript.default,
        json.default,
        python.default,
        rust.default,
        sql.default,
        typescript.default,
        make.default,
      ],
    })
  })()
  return highlighterPromise
}

export async function renderMarkdown(source: string): Promise<string> {
  const container = document.createElement('div')
  container.innerHTML = markdown.render(source)

  const highlighter = await getHighlighter()
  const codeBlocks = Array.from(container.querySelectorAll('pre > code'))
  const cBlocks = codeBlocks.flatMap((code) => {
    const languageClass = Array.from(code.classList).find((className) => className.startsWith('language-'))
    const requestedLanguage = languageClass?.replace('language-', '').toLowerCase()
    return requestedLanguage && ['c', 'cpp', 'c++', 'cc', 'cxx', 'h', 'hpp'].includes(requestedLanguage)
      ? [{ code, source: code.textContent ?? '' }]
      : []
  })
  let symbols: Record<string, KernelCodeTag> = {}
  if (authState.user && cBlocks.length) {
    try {
      const { collectCIdentifiers } = await import('./kernel-code')
      const references = new Map<string, { name: string; kind: 'function' | 'struct' | 'union' | 'enum' }>()
      for (const block of cBlocks) {
        const identifiers = new Set(await collectCIdentifiers(block.source))
        for (const match of block.source.matchAll(/\b(struct|union|enum)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g)) {
          const name = match[2] ?? ''
          if (identifiers.has(name)) references.set(`${match[1]}:${name}`, {
            name,
            kind: match[1] as 'struct' | 'union' | 'enum',
          })
        }
        for (const match of block.source.matchAll(/\b([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g)) {
          const name = match[1] ?? ''
          if (identifiers.has(name)) references.set(`function:${name}`, { name, kind: 'function' })
        }
        if (references.size >= 1000) break
      }
      if (references.size) {
        const result = await apiRequest<{ symbols: Record<string, KernelCodeTag> }>('/api/kernel/linux-6.8/tags/lookup', {
          method: 'POST',
          body: JSON.stringify({ references: [...references.values()].slice(0, 1000) }),
        })
        symbols = result.symbols
      }
    } catch {
      // Notes remain readable if the local kernel tag index is unavailable.
    }
  }

  for (const code of codeBlocks) {
    const pre = code.parentElement
    if (!pre) continue

    const languageClass = Array.from(code.classList).find((className) =>
      className.startsWith('language-'),
    )
    const requestedLanguage = languageClass?.replace('language-', '') ?? 'text'
    const normalizedLanguage = requestedLanguage.toLowerCase()
    const language = highlighter.getLoadedLanguages().includes(requestedLanguage)
      ? requestedLanguage
      : 'text'

    try {
      if (authState.user && symbols && ['c', 'cpp', 'c++', 'cc', 'cxx', 'h', 'hpp'].includes(normalizedLanguage)) {
        const { highlightCCodeWithKernelLinks } = await import('./kernel-code')
        const highlighted = await highlightCCodeWithKernelLinks(code.textContent ?? '', symbols)
        pre.outerHTML = `<pre class="shiki github-light" style="background-color:#fff;color:#24292f"><code>${highlighted}</code></pre>`
        continue
      }
      const highlighted = highlighter.codeToHtml(code.textContent ?? '', {
        lang: language,
        theme: 'github-light',
      })
      pre.outerHTML = highlighted
    } catch {
      // Keep Markdown's escaped code block if a language is unsupported.
    }
  }

  for (const link of Array.from(container.querySelectorAll('a[href^="http"]'))) {
    link.setAttribute('target', '_blank')
    link.setAttribute('rel', 'noreferrer noopener')
  }

  return container.innerHTML
}
