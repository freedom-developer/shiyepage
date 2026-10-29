<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { loadCatalog, personalSubjects, entries, flattenNodes, type LearningEntry } from '../data/catalog'
import { apiRequest, uploadPdf } from '../lib/api'

const activeSubject = ref(personalSubjects.value[0]?.slug ?? '')
const nodePath = ref('')
const message = ref('')
const error = ref('')
const busy = ref(false)
const updatingId = ref('')
const pdfFile = ref<File>()
const fileInput = ref<HTMLInputElement>()
const pdfTitle = ref('')
const pdfSummary = ref('')
const pdfPrivate = ref(true)
const currentSubject = computed(() => personalSubjects.value.find((subject) => subject.slug === activeSubject.value))
const nodeOptions = computed(() => currentSubject.value ? flattenNodes(currentSubject.value.nodes) : [])
const pdfEntries = computed(() => entries.filter((entry) => entry.kind === 'pdf' || entry.kind === 'chm'))

watch(() => personalSubjects.value.map((subject) => subject.slug), (slugs) => {
  if (!slugs.includes(activeSubject.value)) activeSubject.value = slugs[0] ?? ''
})
watch(activeSubject, () => { nodePath.value = '' })
watch(nodeOptions, (options) => {
  if (!options.some((option) => option.path.join('/') === nodePath.value)) nodePath.value = ''
})

function chooseFile(event: Event) {
  pdfFile.value = (event.target as HTMLInputElement).files?.[0]
  if (pdfFile.value && !pdfTitle.value) pdfTitle.value = pdfFile.value.name.replace(/\.(pdf|chm)$/i, '')
}

async function toggleVisibility(entry: LearningEntry) {
  if (!entry.canEdit || updatingId.value) return
  updatingId.value = entry.id
  error.value = ''; message.value = ''
  try {
    await apiRequest(`/api/resources/${encodeURIComponent(entry.id)}`, { method: 'PATCH', body: JSON.stringify({ isPrivate: !entry.isPrivate }) })
    await loadCatalog()
    message.value = entry.isPrivate ? '电子书已公开，可在作者的个人主页阅读。' : '电子书已设为私有，公开主页将不再展示。'
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '可见范围更新失败'
  } finally { updatingId.value = '' }
}

async function submitPdf() {
  error.value = ''
  message.value = ''
  if (!pdfFile.value) { error.value = '请选择 PDF 文件'; return }
  busy.value = true
  try {
    const form = new FormData()
    form.append('file', pdfFile.value)
    form.append('title', pdfTitle.value)
    form.append('summary', pdfSummary.value)
    form.append('subjectSlug', activeSubject.value)
    form.append('nodePath', JSON.stringify(nodePath.value.split('/').filter(Boolean)))
    form.append('isPrivate', String(pdfPrivate.value))
    await uploadPdf(form)
    await loadCatalog()
    message.value = '文件已上传；PDF 文本已加入搜索索引。'
    pdfFile.value = undefined
    if (fileInput.value) fileInput.value.value = ''
    pdfTitle.value = ''
    pdfSummary.value = ''
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '上传失败'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="pdf-management">
      <div class="section-heading compact-heading"><div><span class="eyebrow">FILE LIBRARY</span><h2>PDF / CHM 资料</h2></div></div>
    <p v-if="!personalSubjects.length" class="form-help">请先前往 <RouterLink to="/admin" class="auth-inline-link">学科管理</RouterLink>添加学科，再上传电子书。</p>
    <p v-if="message" class="form-success" role="status">{{ message }}</p>
    <p v-if="error" class="form-error form-banner" role="alert">{{ error }}</p>
    <form v-if="personalSubjects.length" class="admin-form pdf-upload-form" @submit.prevent="submitPdf">
      <div class="form-section-title"><span class="entry-type type-pdf">PDF / CHM</span><h2>上传资料文件</h2></div>
      <label>文件<input ref="fileInput" type="file" accept="application/pdf,.pdf,.chm" required @change="chooseFile" /></label>
      <label>标题<input v-model="pdfTitle" placeholder="默认使用文件名" required /></label>
      <label>摘要<textarea v-model="pdfSummary" rows="2" placeholder="这份资料讲什么？"></textarea></label>
      <div class="form-row"><label>学科<select v-model="activeSubject"><option v-for="subject in personalSubjects" :key="subject.slug" :value="subject.slug">{{ subject.title }}</option></select></label><label>子菜单<select v-model="nodePath"><option value="">学科根目录</option><option v-for="option in nodeOptions" :key="option.node.id" :value="option.path.join('/')">{{ '　'.repeat(option.path.length - 1) }}{{ option.node.title }}</option></select></label></div>
      <label class="check-label"><input v-model="pdfPrivate" type="checkbox" /> 私有文件（仅作者和管理员可访问）</label>
      <p class="form-help">取消勾选后，任何人都能在你的个人主页阅读这份电子书。</p>
      <button class="button-primary" type="submit" :disabled="busy">{{ busy ? '处理中…' : '上传并建立索引' }} <span>↗</span></button>
      <p class="form-help">支持 PDF 文本提取；扫描版 PDF 需要后续接入 OCR。</p>
    </form>
    <section class="admin-library">
      <div class="section-heading compact-heading"><h2>已上传的资料文件</h2><span class="section-aside">{{ pdfEntries.length }} 项</span></div>
      <div v-if="pdfEntries.length" class="managed-note-list">
        <article v-for="entry in pdfEntries" :key="entry.id" class="managed-note-row">
          <div class="managed-note-info"><RouterLink :to="entry.kind === 'chm' ? { name: 'chm', params: { entryId: entry.id } } : { name: 'pdf', params: { entryId: entry.id } }" target="_blank" rel="noopener noreferrer" class="managed-note-title">{{ entry.title }}</RouterLink><div class="managed-note-meta"><span class="entry-type" :class="entry.kind === 'chm' ? 'type-chm' : 'type-pdf'">{{ entry.kind.toUpperCase() }}</span><span :class="{ 'private-badge': entry.isPrivate }">{{ entry.isPrivate ? '私有' : '公开' }}</span><time :datetime="entry.updatedAt">{{ entry.updatedAt }}</time></div></div>
          <div class="managed-note-actions"><RouterLink :to="entry.kind === 'chm' ? { name: 'chm', params: { entryId: entry.id } } : { name: 'pdf', params: { entryId: entry.id } }" target="_blank" rel="noopener noreferrer" class="text-button">阅读</RouterLink><button v-if="entry.canEdit" type="button" class="text-button" :disabled="Boolean(updatingId)" @click="toggleVisibility(entry)">{{ updatingId === entry.id ? '更新中…' : entry.isPrivate ? '公开展示' : '设为私有' }}</button></div>
        </article>
      </div>
      <p v-else class="form-help">还没有资料文件，上传 PDF 或 CHM 后即可阅读。</p>
    </section>
  </section>
</template>
