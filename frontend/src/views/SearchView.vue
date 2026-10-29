<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { apiRequest } from '../lib/api'
import KernelTagPicker from '../components/KernelTagPicker.vue'
import type { KernelCodeTag } from '../lib/kernel-code'

type SearchScope = 'all' | 'resources' | 'kernel'
interface ResourceResult { id: string; kind: 'note' | 'pdf' | 'chm'; title: string; summary: string; subjectSlug: string; updatedAt: string }
type KernelTag = KernelCodeTag
interface KernelSearchResponse { results: KernelTag[]; matchMode: 'exact' | 'prefix' | 'none'; hasMore: boolean; offset: number; limit: number }

const route = useRoute()
const router = useRouter()
const query = ref(typeof route.query.q === 'string' ? route.query.q : '')
const scope = ref<SearchScope>(route.query.scope === 'resources' || route.query.scope === 'kernel' ? route.query.scope : 'all')
const resourceResults = ref<ResourceResult[]>([])
const kernelResults = ref<KernelTag[]>([])
const resourceLoading = ref(false)
const kernelLoading = ref(false)
const resourceError = ref('')
const kernelError = ref('')
const kernelMatchMode = ref<'exact' | 'prefix' | 'none'>('none')
const kernelHasMore = ref(false)
const searchedQuery = ref('')
const pickerName = ref('')
const pickerTags = ref<KernelTag[]>([])
const pickerLoading = ref(false)
let searchVersion = 0

const loading = computed(() => resourceLoading.value || kernelLoading.value)
const hasResults = computed(() => resourceResults.value.length > 0 || kernelResults.value.length > 0)
const kernelGroups = computed(() => {
  const groups = new Map<string, KernelTag[]>()
  for (const tag of kernelResults.value) groups.set(tag.name, [...(groups.get(tag.name) ?? []), tag])
  return [...groups.entries()].map(([name, tags]) => ({ name, tags }))
})

function resourceRoute(result: ResourceResult) {
  if (result.kind === 'note') return { name: 'note', params: { entryId: result.id } }
  return { name: result.kind === 'chm' ? 'chm' : 'pdf', params: { entryId: result.id } }
}

function tagKindLabel(kind: string) {
  const labels: Record<string, string> = {
    c: '类', d: '宏/定义', e: '枚举', f: '函数', g: '枚举值', m: '成员', p: '函数原型', s: '结构体',
    t: '类型定义', u: '联合体', v: '变量', n: '命名空间',
  }
  return labels[kind] ?? kind
}

function kernelRoute(tag: KernelTag) {
  return {
    name: 'kernel-source',
    query: { file: tag.file, name: tag.name, address: tag.address, q: searchedQuery.value, scope: scope.value },
  }
}

async function openKernelTag(group: { name: string; tags: KernelTag[] }) {
  if (group.tags.length === 1) {
    void router.push(kernelRoute(group.tags[0]))
    return
  }
  pickerLoading.value = true
  try {
    const response = await apiRequest<KernelSearchResponse>(`/api/kernel/linux-6.8/tags?q=${encodeURIComponent(group.name)}&limit=1000`)
    const tags = response.results.filter((tag) => tag.name === group.name)
    pickerName.value = group.name
    pickerTags.value = tags.length > 1 ? tags : group.tags
  } catch {
    pickerName.value = group.name
    pickerTags.value = group.tags
  } finally {
    pickerLoading.value = false
  }
}

function closePicker() {
  pickerName.value = ''
  pickerTags.value = []
}

async function loadKernelPage(value: string, offset: number, version = searchVersion, append = false) {
  kernelLoading.value = true
  kernelError.value = ''
  try {
    const response = await apiRequest<KernelSearchResponse>(`/api/kernel/linux-6.8/tags?q=${encodeURIComponent(value)}&offset=${offset}`)
    if (version !== searchVersion) return
    if (append) kernelResults.value.push(...response.results)
    else kernelResults.value = response.results
    kernelMatchMode.value = response.matchMode
    kernelHasMore.value = response.hasMore
  } catch (reason) {
    if (version === searchVersion) kernelError.value = reason instanceof Error ? reason.message : 'Linux 符号搜索失败'
  } finally {
    if (version === searchVersion) kernelLoading.value = false
  }
}

async function loadMoreKernelResults() {
  if (!searchedQuery.value || kernelLoading.value || !kernelHasMore.value) return
  await loadKernelPage(searchedQuery.value, kernelResults.value.length, searchVersion, true)
}

async function runSearch(value: string, selectedScope: SearchScope) {
  const version = ++searchVersion
  searchedQuery.value = value
  resourceResults.value = []
  kernelResults.value = []
  resourceError.value = ''
  kernelError.value = ''
  kernelMatchMode.value = 'none'
  kernelHasMore.value = false
  resourceLoading.value = false
  kernelLoading.value = false
  if (!value) return

  const tasks: Promise<void>[] = []
  if (selectedScope === 'all' || selectedScope === 'resources') {
    resourceLoading.value = true
    tasks.push((async () => {
      try {
        const response = await apiRequest<{ results: ResourceResult[] }>(`/api/search?q=${encodeURIComponent(value)}`)
        if (version === searchVersion) resourceResults.value = response.results
      } catch (reason) {
        if (version === searchVersion) resourceError.value = reason instanceof Error ? reason.message : '笔记与资料搜索失败'
      } finally {
        if (version === searchVersion) resourceLoading.value = false
      }
    })())
  }
  if (selectedScope === 'all' || selectedScope === 'kernel') {
    tasks.push(loadKernelPage(value, 0, version))
  }
  await Promise.all(tasks)
}

