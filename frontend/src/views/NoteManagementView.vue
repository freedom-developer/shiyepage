<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, RouterLink, useRoute, useRouter } from 'vue-router'
import { entries, flattenNodes, getEntry, getSubject, loadCatalog, personalSubjects, type LearningEntry } from '../data/catalog'
import { apiRequest, authState } from '../lib/api'
import { renderMarkdown } from '../lib/markdown'
import MarkdownEditor from '../components/MarkdownEditor.vue'

interface NoteResource {
  id: string
  kind: string
  title: string
  summary: string
  content: string | null
  isPrivate: boolean
}

const route = useRoute()
const router = useRouter()
const keyword = ref('')
const subjectFilter = ref('')
const visibilityFilter = ref('')
const message = ref('')
const error = ref('')
const loading = ref(false)
const saving = ref(false)
const deletingId = ref('')
const editorReady = ref(false)
const title = ref('')
const summary = ref('')
const content = ref('')
const subjectSlug = ref('')
const nodePath = ref('')
const isPrivate = ref(true)
const initialDraft = ref('')
const preview = ref('')
const previewing = ref(false)
const renderingPreview = ref(false)
let loadVersion = 0
let previewVersion = 0

const isAdmin = computed(() => authState.user?.role === 'ADMIN')
const editId = computed(() => typeof route.query.edit === 'string' ? route.query.edit : '')
const creating = computed(() => route.query.new === '1')
const editorOpen = computed(() => creating.value || Boolean(editId.value))
const managedNotes = computed(() => entries.filter((entry) => entry.kind === 'note' && entry.canEdit))
const filteredNotes = computed(() => {
  const query = keyword.value.trim().toLocaleLowerCase()
  return managedNotes.value.filter((note) =>
    (!query || `${note.title}\n${note.summary}`.toLocaleLowerCase().includes(query))
    && (!subjectFilter.value || note.subjectSlug === subjectFilter.value)
    && (!visibilityFilter.value || (note.isPrivate ? 'private' : 'public') === visibilityFilter.value),
  )
})
const currentSubject = computed(() => getSubject(subjectSlug.value))
const nodeOptions = computed(() => currentSubject.value ? flattenNodes(currentSubject.value.nodes) : [])
const busy = computed(() => saving.value || loading.value || Boolean(deletingId.value))
const draft = computed(() => JSON.stringify({
  title: title.value,
  summary: summary.value,
  content: content.value,
  subjectSlug: subjectSlug.value,
  nodePath: nodePath.value.split('/').filter(Boolean),
  isPrivate: isPrivate.value,
}))
const dirty = computed(() => editorReady.value && editorOpen.value && draft.value !== initialDraft.value)

// Sync watchers clear a previous node before an existing note's new node is assigned.
watch(subjectSlug, () => { nodePath.value = '' }, { flush: 'sync' })
watch(nodeOptions, (options) => {
  if (!options.some((option) => option.path.join('/') === nodePath.value)) nodePath.value = ''
})

watch(() => [editId.value, creating.value] as const, async ([id, isNew]) => {
  const version = ++loadVersion
  previewVersion++
  editorReady.value = false
  loading.value = false
  previewing.value = false
  preview.value = ''
  error.value = ''
  if (!id && !isNew) return
  title.value = ''
  summary.value = ''
  content.value = '# 新学习笔记\n\n在这里开始记录。'
  subjectSlug.value = personalSubjects.value[0]?.slug ?? ''
  nodePath.value = ''
  isPrivate.value = true
  if (id && !isNew) {
    loading.value = true
    try {
      const result = await apiRequest<{ resource: NoteResource; canEdit: boolean }>(`/api/resources/${encodeURIComponent(id)}`)
      if (version !== loadVersion) return
      if (result.resource.kind !== 'note' || !result.canEdit) throw new Error('没有管理这篇笔记的权限')
      const entry = getEntry(id)
      if (!entry) throw new Error('笔记目录已变更，请刷新页面后重试')
      title.value = result.resource.title
      summary.value = result.resource.summary
      content.value = result.resource.content ?? ''
      subjectSlug.value = entry.subjectSlug
      nodePath.value = entry.topicPath.join('/')
      isPrivate.value = result.resource.isPrivate
    } catch (reason) {
      if (version === loadVersion) error.value = reason instanceof Error ? reason.message : '笔记加载失败'
      return
    } finally {
      if (version === loadVersion) loading.value = false
    }
  }
  initialDraft.value = draft.value
  editorReady.value = true
}, { immediate: true })

