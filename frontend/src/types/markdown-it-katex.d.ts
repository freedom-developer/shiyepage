declare module 'markdown-it-katex' {
  import type MarkdownIt from 'markdown-it'

  const plugin: (markdown: MarkdownIt, options?: Record<string, unknown>) => void
  export default plugin
}