async function search() {
  const value = query.value.trim()
  const nextQuery = { ...(value ? { q: value } : {}), scope: scope.value }
  if (route.query.q === value && route.query.scope === scope.value) {
    await runSearch(value, scope.value)
  } else {
    await router.replace({ name: 'search', query: nextQuery })
  }
}

function selectScope(value: SearchScope) {
  scope.value = value
  void search()
}

watch(() => [route.query.q, route.query.scope] as const, ([routeQuery, routeScope]) => {
  query.value = typeof routeQuery === 'string' ? routeQuery : ''
  scope.value = routeScope === 'resources' || routeScope === 'kernel' ? routeScope : 'all'
  void runSearch(query.value.trim(), scope.value)
}, { immediate: true })
</script>

<template>
  <section class="search-view">
    <div class="search-heading"><div><span class="eyebrow">SEARCH YOUR ARCHIVE</span><h1>搜索</h1><p>笔记、PDF 与 Linux-6.8 符号索引分别检索并分组显示。</p></div></div>
    <div class="search-scopes" role="tablist" aria-label="搜索范围">
      <button type="button" role="tab" :aria-selected="scope === 'all'" :class="{ 'is-active': scope === 'all' }" @click="selectScope('all')">全部</button>
      <button type="button" role="tab" :aria-selected="scope === 'resources'" :class="{ 'is-active': scope === 'resources' }" @click="selectScope('resources')">笔记与文件</button>
      <button type="button" role="tab" :aria-selected="scope === 'kernel'" :class="{ 'is-active': scope === 'kernel' }" @click="selectScope('kernel')">Linux 符号</button>
    </div>
    <form class="search-form" @submit.prevent="search">
      <input v-model="query" type="search" :placeholder="scope === 'kernel' ? '输入符号名，例如 schedule 或 task_struct' : scope === 'resources' ? '搜索笔记、PDF 或 CHM 标题' : '搜索笔记、资料文件或 Linux 符号'" autofocus />
      <button class="button-primary" type="submit">搜索 <span>↗</span></button>
    </form>
    <p v-if="loading" class="loading-state" role="status">正在搜索…</p>

    <div v-if="resourceError || kernelError" class="search-errors" role="alert">
      <p v-if="resourceError">笔记与资料：{{ resourceError }}</p>
      <p v-if="kernelError">Linux 符号：{{ kernelError }}</p>
    </div>

    <div v-if="searchedQuery && !loading && !hasResults && !resourceError && !kernelError" class="empty-state search-empty">
      <span class="empty-state-icon">⌕</span><div><h3>没有匹配结果</h3><p>试试完整的 C 符号名，或切换搜索范围。</p></div>
    </div>

    <div v-if="searchedQuery" class="search-groups">
      <section v-if="scope !== 'kernel' && (resourceResults.length || resourceError)" class="search-group">
        <header class="search-group-heading"><h2>笔记与文件</h2><span>{{ resourceResults.length }} 条</span></header>
        <div v-if="resourceResults.length" class="search-results">
          <RouterLink v-for="result in resourceResults" :key="result.id" :to="resourceRoute(result)" :target="result.kind === 'note' ? undefined : '_blank'" :rel="result.kind === 'note' ? undefined : 'noopener noreferrer'" class="search-result-row">
            <span class="entry-type" :class="`type-${result.kind}`">{{ result.kind === 'note' ? '笔记' : result.kind.toUpperCase() }}</span>
            <span><strong>{{ result.title }}</strong><small>{{ result.summary || result.subjectSlug }}</small></span>
            <time>{{ new Date(result.updatedAt).toLocaleDateString('zh-CN') }}</time><span>↗</span>
          </RouterLink>
        </div>
      </section>

      <section v-if="scope !== 'resources' && (kernelResults.length || kernelError || (!kernelLoading && searchedQuery))" class="search-group">
        <header class="search-group-heading"><div><h2>Linux-6.8 符号</h2><p v-if="kernelMatchMode === 'prefix'">没有完全相同的标签，以下为名称前缀匹配</p></div><span>{{ kernelResults.length }} 条{{ kernelHasMore ? '以上' : '' }}</span></header>
        <div v-if="kernelResults.length" class="kernel-search-results">
          <button v-for="group in kernelGroups" :key="group.name" type="button" class="kernel-search-result" :disabled="pickerLoading" @click="openKernelTag(group)">
            <span class="kernel-result-kind">{{ group.tags.length > 1 ? `${group.tags.length} 个定义` : tagKindLabel(group.tags[0].kind) }}</span>
            <span class="kernel-result-copy"><strong>{{ group.name }}</strong><small>{{ group.tags.length > 1 ? '点击选择具体源码定义' : `${group.tags[0].scope ? `${group.tags[0].scope} · ` : ''}${group.tags[0].file}` }}</small></span>
            <span class="kernel-result-arrow" aria-hidden="true">↗</span>
          </button>
          <button v-if="kernelHasMore" type="button" class="load-more-button" :disabled="kernelLoading" @click="loadMoreKernelResults">{{ kernelLoading ? '加载中…' : '加载更多定义' }}</button>
        </div>
        <p v-else-if="kernelError" class="search-inline-error">{{ kernelError }}</p>
        <p v-else-if="searchedQuery && !kernelLoading && kernelMatchMode === 'none'" class="search-inline-empty">没有匹配的 Linux 符号。</p>
      </section>
    </div>
    <KernelTagPicker v-if="pickerTags.length" :name="pickerName" :tags="pickerTags" @close="closePicker" />
  </section>
</template>
