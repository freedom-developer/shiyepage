<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import ReaderFullscreenButton from '../components/ReaderFullscreenButton.vue'
import { getEntry, getSubject } from '../data/catalog'
import { apiFile, apiRequest, authState } from '../lib/api'

interface Progress { page: number; percent: number }
const route = useRoute()
const entry = computed(() => getEntry(route.params.entryId))
const subject = computed(() => entry.value ? getSubject(entry.value.subjectSlug) : undefined)
const pdfUrl = ref('')
const checking = ref(false)
const available = ref(false)
const error = ref('')
const progress = ref<Progress>({ page: 1, percent: 0 })
const progressSaved = ref(false)

function clearUrl() {
  if (pdfUrl.value) URL.revokeObjectURL(pdfUrl.value)
  pdfUrl.value = ''
}

async function loadPdf(currentEntry: typeof entry.value) {
  clearUrl()
  available.value = false
  error.value = ''
  progress.value = { page: 1, percent: 0 }
  if (!currentEntry?.pdfPath) return
  checking.value = true
  try {
    const metadata = await apiRequest<{ progress?: Progress }>(`/api/resources/${currentEntry.id}`)
    if (metadata.progress) progress.value = { page: metadata.progress.page, percent: metadata.progress.percent }
    const response = await apiFile(currentEntry.pdfPath)
    pdfUrl.value = URL.createObjectURL(await response.blob())
    available.value = true
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'PDF 加载失败'
  } finally { checking.value = false }
}

async function saveProgress() {
  if (!entry.value || !authState.user) return
  progressSaved.value = false
  try {
    await apiRequest(`/api/resources/${entry.value.id}/progress`, { method: 'PUT', body: JSON.stringify(progress.value) })
    progressSaved.value = true
  } catch (reason) { error.value = reason instanceof Error ? reason.message : '阅读进度保存失败' }
}

watch(entry, (currentEntry) => { void loadPdf(currentEntry) }, { immediate: true })
onBeforeUnmount(clearUrl)
</script>

<template>
  <main v-if="entry && subject" class="fullscreen-reader pdf-fullscreen">
    <header class="fullscreen-reader-toolbar">
      <RouterLink :to="{ name: 'subject', params: { subjectSlug: subject.slug, topicPath: entry.topicPath } }" class="reader-back-link" aria-label="返回目录">← <span>返回目录</span></RouterLink>
      <div class="fullscreen-reader-title"><span class="entry-type type-pdf">PDF</span><strong :title="entry.title">{{ entry.title }}</strong></div>
      <span class="reader-toolbar-spacer"></span>
      <ReaderFullscreenButton />
    </header>
    <div v-if="checking" class="fullscreen-reader-stage"><div class="pdf-placeholder"><div class="pdf-loader"></div><p>正在加载 PDF…</p></div></div>
    <iframe v-else-if="available" :src="pdfUrl" :title="entry.title" class="fullscreen-pdf-frame"></iframe>
    <div v-else class="fullscreen-reader-stage"><div class="pdf-placeholder pdf-missing"><div class="pdf-icon">PDF</div><span class="eyebrow">FILE NOT AVAILABLE</span><h2>{{ error || 'PDF 文件还没有上传' }}</h2><p>{{ error ? '请登录并确认你拥有这个文件的访问权限。' : '管理员可以在资料管理页上传文件；上传后会自动提取文本并建立搜索索引。' }}</p></div></div>
    <footer v-if="authState.user" class="fullscreen-reader-footer"><strong>阅读进度 {{ Math.round(progress.percent) }}%</strong><label>页码<input v-model.number="progress.page" type="number" min="1" /></label><label class="fullscreen-progress-range">百分比<input v-model.number="progress.percent" type="range" min="0" max="100" step="1" /></label><button class="text-button" type="button" @click="saveProgress">保存进度</button><span v-if="progressSaved" class="saved-hint">已同步</span></footer>
  </main>
  <main v-else class="fullscreen-reader-missing"><span class="eyebrow">NOT FOUND</span><h1>没有找到这份 PDF</h1><RouterLink to="/" class="text-link">返回首页 →</RouterLink></main>
</template>
