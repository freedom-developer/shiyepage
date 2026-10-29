<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import guide from '../docs/markdown-guide.md?raw'
import { renderMarkdown } from '../lib/markdown'

const route = useRoute()
const rendered = ref('')
const headings = ref<{ id: string; title: string }[]>([])
const loading = ref(true)
const error = ref('')
let active = true

async function loadGuide() {
  loading.value = true
  error.value = ''
  try {
    const html = await renderMarkdown(guide)
    if (!active) return
    const container = document.createElement('div')
    container.innerHTML = html
    headings.value = Array.from(container.querySelectorAll('h2')).map((heading, index) => {
      heading.id = `markdown-section-${index + 1}`
      return { id: heading.id, title: heading.textContent ?? '' }
    })
    rendered.value = container.innerHTML
  } catch {
    if (active) error.value = '用法文档加载失败，请重新加载。'
  } finally {
    if (active) loading.value = false
  }
  await nextTick()
  if (active && route.hash) document.getElementById(route.hash.slice(1))?.scrollIntoView({ block: 'start' })
}

onMounted(() => { void loadGuide() })
onBeforeUnmount(() => { active = false })
</script>

<template>
  <article class="markdown-guide">
    <header class="markdown-guide-heading">
      <h1>Markdown 与数学公式用法</h1>
      <p>复制示例到笔记正文，点击“预览”查看效果。文档中的公式使用与笔记相同的排版方式。</p>
      <p class="form-help">用左侧目录快速跳转，也可以按 Ctrl+F（Mac：⌘F）查找“极限”“积分”“矩阵”等关键词。查完直接切回编辑标签页即可。</p>
    </header>
    <p v-if="loading" class="loading-state" role="status">正在加载用法文档…</p>
    <div v-else-if="error" role="alert"><p class="form-error">{{ error }}</p><button type="button" class="text-button" @click="loadGuide">重新加载</button></div>
    <div v-else class="markdown-guide-layout">
      <nav class="markdown-guide-toc" aria-label="用法文档目录">
        <strong>快速查找</strong>
        <RouterLink v-for="heading in headings" :key="heading.id" :to="{ name: 'markdown-help', hash: `#${heading.id}` }">{{ heading.title }}</RouterLink>
      </nav>
      <div class="markdown-body markdown-guide-body" v-html="rendered"></div>
    </div>
  </article>
</template>