function allowNavigation() {
  return !dirty.value || saving.value || window.confirm('笔记尚未保存，确定放弃修改？')
}
onBeforeRouteLeave(allowNavigation)
onBeforeRouteUpdate(allowNavigation)
function beforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value) return
  event.preventDefault()
  event.returnValue = ''
}
window.addEventListener('beforeunload', beforeUnload)
onBeforeUnmount(() => {
  loadVersion++
  previewVersion++
  window.removeEventListener('beforeunload', beforeUnload)
})

async function openEditor(id?: string) {
  if (busy.value) return
  await router.push({ name: 'note-management', query: id ? { edit: id } : { new: '1' } })
}

async function closeEditor() {
  await router.push({ name: 'note-management' })
}

async function saveNote() {
  if (busy.value || !editorReady.value) return
  if (!nodePath.value) {
    error.value = '笔记必须归属于一个子菜单，请先选择子菜单。'
    return
  }
  saving.value = true
  error.value = ''
  message.value = ''
  const wasCreating = creating.value
  try {
    await apiRequest(wasCreating ? '/api/resources/note' : `/api/resources/${encodeURIComponent(editId.value)}`, {
      method: wasCreating ? 'POST' : 'PATCH',
      body: draft.value,
    })
    initialDraft.value = draft.value
    message.value = wasCreating ? '笔记已创建。' : '笔记修改已保存。'
    // A successful save closes the editor even if refreshing the catalog fails.
    await loadCatalog().catch(() => {})
    await router.replace({ name: 'note-management' })
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '笔记保存失败'
  } finally {
    saving.value = false
  }
}

async function deleteNote(note: LearningEntry) {
  if (busy.value) return
  if (!window.confirm(`确定永久删除笔记“${note.title}”？正文和相关阅读进度将被删除，无法撤销。`)) return
  deletingId.value = note.id
  error.value = ''
  message.value = ''
  try {
    await apiRequest(`/api/resources/${encodeURIComponent(note.id)}`, { method: 'DELETE' })
    const index = entries.findIndex((entry) => entry.id === note.id)
    if (index >= 0) entries.splice(index, 1)
    message.value = '笔记已删除。'
    await loadCatalog().catch(() => {})
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '笔记删除失败'
  } finally {
    deletingId.value = ''
  }
}

async function showPreview() {
  previewing.value = true
  renderingPreview.value = true
  const version = ++previewVersion
  try {
    const rendered = await renderMarkdown(content.value)
    if (version === previewVersion) preview.value = rendered
  } catch {
    if (version === previewVersion) error.value = '预览生成失败，请稍后重试'
  } finally {
    if (version === previewVersion) renderingPreview.value = false
  }
}

function locationLabel(note: LearningEntry) {
  const subject = getSubject(note.subjectSlug)
  const row = subject && flattenNodes(subject.nodes).find((row) => row.path.join('/') === note.topicPath.join('/'))
  return `${subject?.title ?? note.subjectSlug} / ${row?.node.title ?? '未分类'}`
}
</script>

