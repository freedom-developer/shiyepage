<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ChmReader } from 'web-chm-reader/vue'
import 'web-chm-reader/style.css'
import ReaderFullscreenButton from '../components/ReaderFullscreenButton.vue'
import { getEntry, getSubject } from '../data/catalog'
import { publicHomeRoute, publicSubjectRoute, usePublicProfile } from '../data/public-profile'
import { apiFile } from '../lib/api'

const route = useRoute()
const isPublic = computed(() => route.name === 'public-chm')
const publicProfile = isPublic.value ? usePublicProfile() : undefined
const account = computed(() => String(route.params.account ?? '').toLowerCase())
const entry = computed(() => isPublic.value
  ? publicProfile?.profile.value?.entries.find((item) => item.id === route.params.entryId && item.kind === 'chm')
  : getEntry(route.params.entryId)?.kind === 'chm' ? getEntry(route.params.entryId) : undefined)
const subject = computed(() => isPublic.value
  ? publicProfile?.profile.value?.subjects.find((item) => item.slug === entry.value?.subjectSlug)
  : getSubject(entry.value?.subjectSlug))
const source = ref<Blob | null>(null)
const loading = ref(false)
const error = ref('')
let loadVersion = 0

watch(() => [entry.value?.id, entry.value?.filePath], async ([id, filePath]) => {
  const version = ++loadVersion
  source.value = null
  error.value = ''
  if (!id || !filePath) return
  loading.value = true
  try {
    const response = isPublic.value
      ? await fetch(filePath, { credentials: 'omit', cache: 'no-store' }).then((result) => {
        if (!result.ok) throw new Error('这份 CHM 文件未公开或暂时不可用')
        return result
      })
      : await apiFile(filePath)
    const blob = await response.blob()
    if (version === loadVersion) source.value = blob
  } catch (reason) {
    if (version === loadVersion) error.value = reason instanceof Error ? reason.message : 'CHM 文件加载失败'
  } finally {
    if (version === loadVersion) loading.value = false
  }
}, { immediate: true })

onBeforeUnmount(() => { loadVersion++ })
</script>

<template>
  <main v-if="entry && subject" class="fullscreen-reader chm-fullscreen">
    <header class="fullscreen-reader-toolbar">
      <RouterLink v-if="isPublic" :to="publicSubjectRoute(account, subject.slug, entry.topicPath)" class="reader-back-link" aria-label="返回目录">← <span>返回目录</span></RouterLink>
      <RouterLink v-else :to="{ name: 'subject', params: { subjectSlug: subject.slug, topicPath: entry.topicPath } }" class="reader-back-link" aria-label="返回目录">← <span>返回目录</span></RouterLink>
      <div class="fullscreen-reader-title"><span class="entry-type type-chm">CHM</span><strong :title="entry.title">{{ entry.title }}</strong></div>
      <span class="reader-toolbar-spacer"></span>
      <ReaderFullscreenButton />
    </header>
    <div v-if="loading" class="fullscreen-reader-stage"><div class="pdf-placeholder"><div class="pdf-loader"></div><p>正在加载 CHM 文档…</p></div></div>
    <div v-else-if="source" class="chm-reader-frame"><ChmReader :source="source" height="100%" theme="light" locale="zh-CN" @error="(reason: Error) => { error = reason.message }" /></div>
    <div v-else-if="error" class="fullscreen-reader-stage"><div class="empty-state" role="alert"><span class="empty-state-icon">!</span><div><h3>无法打开 CHM 文件</h3><p>{{ error }}</p></div></div></div>
  </main>
  <main v-else class="fullscreen-reader-missing">
    <h1>这份 CHM 文件不存在或没有访问权限</h1>
    <RouterLink v-if="isPublic" :to="publicHomeRoute(account)" class="text-link">返回个人主页 →</RouterLink>
    <RouterLink v-else to="/" class="text-link">返回首页 →</RouterLink>
  </main>
</template>
