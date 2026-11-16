import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import bash from '@shikijs/langs/bash'
import asm from '@shikijs/langs/asm'
import c from '@shikijs/langs/c'
import css from '@shikijs/langs/css'
import html from '@shikijs/langs/html'
import javascript from '@shikijs/langs/javascript'
import json from '@shikijs/langs/json'
import python from '@shikijs/langs/python'
import rust from '@shikijs/langs/rust'
import sql from '@shikijs/langs/sql'
import typescript from '@shikijs/langs/typescript'
import make from '@shikijs/langs/make'
import githubLight from '@shikijs/themes/github-light'

// Keep the engine and grammars in one lazy bundle instead of a burst of imports.
export function createNoteHighlighter() {
  return createHighlighterCore({
    engine: createJavaScriptRegexEngine(),
    themes: [githubLight],
    langs: [bash, asm, c, css, html, javascript, json, python, rust, sql, typescript, make],
  })
}
