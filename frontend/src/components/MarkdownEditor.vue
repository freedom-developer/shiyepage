<script setup lang="ts">
import { nextTick, useId } from 'vue'

defineProps<{ disabled?: boolean }>()
const content = defineModel<string>({ required: true })
const editorId = useId()

function insertTab(event: KeyboardEvent) {
  if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return

  event.preventDefault()
  const textarea = event.currentTarget as HTMLTextAreaElement
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  content.value = `${textarea.value.slice(0, start)}\t${textarea.value.slice(end)}`
  void nextTick(() => textarea.setSelectionRange(start + 1, start + 1))
}
</script>

<template>
  <div class="markdown-editor">
    <div class="markdown-editor-heading">
      <label :for="editorId">正文（Markdown）</label>
      <a href="/help/markdown" target="_blank" rel="noopener noreferrer" class="text-button">Markdown 与公式符号速查 ↗</a>
    </div>
    <textarea
      ref="editor"
      :id="editorId"
      v-model="content"
      class="note-editor markdown-source"
      @keydown.tab="insertTab"
      :disabled="disabled"
      rows="20"
      spellcheck="false"
      autocapitalize="off"
      autocomplete="off"
      placeholder="在这里输入 Markdown 正文…"
    ></textarea>
    <p class="form-help markdown-editor-hint">公式用 <code>$...$</code> 或 <code>$$...$$</code>；函数图用 <code>plot</code> 代码块。帮助文档有可复制示例。</p>
  </div>
</template>
