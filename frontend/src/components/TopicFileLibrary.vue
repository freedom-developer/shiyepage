<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { entriesForNode, loadCatalog, type CatalogNode, type LearningEntry, getSubject } from '../data/catalog'
import { apiRequest, uploadFile } from '../lib/api'

const props = defineProps<{ subjectSlug: string; node: CatalogNode }>()
const fileInput = ref<HTMLInputElement>()
const file = ref<File>()
const title = ref('')
const summary = ref('')
const isPrivate = ref(true)
const formOpen = ref(false)
const busy = ref(false)
const visibilityId = ref('')
const deletingId = ref('')
const editingId = ref('')
const savingTitleId = ref('')
const editedTitle = ref('')
const error = ref('')
const message = ref('')
const subject = computed(() => getSubject(props.subjectSlug))
const files = computed(() => subject.value
  ? entriesForNode(subject.value, props.node).filter((entry) => entry.kind === 'pdf' || entry.kind === 'chm')
  : [])

function chooseFile(event: Event) {
  file.value = (event.target as HTMLInputElement).files?.[0]
  if (file.value && !title.value) title.value = file.value.name.replace(/\.(pdf|chm)$/i, '')
}

async function submit() {
  error.value = ''
  message.value = ''
  if (!file.value) { error.value = '请选择 PDF 或 CHM 文件'; return }
  busy.value = true
  try {
    const form = new FormData()
    form.append('file', file.value)
    form.append('title', title.value)
    form.append('summary', summary.value)
    form.append('subjectSlug', props.subjectSlug)
    form.append('nodePath', JSON.stringify(findNodePath(subject.value?.nodes ?? [], props.node.id) ?? []))
    form.append('isPrivate', String(isPrivate.value))
    await uploadFile(form)
    await loadCatalog()
    file.value = undefined
    title.value = ''
    summary.value = ''
    if (fileInput.value) fileInput.value.value = ''
    formOpen.value = false
    message.value = '文件已上传到当前子菜单。'
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '文件上传失败'
  } finally { busy.value = false }
}

function findNodePath(nodes: CatalogNode[], targetId: string, parent: string[] = []): string[] | undefined {
  for (const node of nodes) {
    const path = [...parent, node.slug]
    if (node.id === targetId) return path
    const childPath = findNodePath(node.children ?? [], targetId, path)
    if (childPath) return childPath
  }
  return undefined
}

function readerRoute(entry: LearningEntry) {
  return entry.kind === 'chm'
    ? { name: 'chm', params: { entryId: entry.id } }
    : { name: 'pdf', params: { entryId: entry.id } }
}

function beginRename(entry: LearningEntry) {
  editingId.value = entry.id
  editedTitle.value = entry.title
  error.value = ''
}

async function toggleVisibility(entry: LearningEntry) {
  if (!entry.canEdit || visibilityId.value) return
  visibilityId.value = entry.id
  error.value = ''
  try {
    await apiRequest(`/api/resources/${encodeURIComponent(entry.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ isPrivate: !entry.isPrivate }),
    })
    await loadCatalog()
    message.value = entry.isPrivate
      ? '文件已公开，可在个人主页中查看。'
      : '文件已设为私有，不再显示在公开主页。'
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '文件可见范围更新失败'
  } finally { visibilityId.value = '' }
}

async function renameFile(entry: LearningEntry) {
  const nextTitle = editedTitle.value.trim()
  if (!nextTitle) { error.value = '标题不能为空'; return }
  savingTitleId.value = entry.id
  error.value = ''
  try {
    await apiRequest(`/api/resources/${encodeURIComponent(entry.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: nextTitle }),
    })
    await loadCatalog()
    editingId.value = ''
    message.value = '文件标题已更新。'
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '标题更新失败'
  } finally { savingTitleId.value = '' }
}

