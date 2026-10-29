<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import { apiRequest } from '../lib/api'
import { entries, entriesForNode, findNode, getEntry, getSubject, loadCatalog, type CatalogNode, type LearningEntry } from '../data/catalog'
import NoteEditor from '../components/NoteEditor.vue'
import NoteReader from '../components/NoteReader.vue'
import KernelBrowser from '../components/KernelBrowser.vue'
import TopicFileLibrary from '../components/TopicFileLibrary.vue'

const route = useRoute()
const router = useRouter()
const message = ref('')
const error = ref('')
const deleting = ref('')
const subject = computed(() => getSubject(route.params.subjectSlug))
const topicPath = computed(() => { const value = route.params.topicPath; return Array.isArray(value) ? value : typeof value === 'string' && value ? value.split('/') : [] })
const selectedNode = computed(() => subject.value ? findNode(subject.value.nodes, topicPath.value) : undefined)
function findKernelMenuPath(nodes: CatalogNode[], parent: string[] = []): string[] | undefined {
  for (const node of nodes) {
    const current = [...parent, node.slug]
    if (node.slug === 'linux-kernel' || node.title.toLowerCase() === 'linux kernel') return current
    const child = node.children?.length ? findKernelMenuPath(node.children, current) : undefined
    if (child) return child
  }
  return undefined
}
const kernelBrowser = computed(() => {
  if (!subject.value) return undefined
  if (subject.value.slug === 'linux-kernel') {
    return topicPath.value[0] === 'linux-6-8' ? { versionPath: ['linux-6-8'] } : undefined
  }
  const menuPath = findKernelMenuPath(subject.value.nodes)
  if (!menuPath || !menuPath.every((part, index) => topicPath.value[index] === part)) return undefined
  if (topicPath.value[menuPath.length] !== 'linux-6-8') return undefined
  return { versionPath: [...menuPath, 'linux-6-8'] }
})
const legacyKernelDirectory = computed(() => {
  if (!kernelBrowser.value || !subject.value || topicPath.value.length <= kernelBrowser.value.versionPath.length) return ''
  const names: string[] = []
  let nodes = subject.value.nodes
  for (const [index, slug] of topicPath.value.entries()) {
    const node = nodes.find((item) => item.slug === slug)
    if (!node) break
    if (index >= kernelBrowser.value.versionPath.length) names.push(node.title)
    nodes = node.children ?? []
  }
  return names.join('/')
})
const visibleEntries = computed(() => subject.value ? entriesForNode(subject.value, selectedNode.value) : [])
const notes = computed(() => visibleEntries.value.filter((entry) => entry.kind === 'note'))
const childNodes = computed(() => selectedNode.value
  ? (selectedNode.value.children ?? [])
  : (subject.value?.nodes ?? []))
const noteId = computed(() => typeof route.query.note === 'string' ? route.query.note : '')
const editId = computed(() => typeof route.query.edit === 'string' ? route.query.edit : '')
const creating = computed(() => route.query.new === '1')
const workspaceOpen = computed(() => creating.value || Boolean(noteId.value) || Boolean(editId.value))
const breadcrumbs = computed(() => {
  if (!subject.value) return []
  const visiblePath = kernelBrowser.value ? topicPath.value.slice(0, kernelBrowser.value.versionPath.length) : topicPath.value
  const items: Array<{ title: string; to?: RouteLocationRaw }> = [
    { title: '首页', to: { name: 'home' } },
    { title: subject.value.title, to: subjectRoute([]) },
  ]
  const path: string[] = []
  for (const slug of visiblePath) {
    path.push(slug)
    const node = findNode(subject.value.nodes, path)
    if (!node) break
    items.push({ title: node.title, to: subjectRoute([...path]) })
  }
  const note = getEntry(noteId.value || editId.value)
  if (note?.kind === 'note') items.push({ title: note.title })
  return items
})

function subjectRoute(path: string[]) { return { name: 'subject', params: { subjectSlug: subject.value?.slug, topicPath: path } } }
function openNote(note: LearningEntry) { void router.push({ ...subjectRoute(note.topicPath), query: { note: note.id } }) }
function editNote(note: LearningEntry) { void router.push({ ...subjectRoute(note.topicPath), query: { edit: note.id } }) }
function closeWorkspace() { void router.push(subjectRoute(topicPath.value)) }
async function deleteNote(note: LearningEntry) {
  if (deleting.value || !window.confirm(`确定删除笔记“${note.title}”？正文和阅读进度将被删除。`)) return
  deleting.value = note.id; error.value = ''; message.value = ''
  try { await apiRequest(`/api/resources/${encodeURIComponent(note.id)}`, { method: 'DELETE' }); await loadCatalog(); message.value = '笔记已删除。'; if (note.id === noteId.value || note.id === editId.value) closeWorkspace() }
  catch (reason) { error.value = reason instanceof Error ? reason.message : '笔记删除失败' }
  finally { deleting.value = '' }
}
function onSaved(data: { id: string; subjectSlug: string; nodePath: string[] }) { void router.replace({ name: 'subject', params: { subjectSlug: data.subjectSlug, topicPath: data.nodePath }, query: { note: data.id } }) }
function createNote() {
  if (!subject.value || !selectedNode.value) return
  void router.push({ name: 'subject', params: { subjectSlug: subject.value.slug, topicPath: topicPath.value }, query: { new: '1' } })
}
</script>

