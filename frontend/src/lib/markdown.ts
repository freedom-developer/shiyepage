import MarkdownIt from 'markdown-it'
import type { HighlighterCore } from 'shiki/core'
import { apiRequest, authState } from './api'
import type { KernelCodeTag } from './kernel-code'
import { publicKernelRequest } from '../data/public-profile'

let markdownPromise: Promise<MarkdownIt> | undefined
let jsxGraphPromise: Promise<typeof import('jsxgraph').JSXGraph> | undefined
let plotSequence = 0

function createMarkdownRenderer(): MarkdownIt {
  return new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
    breaks: false,
  })
}

function getMarkdownRenderer(): Promise<MarkdownIt> {
  markdownPromise ??= import('markdown-it-mathjax3').then(({ default: mathjaxPlugin }) => {
    const renderer = createMarkdownRenderer()
    renderer.use(mathjaxPlugin)
    return renderer
  }).catch(() => {
    markdownPromise = undefined
    // A failed formula bundle must not hide the note or poison future renders.
    return createMarkdownRenderer()
  })
  return markdownPromise
}

interface PlotPoint {
  x: number
  y: number
  open: boolean
}

interface PlotDefinition {
  dimension: 2 | 3
  functions: string[]
  xDomain: [number, number]
  yDomain: [number, number]
  zDomain: [number, number]
  title: string
  xLabel: string
  yLabel: string
  points: PlotPoint[]
}

function parsePlotDefinition(source: string): PlotDefinition {
  const definition: PlotDefinition = {
    dimension: 2,
    functions: [],
    xDomain: [-10, 10],
    yDomain: [-10, 10],
    zDomain: [-10, 10],
    title: '',
    xLabel: 'x',
    yLabel: 'y',
    points: [],
  }

  for (const [index, rawLine] of source.split(/\r?\n/).entries()) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const separator = line.indexOf(':')
    if (separator < 1) throw new Error(`第 ${index + 1} 行缺少冒号`)
    const key = line.slice(0, separator).trim().toLowerCase()
    const value = line.slice(separator + 1).trim()

    if (key === 'dimension') {
      if (value !== '2' && value !== '3') throw new Error(`第 ${index + 1} 行的维度只支持 2 或 3`)
      definition.dimension = Number(value) as 2 | 3
      continue
    }

    if (key === 'fn' || key === 'z') {
      if (!value || value.length > 240 || !/^[A-Za-z0-9_\s.+\-*/^(),%]+$/.test(value)) {
        throw new Error(`第 ${index + 1} 行的函数表达式无效`)
      }
      if (key === 'z' && definition.dimension !== 3) throw new Error('z 曲面需要设置 dimension: 3')
      if (key === 'fn' && definition.dimension === 3) throw new Error('三维图请使用 z: 设置曲面表达式')
      definition.functions.push(value)
      if (definition.functions.length > 8) throw new Error('每张图最多绘制 8 个函数')
      continue
    }

    if (key === 'x' || key === 'y' || key === 'zrange') {
      const bounds = value.split(',').map((item) => Number(item.trim()))
      if (bounds.length !== 2 || !bounds.every(Number.isFinite) || bounds[0] >= bounds[1]) {
        throw new Error(`第 ${index + 1} 行的坐标范围无效`)
      }
      if (Math.abs(bounds[0]) > 1_000_000 || Math.abs(bounds[1]) > 1_000_000) {
        throw new Error(`第 ${index + 1} 行的坐标范围过大`)
      }
      if (key === 'x') definition.xDomain = bounds as [number, number]
      else if (key === 'y') definition.yDomain = bounds as [number, number]
      else definition.zDomain = bounds as [number, number]
      continue
    }

    if (key === 'point') {
      const [x, y, style = 'filled'] = value.split(',').map((item) => item.trim())
      const coordinates = [Number(x), Number(y)]
      if (!coordinates.every(Number.isFinite) || !['open', 'filled'].includes(style ?? '')) {
        throw new Error(`第 ${index + 1} 行的点无效`)
      }
      definition.points.push({ x: coordinates[0]!, y: coordinates[1]!, open: style === 'open' })
      if (definition.points.length > 20) throw new Error('每张图最多标记 20 个点')
      continue
    }

    if (key === 'title' || key === 'xlabel' || key === 'ylabel') {
      if (value.length > 120) throw new Error(`第 ${index + 1} 行文本过长`)
      if (key === 'title') definition.title = value
      else if (key === 'xlabel') definition.xLabel = value
      else definition.yLabel = value
      continue
    }

    throw new Error(`第 ${index + 1} 行不支持设置项“${key}”`)
  }

  if (!definition.functions.length) throw new Error('至少需要一个 fn 函数')
  return definition
}

