import type { HighlighterCore } from 'shiki/core'
import { getHighlighter } from './markdown'

export interface KernelCodeTag {
  name: string
  file: string
  address: string
  kind: string
  scope?: string
}

const C_KEYWORDS = new Set([
  '_Alignas', '_Alignof', '_Atomic', '_Bool', '_Complex', '_Generic', '_Imaginary', '_Noreturn', '_Static_assert', '_Thread_local',
  'alignas', 'alignof', 'and', 'and_eq', 'asm', 'auto', 'bitand', 'bitor', 'bool', 'break', 'case', 'catch', 'char', 'char8_t',
  'char16_t', 'char32_t', 'class', 'compl', 'concept', 'const', 'consteval', 'constexpr', 'constinit', 'const_cast', 'continue',
  'co_await', 'co_return', 'co_yield', 'decltype', 'default', 'delete', 'do', 'double', 'dynamic_cast', 'else', 'enum',
  'explicit', 'export', 'extern', 'false', 'float', 'for', 'friend', 'goto', 'if', 'import', 'inline', 'int', 'long', 'module',
  'mutable', 'namespace', 'new', 'noexcept', 'not', 'not_eq', 'nullptr', 'operator', 'or', 'or_eq', 'private', 'protected',
  'public', 'register', 'reinterpret_cast', 'requires', 'return', 'short', 'signed', 'sizeof', 'static', 'static_assert',
  'static_cast', 'struct', 'switch', 'template', 'this', 'thread_local', 'throw', 'true', 'try', 'typedef', 'typeid',
  'typename', 'union', 'unsigned', 'using', 'virtual', 'void', 'volatile', 'wchar_t', 'while', 'xor', 'xor_eq',
  '__asm', '__asm__', '__attribute', '__attribute__', '__const', '__const__', '__extension__', '__inline', '__inline__',
  '__label__', '__restrict', '__restrict__', '__signed', '__signed__', '__typeof', '__typeof__', '__volatile', '__volatile__',
  'typeof',
])

function languageForFile(file: string): string {
  const name = file.split('/').pop()?.toLowerCase() ?? ''
  if (name === 'makefile' || name.startsWith('kconfig')) return 'make'
  if (/\.(c|h)$/.test(name)) return 'c'
  if (/\.(cc|cpp|cxx|hpp)$/.test(name)) return 'c'
  if (/\.(s|asm)$/.test(name)) return 'asm'
  if (/\.rs$/.test(name)) return 'rust'
  return 'text'
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character)
}

function tokenStyle(token: { color?: string; bgColor?: string; fontStyle?: number }): string {
  const styles: string[] = []
  if (token.color) styles.push(`color:${token.color}`)
  if (token.bgColor) styles.push(`background-color:${token.bgColor}`)
  if (token.fontStyle && token.fontStyle & 1) styles.push('font-style:italic')
  if (token.fontStyle && token.fontStyle & 2) styles.push('font-weight:700')
  return styles.join(';')
}

function tagHref(tag: KernelCodeTag): string {
  const query = new URLSearchParams({ file: tag.file, name: tag.name, address: tag.address, q: tag.name, scope: 'kernel' })
  return `/kernel/linux-6.8/source?${query.toString()}`
}

interface CodeToken {
  content: string
  color?: string
  bgColor?: string
  fontStyle?: number
  explanation?: Array<{ content: string; scopes: Array<{ scopeName: string }> }>
}

function renderIdentifier(name: string, symbols: Record<string, KernelCodeTag>): string {
  const escapedName = escapeHtml(name)
  const tag = symbols[name]
  return tag
    ? `<a class="source-symbol-link" data-symbol="${escapedName}" href="${escapeHtml(tagHref(tag))}" title="跳转到 ${escapeHtml(tag.name)} 的定义">${escapedName}</a>`
    : escapedName
}

function renderCExplanation(token: CodeToken, style: string, symbols: Record<string, KernelCodeTag>): string {
  return (token.explanation ?? []).map((part) => {
    const blocked = part.scopes.some(({ scopeName }) => /^(comment|string|keyword|storage|punctuation)(\.|$)/.test(scopeName))
    let cursor = 0
    let content = ''
    for (const match of part.content.matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g)) {
      const index = match.index ?? 0
      const name = match[0]
      content += escapeHtml(part.content.slice(cursor, index))
      content += !blocked && !C_KEYWORDS.has(name) ? renderIdentifier(name, symbols) : escapeHtml(name)
      cursor = index + name.length
    }
    content += escapeHtml(part.content.slice(cursor))
    return `<span${style ? ` style="${style}"` : ''}>${content}</span>`
  }).join('')
}

function renderToken(token: CodeToken, language: string, symbols: Record<string, KernelCodeTag>): string {
  const style = tokenStyle(token)
  if (language === 'c' && token.explanation) return renderCExplanation(token, style, symbols)
  const content = escapeHtml(token.content)
  const span = `<span${style ? ` style="${style}"` : ''}>${content}</span>`
  const identifier = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(token.content)
  const keyword = language === 'c' && C_KEYWORDS.has(token.content)
  return identifier && !keyword ? `<span${style ? ` style="${style}"` : ''}>${renderIdentifier(token.content, symbols)}</span>` : span
}

function tokenizedC(source: string) {
  return getHighlighter().then((highlighter) => highlighter.codeToTokens(source, {
    lang: 'c',
    theme: 'github-light',
    includeExplanation: 'scopeName',
  }).tokens)
}

export async function collectCIdentifiers(source: string): Promise<string[]> {
  const names = new Set<string>()
  for (const line of await tokenizedC(source)) {
    for (const token of line as CodeToken[]) {
      for (const part of token.explanation ?? []) {
        const blocked = part.scopes.some(({ scopeName }) => /^(comment|string|keyword|storage|punctuation)(\.|$)/.test(scopeName))
        if (blocked) continue
        for (const match of part.content.matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g)) {
          if (!C_KEYWORDS.has(match[0])) names.add(match[0])
          if (names.size >= 1000) return [...names]
        }
      }
    }
  }
  return [...names]
}

export async function highlightCCodeWithKernelLinks(
  source: string,
  symbols: Record<string, KernelCodeTag>,
): Promise<string> {
  const lines = await tokenizedC(source)
  return lines.map((tokens) => tokens.map((token) => renderToken(token as CodeToken, 'c', symbols)).join('')).join('\n')
}

export async function highlightKernelLines(
  lines: string[],
  file: string,
  symbols: Record<string, KernelCodeTag>,
): Promise<string[]> {
  const highlighter: HighlighterCore = await getHighlighter()
  const language = languageForFile(file)
  if (language === 'text' || !highlighter.getLoadedLanguages().includes(language)) return lines.map(escapeHtml)
  try {
    const tokenLines = highlighter.codeToTokens(lines.join('\n'), { lang: language, theme: 'github-light', includeExplanation: language === 'c' ? 'scopeName' : false }).tokens
    return tokenLines.map((tokens) => tokens.map((token) => renderToken(token, language, symbols)).join(''))
  } catch {
    return lines.map(escapeHtml)
  }
}