<template>
  <div v-if="subject" class="subject-view">
    <nav class="breadcrumb" aria-label="面包屑"><template v-for="(item, index) in breadcrumbs" :key="`${index}-${item.title}`"><span v-if="index" aria-hidden="true">/</span><RouterLink v-if="item.to" :to="item.to">{{ item.title }}</RouterLink><span v-else aria-current="page">{{ item.title }}</span></template></nav>
    <p v-if="message" class="form-success" role="status">{{ message }}</p><p v-if="error" class="form-error form-banner" role="alert">{{ error }}</p>

    <section v-if="workspaceOpen" class="note-workspace">
      <NoteReader v-if="noteId && !editId" :entry-id="noteId" @edit="(id) => editNote(entries.find((entry) => entry.id === id)!)" />
      <NoteEditor v-else :note-id="editId || undefined" :subject-slug="subject.slug" :node-path="topicPath" @saved="onSaved" @cancel="closeWorkspace" />
    </section>

    <KernelBrowser v-else-if="kernelBrowser" :subject-slug="subject.slug" :topic-path="topicPath" :version-path="kernelBrowser.versionPath" :initial-directory="legacyKernelDirectory" />

    <template v-else>
      <section v-if="childNodes.length" class="topic-section"><div class="section-heading compact-heading"><div><span class="eyebrow">CONTENTS</span><h2>{{ selectedNode ? '继续细分' : '目录' }}</h2></div><span class="section-aside">{{ childNodes.length }} 个子目录</span></div><div class="topic-grid"><RouterLink v-for="node in childNodes" :key="node.slug" :to="{ name: 'subject', params: { subjectSlug: subject.slug, topicPath: [...topicPath, node.slug] } }" class="topic-card"><span class="topic-card-mark">{{ node.children?.length ? '目录' : '主题' }}</span><h3>{{ node.title }}</h3><p>{{ node.description ?? '整理此主题下的电子书、学习笔记与相关资料。' }}</p><span class="topic-card-link">打开目录 <span>→</span></span></RouterLink></div></section>
      <section class="topic-section entries-section"><div class="section-heading compact-heading"><div><span class="eyebrow">NOTES</span><h2>{{ selectedNode ? '此子菜单的笔记' : '全部笔记' }}</h2></div><div class="section-heading-actions"><span class="section-aside">{{ notes.length }} 篇</span><button v-if="selectedNode" type="button" class="text-button" @click="createNote">新建笔记 <span>＋</span></button></div></div><div v-if="notes.length" class="subject-note-list"><article v-for="note in notes" :key="note.id" class="subject-note-row"><button type="button" class="subject-note-main" @click="openNote(note)"><span class="entry-type type-note">笔记</span><strong>{{ note.title }}</strong><small>{{ note.summary || '暂无摘要' }}</small><time :datetime="note.updatedAt">更新于 {{ note.updatedAt }}</time></button><div v-if="note.canEdit" class="subject-note-actions"><button type="button" class="text-button" @click="editNote(note)">编辑</button><button type="button" class="delete-button" :disabled="deleting === note.id" @click="deleteNote(note)">{{ deleting === note.id ? '删除中…' : '删除' }}</button></div><span v-else class="subject-note-permission" title="只有笔记作者或管理员可以编辑和删除">只读</span></article></div><div v-else class="empty-state"><span class="empty-state-icon">✳</span><div><h3>{{ selectedNode ? '这个子菜单还没有笔记' : '请从左侧选择子菜单' }}</h3><p>{{ selectedNode ? '点击左侧菜单后的“＋”或这里的“新建笔记”，开始记录。' : '所有笔记都必须归属于一个子菜单。' }}</p></div></div></section>
      <TopicFileLibrary v-if="selectedNode" :subject-slug="subject.slug" :node="selectedNode" />
    </template>
    <div v-if="!kernelBrowser" class="content-tip"><span>✦</span> 笔记支持 Markdown、LaTeX 数学公式与代码高亮。</div>
  </div>
  <div v-else class="not-found-inline"><span class="eyebrow">NOT FOUND</span><h1>没有找到这个学习主题</h1><RouterLink to="/" class="text-link">返回首页 →</RouterLink></div>
</template>