function showDiagramError(pre: Element, message: string): void {
  const error = document.createElement('p')
  error.className = 'markdown-diagram-error'
  error.setAttribute('role', 'status')
  error.textContent = message
  pre.after(error)
}

async function renderPlots(container: HTMLElement): Promise<void> {
  const blocks = Array.from(container.querySelectorAll('pre > code.language-plot'))
  if (!blocks.length) return

  let JSXGraph: typeof import('jsxgraph').JSXGraph
  try {
    jsxGraphPromise ??= import('jsxgraph').then(({ JSXGraph }) => JSXGraph)
    JSXGraph = await jsxGraphPromise
  } catch {
    jsxGraphPromise = undefined
    for (const code of blocks) {
      const pre = code.parentElement
      if (pre) showDiagramError(pre, '绘图引擎加载失败，请刷新页面后重试。')
    }
    return
  }

  for (const code of blocks) {
    const pre = code.parentElement
    if (!pre) continue
    const target = document.createElement('div')
    let board: ReturnType<typeof JSXGraph.initBoard> | undefined
    try {
      const definition = parsePlotDefinition(code.textContent ?? '')
      target.id = `markdown-plot-${++plotSequence}`
      target.className = 'jxgbox'
      target.style.width = '760px'
      target.style.height = '440px'
      target.style.position = 'absolute'
      target.style.left = '-10000px'
      document.body.append(target)
      board = JSXGraph.initBoard(target.id, {
        renderer: 'svg',
        boundingbox: [definition.xDomain[0], definition.yDomain[1], definition.xDomain[1], definition.yDomain[0]],
        axis: true,
        grid: true,
        showCopyright: false,
        showNavigation: false,
        showInfobox: false,
        pan: { enabled: false },
      })
      if (definition.dimension === 2) {
        if (definition.title) board.create('text', [definition.xDomain[0], definition.yDomain[1], definition.title], { fixed: true, fontSize: 16 })
        if (definition.xLabel) board.create('text', [definition.xDomain[1] - 0.4, 0, definition.xLabel], { fixed: true, fontSize: 12 })
        if (definition.yLabel) board.create('text', [0, definition.yDomain[1] - 0.2, definition.yLabel], { fixed: true, fontSize: 12 })
        for (const fn of definition.functions) board.create('functiongraph', [fn, ...definition.xDomain], { strokeWidth: 2, highlight: false })
        for (const point of definition.points) board.create('point', [point.x, point.y], {
          name: '',
          size: point.open ? 4 : 3,
          face: 'o',
          fillColor: point.open ? '#fff' : '#d7895c',
          strokeColor: '#d7895c',
          fixed: true,
          withLabel: false,
        })
      } else {
        const view = board.create('view3d', [[0, 0], [760, 440], [definition.xDomain, definition.yDomain, definition.zDomain]], {
          xPlaneRear: { visible: false },
          yPlaneRear: { visible: false },
        })
        for (const surface of definition.functions) {
          view.create('functiongraph3d', [surface, definition.xDomain, definition.yDomain], { stepsU: 40, stepsV: 40, strokeWidth: 0.5 })
        }
      }
      board.update()
      const svg = target.querySelector('svg')
      if (!svg) throw new Error('没有生成图形')
      const graphic = svg.cloneNode(true)
      JSXGraph.freeBoard(board)
      board = undefined
      target.remove()
      const figure = document.createElement('figure')
      figure.className = `markdown-diagram markdown-plot${definition.dimension === 3 ? ' markdown-plot-3d' : ''}`
      figure.append(graphic)
      pre.replaceWith(figure)
    } catch (error) {
      if (board) JSXGraph.freeBoard(board)
      target.remove()
      showDiagramError(pre, error instanceof Error ? `绘图失败：${error.message}` : '绘图失败，请检查代码块内容。')
    }
  }
}

let highlighterPromise: Promise<HighlighterCore> | undefined

export function getHighlighter(): Promise<HighlighterCore> {
  highlighterPromise ??= import('./syntax-highlighter')
    .then(({ createNoteHighlighter }) => createNoteHighlighter())
    .catch((reason: unknown) => {
      highlighterPromise = undefined
      throw reason
    })
  return highlighterPromise
}

function textNodes(code: HTMLElement): Text[] {
  const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  let current: Node | null
  while ((current = walker.nextNode())) nodes.push(current as Text)
  return nodes
}

function locateTextPosition(code: HTMLElement, position: number): { node: Text; offset: number } | undefined {
  let remaining = position
  for (const node of textNodes(code)) {
    if (remaining <= node.data.length) return { node, offset: remaining }
    remaining -= node.data.length
  }
  const nodes = textNodes(code)
  const last = nodes[nodes.length - 1]
  return last ? { node: last, offset: last.data.length } : undefined
}

