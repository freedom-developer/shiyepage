<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { apiRequest } from '../lib/api'
import KernelCodeViewer from './KernelCodeViewer.vue'
import type { KernelCodeTag } from '../lib/kernel-code'

interface KernelDirectoryEntry { name: string; path: string; slug: string; kind: 'directory' | 'file' }
interface KernelDirectory { path: string; entries: KernelDirectoryEntry[] }
interface KernelSourceFile { file: string; startLine: number; lines: string[]; symbols: Record<string, KernelCodeTag> }

const props = defineProps<{ subjectSlug: string; topicPath: string[]; versionPath: string[]; initialDirectory?: string }>()
const route = useRoute()
const router = useRouter()
const directory = ref<KernelDirectory>()
const sourceFile = ref<KernelSourceFile>()
const loading = ref(false)
const error = ref('')
const filePath = computed(() => typeof route.query.file === 'string' ? route.query.file : '')
const routeDirectory = computed(() => typeof route.query.dir === 'string' ? route.query.dir : '')
const breadcrumbs = computed(() => directory.value?.path ? directory.value.path.split('/') : [])

function directorySlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function subjectRoute(topicPath: string[], query: Record<string, string> = {}) {
  return { name: 'subject', params: { subjectSlug: props.subjectSlug, topicPath }, query }
}

async function loadDirectory() {
  loading.value = true
  error.value = ''
  directory.value = undefined
  sourceFile.value = undefined
  try {
    let path = routeDirectory.value || props.initialDirectory || ''
    if (!path && props.topicPath.length > props.versionPath.length) {
      const root = await apiRequest<KernelDirectory>('/api/kernel/linux-6.8/directory')
      const rootSlug = props.topicPath[props.versionPath.length]
      const rootDirectory = root.entries.find((entry) => entry.kind === 'directory' && entry.slug === rootSlug)
      if (!rootDirectory) throw new Error('没有找到对应的 Linux-6.8 子目录')
      path = rootDirectory.path
    }
    const query = path ? `?path=${encodeURIComponent(path)}` : ''
    directory.value = await apiRequest<KernelDirectory>(`/api/kernel/linux-6.8/directory${query}`)
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '源码目录加载失败'
  } finally { loading.value = false }
}

async function loadFile() {
  if (!filePath.value) return
  loading.value = true
  directory.value = undefined
  sourceFile.value = undefined
  error.value = ''
  try {
    const query = new URLSearchParams({ path: filePath.value })
    sourceFile.value = await apiRequest<KernelSourceFile>(`/api/kernel/linux-6.8/file?${query}`)
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '源码文件加载失败'
  } finally {
    loading.value = false
  }
}

function openDirectory(entry: KernelDirectoryEntry) {
  const rootPath = props.topicPath.length > props.versionPath.length
    ? props.topicPath.slice(0, props.versionPath.length + 1)
    : [...props.versionPath, entry.slug]
  void router.push(subjectRoute(rootPath, { dir: entry.path }))
}

function openFile(entry: KernelDirectoryEntry) {
  void router.push(subjectRoute(props.topicPath, { dir: directory.value?.path ?? '', file: entry.path }))
}

function browseParent() {
  const parent = directory.value?.path.split('/').slice(0, -1).join('/') ?? ''
  const rootPath = props.topicPath.length > props.versionPath.length
    ? props.topicPath.slice(0, props.versionPath.length + 1)
    : props.versionPath
  void router.push(subjectRoute(parent ? rootPath : props.versionPath, parent ? { dir: parent } : {}))
}

watch(() => [props.topicPath.join('/'), route.query.dir, route.query.file] as const, ([, , file]) => {
  if (file) void loadFile()
  else void loadDirectory()
}, { immediate: true })
</script>

<template>
  <section class="kernel-browser">
    <div class="kernel-browser-heading">
      <div><span class="eyebrow">LINUX SOURCE TREE</span><h1>Linux-6.8</h1><p>源码文件从本地只读目录按需读取，tags 符号可通过全局搜索定位。</p></div>
      <RouterLink :to="{ name: 'search', query: { scope: 'kernel' } }" class="button-primary kernel-symbol-search">搜索符号 <span>⌕</span></RouterLink>
    </div>

    <nav v-if="directory" class="kernel-browser-breadcrumb" aria-label="源码目录路径">
      <button type="button" @click="router.push(subjectRoute(props.versionPath))">Linux-6.8</button>
      <template v-for="(part, index) in breadcrumbs" :key="`${index}-${part}`"><span aria-hidden="true">/</span><button type="button" :disabled="index === breadcrumbs.length - 1" @click="router.push(subjectRoute([...props.versionPath, directorySlug(breadcrumbs[0] ?? '')], { dir: breadcrumbs.slice(0, index + 1).join('/') }))">{{ part }}</button></template>
    </nav>

    <p v-if="loading" class="loading-state" role="status">正在读取 Linux-6.8 源码…</p>
    <div v-else-if="error" class="empty-state"><span class="empty-state-icon">!</span><div><h3>无法读取源码</h3><p>{{ error }}</p></div></div>

    <div v-else-if="directory" class="kernel-browser-list">
      <div class="kernel-browser-list-heading"><span>{{ directory.path || 'Linux-6.8' }}</span><span>{{ directory.entries.length }} 项</span></div>
      <button v-if="directory.path" type="button" class="kernel-browser-entry" @click="browseParent"><span class="kernel-entry-icon">↰</span><strong>上一级</strong><small>返回父目录</small></button>
      <button v-for="entry in directory.entries" :key="entry.path" type="button" class="kernel-browser-entry" @click="entry.kind === 'directory' ? openDirectory(entry) : openFile(entry)">
        <span class="kernel-entry-icon" :class="entry.kind">{{ entry.kind === 'directory' ? 'DIR' : 'SRC' }}</span><strong>{{ entry.name }}</strong><small>{{ entry.kind === 'directory' ? '目录' : '源码文件' }}</small><span class="kernel-entry-open">{{ entry.kind === 'directory' ? '打开目录' : '打开源码' }} ↗</span>
      </button>
    </div>

    <section v-else-if="sourceFile" class="kernel-file-view">
      <div class="kernel-file-heading"><div><span class="eyebrow">READ-ONLY SOURCE</span><h2>{{ sourceFile.file }}</h2><p>完整源码 · {{ sourceFile.lines.length }} 行</p></div><button class="text-button" type="button" @click="router.push(subjectRoute(props.topicPath, route.query.dir ? { dir: String(route.query.dir) } : {}))">返回目录</button></div>
      <KernelCodeViewer :file="sourceFile.file" :start-line="sourceFile.startLine" :lines="sourceFile.lines" :symbols="sourceFile.symbols" />
    </section>
  </section>
</template>
