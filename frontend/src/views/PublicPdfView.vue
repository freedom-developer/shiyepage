<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import ReaderFullscreenButton from '../components/ReaderFullscreenButton.vue'
import { publicHomeRoute, publicSubjectRoute, usePublicProfile } from '../data/public-profile'

const route = useRoute()
const { account, profile } = usePublicProfile()
const entry = computed(() => profile.value?.entries.find((item) => item.id === route.params.entryId && item.kind === 'pdf'))
const subject = computed(() => profile.value?.subjects.find((item) => item.slug === entry.value?.subjectSlug))
const pdfUrl = ref('')
const loading = ref(false)
const error = ref('')

function clearUrl() {
  if (pdfUrl.value) URL.revokeObjectURL(pdfUrl.value)
  pdfUrl.value = ''
}

watch(() => entry.value?.pdfPath, async (filePath, _previous, onCleanup) => {
  clearUrl()
  error.value = ''
  loading.value = false
  if (!filePath) return
  const controller = new AbortController()
  let active = true
  onCleanup(() => { active = false; controller.abort(); clearUrl() })
  loading.value = true
  try {
    const response = await fetch(filePath, { credentials: 'omit', cache: 'no-store', signal: controller.signal })
    if (!response.ok) throw new Error('这份电子书已取消公开或文件暂时不可用')
    const blob = await response.blob()
    if (active) pdfUrl.value = URL.createObjectURL(blob)
  } catch (reason) {
    if (active) error.value = reason instanceof Error ? reason.message : 'PDF 加载失败'
  } finally {
    if (active) loading.value = false
  }
}, { immediate: true })
onBeforeUnmount(clearUrl)
</script>

<template>
  <main v-if="entry && subject" class="fullscreen-reader pdf-fullscreen">
    <header class="fullscreen-reader-toolbar">
      <RouterLink :to="publicSubjectRoute(account, subject.slug, entry.topicPath)" class="reader-back-link" aria-label="返回目录">← <span>返回目录</span></RouterLink>
      <div class="fullscreen-reader-title"><span class="entry-type type-pdf">PDF</span><strong :title="entry.title">{{ entry.title }}</strong></div>
      <span class="reader-toolbar-spacer"></span>
      <ReaderFullscreenButton />
    </header>
    <div v-if="loading" class="fullscreen-reader-stage"><div class="pdf-placeholder"><div class="pdf-loader"></div><p>正在加载电子书…</p></div></div>
    <iframe v-else-if="pdfUrl" :src="pdfUrl" :title="entry.title" class="fullscreen-pdf-frame"></iframe>
    <div v-else class="fullscreen-reader-stage"><p class="form-error" role="alert">{{ error }}</p></div>
  </main>
  <main v-else class="fullscreen-reader-missing"><h1>这份电子书未公开或不存在</h1><RouterLink :to="publicHomeRoute(account)" class="text-link">返回个人主页 →</RouterLink></main>
</template>
