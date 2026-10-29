<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { apiRequest } from '../lib/api'
import { getEntry, getNoteContent, getSubject, type LearningEntry, type Subject } from '../data/catalog'
import { publicApiBase, publicHomeRoute, publicRequest } from '../data/public-profile'
import { renderMarkdown } from '../lib/markdown'

const props = defineProps<{ entryId: string; readOnly?: boolean; publicAccount?: string; publicEntry?: LearningEntry; publicSubject?: Subject }>()
const emit = defineEmits<{ edit: [id: string]; deleted: [] }>()
const entry = computed(() => props.publicAccount ? props.publicEntry : getEntry(props.entryId))
const subject = computed(() => props.publicAccount ? props.publicSubject : entry.value ? getSubject(entry.value.subjectSlug) : undefined)
const title = ref('')
const summary = ref('')
const content = ref('')
const rendered = ref('')
const loading = ref(false)
const rendering = ref(false)
const error = ref('')
const version = ref(0)
const canEdit = ref(false)

async function load() {
  const current = ++version.value
  const currentEntry = entry.value
  title.value = currentEntry?.title ?? ''; summary.value = currentEntry?.summary ?? ''; content.value = ''; rendered.value = ''; error.value = ''; canEdit.value = false; loading.value = false; rendering.value = false
  if (!currentEntry) return
  loading.value = true
  try {
    const request = props.publicAccount ? publicRequest : apiRequest
    const base = props.publicAccount ? `${publicApiBase(props.publicAccount)}/resources` : '/api/resources'
    const result = await request<{ resource: { kind: string; title: string; summary: string; content: string | null }; canEdit: boolean }>(`${base}/${encodeURIComponent(currentEntry.id)}`)
    if (current !== version.value) return
    title.value = result.resource.title; summary.value = result.resource.summary; content.value = result.resource.content ?? ''; canEdit.value = !props.readOnly && !props.publicAccount && result.canEdit
  } catch {
    if (current !== version.value) return
    const fallback = props.publicAccount ? undefined : getNoteContent(currentEntry)
    if (fallback) content.value = fallback
    else error.value = props.publicAccount ? '笔记已取消公开或暂时无法访问。' : '笔记内容加载失败，请确认登录状态和访问权限。'
  } finally { if (current === version.value) loading.value = false }
  if (content.value) {
    rendering.value = true
    try { const output = await renderMarkdown(content.value); if (current === version.value) rendered.value = output }
    catch { if (current === version.value) error.value = '笔记内容渲染失败' }
    finally { if (current === version.value) rendering.value = false }
  }
}
watch([() => props.entryId, () => props.publicAccount, entry], () => { void load() }, { immediate: true })
onBeforeUnmount(() => { version.value++ })
</script>

<template>
  <article v-if="entry && subject" class="note-reader">
    <header class="reader-header"><div class="reader-header-top"><span class="entry-type type-note">学习笔记</span><button v-if="canEdit" type="button" class="text-button" @click="emit('edit', entry.id)">编辑笔记</button></div><h1>{{ title || entry.title }}</h1><p>{{ summary || entry.summary }}</p><div class="reader-meta"><span>更新于 {{ entry.updatedAt }}</span><span>Markdown · KaTeX · Shiki</span></div></header>
    <div v-if="loading" class="loading-state">正在加载笔记…</div><div v-else-if="rendering" class="loading-state">正在整理页面内容…</div><div v-else-if="rendered" class="markdown-body" v-html="rendered"></div><div v-else class="empty-state"><span class="empty-state-icon">✳</span><div><h3>笔记内容暂未找到</h3><p>{{ error || '这篇笔记还没有正文。' }}</p></div></div>
    <p v-if="error && rendered" class="form-error">{{ error }}</p>
  </article>
  <div v-else class="not-found-inline"><span class="eyebrow">NOT FOUND</span><h1>没有找到这篇笔记</h1><RouterLink :to="publicAccount ? publicHomeRoute(publicAccount) : '/'" class="text-link">返回首页 →</RouterLink></div>
</template>