async function deleteFile(entry: LearningEntry) {
  if (deletingId.value || !window.confirm(`确定删除“${entry.title}”吗？上传的文件也会一并删除。`)) return
  deletingId.value = entry.id
  error.value = ''
  try {
    await apiRequest(`/api/resources/${encodeURIComponent(entry.id)}`, { method: 'DELETE' })
    await loadCatalog()
    message.value = '文件已删除。'
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '文件删除失败'
  } finally { deletingId.value = '' }
}
</script>

<template>
  <section class="topic-file-library">
    <div class="section-heading compact-heading">
      <div><span class="eyebrow">FILES</span><h2>资料文件</h2></div>
      <div class="section-heading-actions"><span class="section-aside">{{ files.length }} 项</span><button type="button" class="text-button" @click="formOpen = !formOpen">{{ formOpen ? '取消' : '上传文件' }} <span>{{ formOpen ? '×' : '＋' }}</span></button></div>
    </div>
    <p v-if="message" class="form-success" role="status">{{ message }}</p>
    <p v-if="error && !formOpen" class="form-error form-banner" role="alert">{{ error }}</p>
    <form v-if="formOpen" class="admin-form topic-file-upload" @submit.prevent="submit">
      <label>PDF 或 CHM 文件<input ref="fileInput" type="file" accept="application/pdf,.pdf,.chm" required @change="chooseFile" /></label>
      <label>标题<input v-model="title" maxlength="200" required placeholder="默认使用文件名" /></label>
      <label>说明<textarea v-model="summary" rows="2" maxlength="2000" placeholder="可选"></textarea></label>
      <label class="check-label"><input v-model="isPrivate" type="checkbox" /> 私有文件</label>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <button class="button-primary" type="submit" :disabled="busy">{{ busy ? '上传中…' : '上传到当前子菜单' }} <span>↗</span></button>
    </form>
    <div v-if="files.length" class="resource-grid topic-file-grid">
      <article v-for="entry in files" :key="entry.id" class="resource-card topic-resource-card">
        <div class="resource-card-top"><span class="entry-type" :class="entry.kind === 'pdf' ? 'type-pdf' : 'type-chm'">{{ entry.kind.toUpperCase() }}</span><span :class="entry.isPrivate ? 'private-badge' : 'file-public-badge'">{{ entry.isPrivate ? '私有' : '公开' }}</span><time :datetime="entry.updatedAt">{{ entry.updatedAt }}</time></div>
        <RouterLink :to="readerRoute(entry)" target="_blank" rel="noopener noreferrer" class="topic-resource-body"><h3>{{ entry.title }}</h3><p>{{ entry.summary || '暂无说明' }}</p></RouterLink>
        <form v-if="editingId === entry.id" class="resource-title-edit" @submit.prevent="renameFile(entry)">
          <input v-model="editedTitle" aria-label="文件标题" maxlength="200" required />
          <button type="submit" class="text-button" :disabled="savingTitleId === entry.id">{{ savingTitleId === entry.id ? '保存中…' : '保存' }}</button>
          <button type="button" class="text-button" :disabled="savingTitleId === entry.id" @click="editingId = ''">取消</button>
        </form>
        <div class="topic-resource-actions">
          <RouterLink :to="readerRoute(entry)" target="_blank" rel="noopener noreferrer" class="resource-open">打开阅读 <span>↗</span></RouterLink>
          <div v-if="entry.canEdit" class="file-management-actions">
            <button type="button" class="text-button" :disabled="Boolean(visibilityId)" @click="toggleVisibility(entry)">{{ visibilityId === entry.id ? '更新中…' : entry.isPrivate ? '公开展示' : '设为私有' }}</button>
            <button type="button" class="text-button" @click="beginRename(entry)">重命名</button>
            <button type="button" class="delete-button" :disabled="Boolean(deletingId)" @click="deleteFile(entry)">{{ deletingId === entry.id ? '删除中…' : '删除' }}</button>
          </div>
        </div>
      </article>
    </div>
    <p v-else-if="!formOpen" class="form-help">当前子菜单还没有 PDF 或 CHM 文件。</p>
  </section>
</template>