function deleteTextRange(code: HTMLElement, start: number, end: number): void {
  const startPoint = locateTextPosition(code, start)
  const endPoint = locateTextPosition(code, end)
  if (!startPoint || !endPoint) return
  const range = document.createRange()
  range.setStart(startPoint.node, startPoint.offset)
  range.setEnd(endPoint.node, endPoint.offset)
  range.deleteContents()
}

function wrapTextRange(code: HTMLElement, start: number, end: number): void {
  const startPoint = locateTextPosition(code, start)
  const endPoint = locateTextPosition(code, end)
  if (!startPoint || !endPoint || start >= end) return
  const range = document.createRange()
  range.setStart(startPoint.node, startPoint.offset)
  range.setEnd(endPoint.node, endPoint.offset)
  const mark = document.createElement('mark')
  mark.className = 'markdown-code-highlight'
  mark.appendChild(range.extractContents())
  range.insertNode(mark)
}

function decorateCodeMarkers(pre: Element): void {
  const code = pre.querySelector('code')
  if (!code) return

  const source = code.textContent ?? ''
  const markers = [...source.matchAll(/===([\s\S]*?)===/g)]
  for (let index = markers.length - 1; index >= 0; index -= 1) {
    const marker = markers[index]
    const start = marker.index ?? -1
    if (start < 0) continue
    const contentEnd = start + marker[0].length - 3
    deleteTextRange(code, contentEnd, contentEnd + 3)
    deleteTextRange(code, start, start + 3)
    wrapTextRange(code, start, contentEnd - 3)
  }
}

function replacePre(pre: Element, html: string): void {
  const holder = document.createElement('div')
  holder.innerHTML = html
  const replacement = holder.firstElementChild
  if (!replacement) return
  decorateCodeMarkers(replacement)
  pre.replaceWith(replacement)
}

export interface RenderMarkdownOptions {
  renderPlots?: boolean
}

export async function renderMarkdown(source: string, publicAccount?: string, options: RenderMarkdownOptions = {}): Promise<string> {
  const markdown = await getMarkdownRenderer()
  const container = document.createElement('div')
  container.innerHTML = markdown.render(source)
  if (options.renderPlots !== false) {
    try {
      await renderPlots(container)
    } catch {
      for (const code of Array.from(container.querySelectorAll('pre > code.language-plot'))) {
        const pre = code.parentElement
        if (pre) showDiagramError(pre, '绘图失败，请检查代码块内容。')
      }
    }
  }

  const codeBlocks = Array.from(container.querySelectorAll('pre > code'))
  // Highlighting is optional. Even without it, Markdown's escaped code is readable.
  const highlighter = codeBlocks.some((code) => !code.classList.contains('language-plot'))
    ? await getHighlighter().catch(() => undefined)
    : undefined
  const cBlocks = codeBlocks.flatMap((code) => {
    const languageClass = Array.from(code.classList).find((className) => className.startsWith('language-'))
    const requestedLanguage = languageClass?.replace('language-', '').toLowerCase()
    return requestedLanguage && ['c', 'cpp', 'c++', 'cc', 'cxx', 'h', 'hpp'].includes(requestedLanguage)
      ? [{ code, source: code.textContent ?? '' }]
      : []
  })
  let symbols: Record<string, KernelCodeTag> = {}
  if (highlighter && (authState.user || publicAccount) && cBlocks.length) {
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
        const init = { method: 'POST', body: JSON.stringify({ references: [...references.values()].slice(0, 1000) }) }
        const result = publicAccount
          ? await publicKernelRequest<{ symbols: Record<string, KernelCodeTag> }>(publicAccount, '/api/kernel/linux-6.8/tags/lookup', init)
          : await apiRequest<{ symbols: Record<string, KernelCodeTag> }>('/api/kernel/linux-6.8/tags/lookup', init)
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
    if (normalizedLanguage === 'plot' || !highlighter) continue
    const language = highlighter.getLoadedLanguages().includes(requestedLanguage)
      ? requestedLanguage
      : 'text'

    try {
      if ((authState.user || publicAccount) && symbols && ['c', 'cpp', 'c++', 'cc', 'cxx', 'h', 'hpp'].includes(normalizedLanguage)) {
        const { highlightCCodeWithKernelLinks } = await import('./kernel-code')
        const highlighted = await highlightCCodeWithKernelLinks(code.textContent ?? '', symbols, publicAccount)
        replacePre(pre, `<pre class="shiki github-light" style="background-color:#fff;color:#24292f"><code>${highlighted}</code></pre>`)
        continue
      }
      const highlighted = highlighter.codeToHtml(code.textContent ?? '', {
        lang: language,
        theme: 'github-light',
      })
      replacePre(pre, highlighted)
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