<template>
  <section class="note-management">
    <div class="section-heading notes-heading">
      <div><span class="eyebrow">NOTES</span><h2>笔记管理</h2><p class="form-help">{{ isAdmin ? '管理站点中的全部笔记。' : '管理自己的学习笔记。' }}支持 Markdown、数学公式与代码块。</p></div>
      <button class="button-primary" type="button" :disabled="busy || !personalSubjects.length" @click="openEditor()">新建笔记 <span>＋</span></button>
    </div>
    <p v-if="message" class="form-success" role="status">{{ message }}</p>
    <p v-if="error" class="form-error form-banner" role="alert">{{ error }}</p>
    <div v-if="!personalSubjects.length" class="empty-state"><span class="empty-state-icon">✳</span><div><h3>先创建一个学科</h3><p>前往 <RouterLink to="/admin" class="auth-inline-link">学科管理</RouterLink>添加学科，再进入子菜单记录笔记。</p></div></div>

    <section v-if="editorOpen" class="note-editor-section" aria-label="笔记编辑器">
      <div class="section-heading compact-heading"><h2>{{ creating ? '新建笔记' : '编辑笔记' }}</h2><button type="button" class="text-button" :disabled="saving" @click="closeEditor">关闭编辑器</button></div>
      <p v-if="loading" class="loading-state" role="status">正在加载笔记…</p>
      <form v-else-if="editorReady" class="admin-form" @submit.prevent="saveNote">
        <fieldset class="note-fields" :disabled="saving">
          <label>标题<input v-model="title" maxlength="200" placeholder="例如：傅里叶变换学习笔记" required /></label>
          <label>摘要<textarea v-model="summary" maxlength="2000" rows="2" placeholder="简短说明这篇笔记的内容"></textarea></label>
          <div class="form-row">
            <label>所属学科<select v-model="subjectSlug" required><option value="" disabled>请选择学科</option><option v-for="subject in personalSubjects" :key="subject.slug" :value="subject.slug">{{ subject.title }}</option></select></label>
            <label>所属子菜单<select v-model="nodePath" required><option value="" disabled>请选择子菜单</option><option v-for="option in nodeOptions" :key="option.node.id" :value="option.path.join('/')">{{ '　'.repeat(option.path.length - 1) }}{{ option.node.title }}</option></select></label>
          </div>
          <label class="check-label"><input v-model="isPrivate" type="checkbox" /> 私有笔记（仅作者和管理员可访问）</label>
          <p class="form-help">{{ isPrivate ? '取消勾选并保存后，将展示在作者的个人主页，任何人都可阅读。' : '这篇笔记将公开展示在作者的个人主页。' }}</p>
          <div class="note-editor-tabs"><button type="button" class="text-button" :class="{ 'is-active': !previewing }" @click="previewing = false">编辑正文</button><button type="button" class="text-button" :class="{ 'is-active': previewing }" @click="showPreview">预览</button><span v-if="dirty" class="form-help">有未保存修改</span></div>
          <MarkdownEditor v-show="!previewing" v-model="content" :disabled="saving" />
          <div v-if="previewing" class="note-preview"><p v-if="renderingPreview" class="loading-state">正在生成预览…</p><div v-else-if="preview" class="markdown-body" v-html="preview"></div><p v-else class="form-help">正文为空，返回编辑后再预览。</p></div>
          <div class="note-form-actions"><button class="button-primary" type="submit" :disabled="!personalSubjects.length">{{ saving ? '保存中…' : '保存笔记' }} <span>↗</span></button><button type="button" class="text-button" @click="closeEditor">取消</button></div>
        </fieldset>
      </form>
    </section>

    <template v-if="!editorOpen">
      <div class="note-filters admin-form">
        <label>搜索笔记<input v-model="keyword" type="search" placeholder="搜索标题或摘要" /></label>
        <label>所属学科<select v-model="subjectFilter"><option value="">全部学科</option><option v-for="subject in personalSubjects" :key="subject.slug" :value="subject.slug">{{ subject.title }}</option></select></label>
        <label>可见范围<select v-model="visibilityFilter"><option value="">全部</option><option value="private">私有</option><option value="public">公开</option></select></label>
      </div>
      <p class="form-help" role="status">显示 {{ filteredNotes.length }} / {{ managedNotes.length }} 篇笔记</p>
      <div v-if="filteredNotes.length" class="managed-note-list">
        <article v-for="note in filteredNotes" :key="note.id" class="managed-note-row">
          <div class="managed-note-info">
            <RouterLink :to="{ name: 'note', params: { entryId: note.id } }" class="managed-note-title">{{ note.title }}</RouterLink>
            <p v-if="note.summary">{{ note.summary }}</p>
            <div class="managed-note-meta"><span>{{ locationLabel(note) }}</span><span :class="{ 'private-badge': note.isPrivate }">{{ note.isPrivate ? '私有' : '公开' }}</span><time :datetime="note.updatedAt">更新于 {{ note.updatedAt }}</time></div>
          </div>
          <div class="managed-note-actions"><RouterLink :to="{ name: 'note', params: { entryId: note.id } }" class="text-button">阅读</RouterLink><button type="button" class="text-button" :disabled="busy" @click="openEditor(note.id)">编辑</button><button type="button" class="delete-button" :disabled="busy" :aria-label="`删除笔记：${note.title}`" @click="deleteNote(note)">{{ deletingId === note.id ? '删除中…' : '删除' }}</button></div>
        </article>
      </div>
      <div v-else-if="personalSubjects.length" class="empty-state"><span class="empty-state-icon">✳</span><div><h3>{{ managedNotes.length ? '没有匹配的笔记' : '还没有可管理的笔记' }}</h3><p>{{ managedNotes.length ? '试试调整关键词或筛选条件。' : '点击“新建笔记”，记录第一篇学习笔记。' }}</p></div></div>
    </template>
  </section>
</template>
