<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { apiRequest } from '../lib/api'
import KernelCodeViewer from '../components/KernelCodeViewer.vue'
import type { KernelCodeTag } from '../lib/kernel-code'

interface SourceFile { file: string; line: number; startLine: number; lines: string[]; symbols: Record<string, KernelCodeTag> }
const route = useRoute()
const source = ref<SourceFile>()
const loading = ref(false)
const error = ref('')

async function loadSource() {
  const file = typeof route.query.file === 'string' ? route.query.file : ''
  const name = typeof route.query.name === 'string' ? route.query.name : ''
  const address = typeof route.query.address === 'string' ? route.query.address : ''
  source.value = undefined
  error.value = ''
  if (!file || !name || !address) {
    error.value = '源码定位信息不完整，请从符号搜索结果进入。'
    return
  }
  loading.value = true
  const query = new URLSearchParams({ file, name, address })
  try {
    source.value = await apiRequest<SourceFile>(`/api/kernel/linux-6.8/source?${query}`)
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '源码加载失败'
  } finally { loading.value = false }
}

watch(() => [route.query.file, route.query.name, route.query.address], () => { void loadSource() }, { immediate: true })
</script>

<template>
  <article class="kernel-source-view">
    <nav class="breadcrumb" aria-label="面包屑"><RouterLink to="/search">搜索</RouterLink><span>/</span><span>Linux-6.8</span><span>/</span><span>{{ typeof route.query.name === 'string' ? route.query.name : '源码定义' }}</span></nav>
    <header class="reader-header kernel-source-heading">
      <div class="reader-header-top"><span class="entry-type type-kernel">Linux 符号</span><RouterLink :to="{ name: 'search', query: { q: route.query.q, scope: route.query.scope ?? 'kernel' } }" class="text-button">返回搜索结果</RouterLink></div>
      <h1>{{ typeof route.query.name === 'string' ? route.query.name : '源码定义' }}</h1>
      <p>{{ source?.file ?? (typeof route.query.file === 'string' ? route.query.file : '') }}</p>
      <div v-if="source" class="reader-meta"><span>定义位于第 {{ source.line }} 行</span><span>完整文件 · {{ source.lines.length }} 行</span><span>Linux v6.8 · 只读源码</span></div>
    </header>
    <p v-if="loading" class="loading-state" role="status">正在定位源码定义…</p>
    <div v-else-if="error" class="empty-state"><span class="empty-state-icon">!</span><div><h3>无法打开源码定义</h3><p>{{ error }}</p></div></div>
    <KernelCodeViewer v-else-if="source" :file="source.file" :start-line="source.startLine" :lines="source.lines" :symbols="source.symbols" :highlight-line="source.line" />
    <RouterLink :to="{ name: 'search', query: { q: route.query.q, scope: route.query.scope ?? 'kernel' } }" class="back-link">← 返回搜索结果</RouterLink>
  </article>
</template>
