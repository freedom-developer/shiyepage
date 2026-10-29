<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, type RouteLocationRaw } from 'vue-router'
import { findNode, getEntry, getNoteContent, getSubject } from '../data/catalog'
import { apiRequest, authState } from '../lib/api'
import { renderMarkdown } from '../lib/markdown'
import MarkdownEditor from '../components/MarkdownEditor.vue'

interface NoteResource { content?: string; title: string; summary: string; updatedAt: string }
const route = useRoute()
const entry = computed(() => getEntry(route.params.entryId))
const subject = computed(() => entry.value ? getSubject(entry.value.subjectSlug) : undefined)
const resource = ref<NoteResource>()
const rendered = ref('')
const draft = ref('')
const isRendering = ref(false)
const isLoading = ref(false)
const isSaving = ref(false)
const isEditing = ref(false)
const canEdit = ref(false)
const error = ref('')
const breadcrumbs = computed(() => {
  if (!subject.value || !entry.value) return []
  const items: Array<{ title: string; to?: RouteLocationRaw }> = [
    { title: '首页', to: { name: 'home' } },
    { title: subject.value.title, to: { name: 'subject', params: { subjectSlug: subject.value.slug } } },
  ]
  const path: string[] = []
  for (const slug of entry.value.topicPath) {
    path.push(slug)
    const node = findNode(subject.value.nodes, path)
    if (!node) break
    items.push({ title: node.title, to: { name: 'subject', params: { subjectSlug: subject.value.slug, topicPath: [...path] } } })
  }
  items.push({ title: entry.value.title })
  return items
})

async function renderSource(source: string) {
  isRendering.value = true
  try { rendered.value = await renderMarkdown(source) }
  finally { isRendering.value = false }
}

async function loadNote(currentEntry: typeof entry.value) {
  rendered.value = ''
  resource.value = undefined
  draft.value = ''
  error.value = ''
  canEdit.value = false
  if (!currentEntry) return
  isLoading.value = true
  try {
    const result = await apiRequest<{ resource: NoteResource; canEdit: boolean }>(`/api/resources/${currentEntry.id}`)
    resource.value = result.resource
    draft.value = result.resource.content ?? ''
    canEdit.value = result.canEdit
  } catch {
    const fallback = getNoteContent(currentEntry)
    if (fallback) {
      draft.value = fallback
      resource.value = { title: currentEntry.title, summary: currentEntry.summary, updatedAt: currentEntry.updatedAt, content: fallback }
    } else error.value = authState.user ? '笔记内容加载失败' : '这篇笔记需要登录后访问'
  } finally { isLoading.value = false }
  if (draft.value) await renderSource(draft.value)
}

async function saveNote() {
  if (!entry.value) return
  isSaving.value = true
  error.value = ''
  try {
    const result = await apiRequest<{ resource: NoteResource }>(`/api/resources/${entry.value.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ content: draft.value }),
    })
    resource.value = result.resource
    isEditing.value = false
    await renderSource(draft.value)
  } catch (reason) { error.value = reason instanceof Error ? reason.message : '笔记保存失败' }
  finally { isSaving.value = false }
}

watch(entry, (currentEntry) => { void loadNote(currentEntry) }, { immediate: true })
</script>

<template>
  <article v-if="entry && subject" class="reader-view note-reader">
    <nav class="breadcrumb" aria-label="面包屑"><template v-for="(item, index) in breadcrumbs" :key="`${index}-${item.title}`"><span v-if="index" aria-hidden="true">/</span><RouterLink v-if="item.to" :to="item.to">{{ item.title }}</RouterLink><span v-else aria-current="page">{{ item.title }}</span></template></nav>
    <header class="reader-header">
      <div class="reader-header-top"><span class="entry-type type-note">学习笔记</span><div v-if="canEdit" class="note-reading-actions"><RouterLink :to="{ name: 'subject', params: { subjectSlug: subject.slug, topicPath: entry.topicPath }, query: { edit: entry.id } }" class="text-button">在学科页编辑</RouterLink><button class="text-button" type="button" @click="isEditing = !isEditing">{{ isEditing ? '取消编辑' : '编辑正文' }}</button></div></div>
      <h1>{{ resource?.title ?? entry.title }}</h1>
      <p>{{ resource?.summary ?? entry.summary }}</p>
      <div class="reader-meta"><span>更新于 {{ resource?.updatedAt?.slice(0, 10) ?? entry.updatedAt }}</span><span>Markdown · KaTeX · Shiki</span><span v-if="authState.user">{{ authState.user.email }}</span></div>
    </header>
    <div v-if="isLoading" class="loading-state">正在加载笔记…</div>
    <div v-else-if="isEditing" class="editor-panel"><MarkdownEditor v-model="draft" :disabled="isSaving" /><div class="editor-actions"><span>直接编辑 Markdown，保存后自动排版公式与代码</span><button class="button-primary" type="button" :disabled="isSaving" @click="saveNote">{{ isSaving ? '保存中…' : '保存笔记' }} <span>↗</span></button></div></div>
    <div v-else-if="isRendering" class="loading-state">正在整理页面内容…</div>
    <div v-else-if="rendered" class="markdown-body" v-html="rendered"></div>
    <div v-else class="empty-state"><span class="empty-state-icon">✳</span><div><h3>笔记内容暂未找到</h3><p>请登录后确认这是一篇可访问的笔记。</p></div></div>
    <p v-if="error" class="form-error">{{ error }}</p>
    <RouterLink :to="{ name: 'subject', params: { subjectSlug: subject.slug, topicPath: entry.topicPath } }" class="back-link">← 返回目录</RouterLink>
  </article>
  <div v-else class="not-found-inline"><span class="eyebrow">NOT FOUND</span><h1>没有找到这篇笔记</h1><RouterLink to="/" class="text-link">返回首页 →</RouterLink></div>
</template>
