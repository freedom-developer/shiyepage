<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { apiRequest } from '../lib/api'
import { flattenNodes, getEntry, getSubject, loadCatalog, personalSubjects } from '../data/catalog'
import { renderMarkdown } from '../lib/markdown'
import MarkdownEditor from './MarkdownEditor.vue'

const props = defineProps<{ noteId?: string; subjectSlug?: string; nodePath?: string[] }>()
const emit = defineEmits<{ saved: [data: { id: string; subjectSlug: string; nodePath: string[] }]; cancel: [] }>()
const title = ref('')
const summary = ref('')
const content = ref('# 新学习笔记\n\n在这里开始记录。')
const subjectSlug = ref(props.subjectSlug ?? personalSubjects.value[0]?.slug ?? '')
const nodePath = ref((props.nodePath ?? []).join('/'))
const isPrivate = ref(true)
const ready = ref(false)
const loading = ref(false)
const saving = ref(false)
const previewing = ref(false)
const preview = ref('')
const error = ref('')
const version = ref(0)
const previewVersion = ref(0)
const initialDraft = ref('')
const currentSubject = computed(() => getSubject(subjectSlug.value))
const nodeOptions = computed(() => currentSubject.value ? flattenNodes(currentSubject.value.nodes) : [])
const draft = computed(() => JSON.stringify({ title: title.value, summary: summary.value, content: content.value, subjectSlug: subjectSlug.value, nodePath: nodePath.value.split('/').filter(Boolean), isPrivate: isPrivate.value }))
const dirty = computed(() => ready.value && draft.value !== initialDraft.value)

watch(subjectSlug, () => { if (!props.noteId) nodePath.value = '' })
watch(() => props.subjectSlug, (value) => { if (value && !props.noteId) subjectSlug.value = value })
watch(() => props.nodePath, (value) => { if (value && !props.noteId) nodePath.value = value.join('/') })
watch(nodeOptions, (options) => { if (!options.some((option) => option.path.join('/') === nodePath.value)) nodePath.value = '' })

watch(() => [props.noteId, props.subjectSlug, props.nodePath?.join('/')], async ([id]) => {
  const current = ++version.value
  ready.value = false; loading.value = Boolean(id); error.value = ''; preview.value = ''; previewing.value = false
  title.value = ''; summary.value = ''; content.value = '# 新学习笔记\n\n在这里开始记录。'; subjectSlug.value = props.subjectSlug ?? personalSubjects.value[0]?.slug ?? ''; nodePath.value = (props.nodePath ?? []).join('/'); isPrivate.value = true
  if (id) {
    try {
      const result = await apiRequest<{ resource: { kind: string; title: string; summary: string; content: string | null; isPrivate: boolean }; canEdit: boolean }>(`/api/resources/${encodeURIComponent(id)}`)
      if (current !== version.value) return
      if (result.resource.kind !== 'NOTE' && result.resource.kind !== 'note') throw new Error('这不是一篇笔记')
      if (!result.canEdit) throw new Error('没有编辑这篇笔记的权限')
      const entry = getEntry(id)
      if (!entry) throw new Error('笔记目录已变更，请刷新后重试')
      title.value = result.resource.title; summary.value = result.resource.summary; content.value = result.resource.content ?? ''; subjectSlug.value = entry.subjectSlug; nodePath.value = entry.topicPath.join('/'); isPrivate.value = result.resource.isPrivate
    } catch (reason) { if (current === version.value) error.value = reason instanceof Error ? reason.message : '笔记加载失败' }
    finally { if (current === version.value) loading.value = false }
  }
  initialDraft.value = draft.value; ready.value = true
}, { immediate: true })

function allowNavigation() { return !dirty.value || saving.value || window.confirm('笔记尚未保存，确定放弃修改？') }
onBeforeRouteLeave(allowNavigation)
function beforeUnload(event: BeforeUnloadEvent) { if (dirty.value) { event.preventDefault(); event.returnValue = '' } }
window.addEventListener('beforeunload', beforeUnload)
onBeforeUnmount(() => { version.value++; previewVersion.value++; window.removeEventListener('beforeunload', beforeUnload) })

async function save() {
  if (!ready.value || saving.value) return
  const path = nodePath.value.split('/').filter(Boolean)
  if (!path.length) { error.value = '笔记必须归属于一个子菜单，请先在左侧选择菜单'; return }
  saving.value = true; error.value = ''
  try {
    const id = props.noteId
    const result = await apiRequest<{ resource: { id: string } }>(id ? `/api/resources/${encodeURIComponent(id)}` : '/api/resources/note', { method: id ? 'PATCH' : 'POST', body: draft.value })
    await loadCatalog().catch(() => {})
    initialDraft.value = draft.value
    emit('saved', { id: result.resource.id, subjectSlug: subjectSlug.value, nodePath: path })
  } catch (reason) { error.value = reason instanceof Error ? reason.message : '笔记保存失败' }
  finally { saving.value = false }
}
async function previewNote() {
  previewing.value = true; const current = ++previewVersion.value
  try { const rendered = await renderMarkdown(content.value); if (current === previewVersion.value) preview.value = rendered }
  catch { if (current === previewVersion.value) error.value = '预览生成失败' }
}
</script>

<template>
  <section class="note-editor-section" aria-label="笔记编辑器">
    <div class="section-heading compact-heading"><div><span class="eyebrow">NOTE WORKSPACE</span><h2>{{ noteId ? '编辑笔记' : '新建笔记' }}</h2></div><button type="button" class="text-button" :disabled="saving" @click="emit('cancel')">关闭</button></div>
    <p v-if="loading" class="loading-state">正在加载笔记…</p>
    <p v-else-if="error && !ready" class="form-error form-banner">{{ error }}</p>
    <form v-else-if="ready" class="admin-form" @submit.prevent="save">
      <fieldset class="note-fields" :disabled="saving">
        <label>标题<input v-model="title" maxlength="200" required /></label>
        <label>摘要<textarea v-model="summary" maxlength="2000" rows="2"></textarea></label>
        <div class="form-row"><label>所属学科<select v-model="subjectSlug" required><option v-for="subject in personalSubjects" :key="subject.slug" :value="subject.slug">{{ subject.title }}</option></select></label><label>所属子菜单<select v-model="nodePath" required><option value="" disabled>请选择子菜单</option><option v-for="option in nodeOptions" :key="option.node.id" :value="option.path.join('/')">{{ '　'.repeat(option.path.length - 1) }}{{ option.node.title }}</option></select></label></div>
        <p v-if="!nodeOptions.length" class="form-help">当前学科还没有子菜单，请先在左侧添加一个。</p>
        <label class="check-label"><input v-model="isPrivate" type="checkbox" /> 私有笔记（仅作者和管理员可访问）</label><p class="form-help">{{ isPrivate ? '取消勾选并保存后，将展示在作者的个人主页，任何人都可阅读。' : '这篇笔记将公开展示在作者的个人主页。' }}</p>
        <div class="note-editor-tabs"><button type="button" class="text-button" :class="{ 'is-active': !previewing }" @click="previewing = false">编辑正文</button><button type="button" class="text-button" :class="{ 'is-active': previewing }" @click="previewNote">预览</button><span v-if="dirty" class="form-help">有未保存修改</span></div>
        <MarkdownEditor v-show="!previewing" v-model="content" :disabled="saving" />
        <div v-if="previewing" class="note-preview"><div v-if="preview" class="markdown-body" v-html="preview"></div><p v-else class="form-help">正在生成预览…</p></div>
        <p v-if="error" class="form-error">{{ error }}</p>
        <div class="note-form-actions"><button class="button-primary" type="submit" :disabled="saving || !nodeOptions.length || !nodePath">{{ saving ? '保存中…' : '保存笔记' }} <span>↗</span></button><button type="button" class="text-button" @click="emit('cancel')">取消</button></div>
      </fieldset>
    </form>
  </section>
</template>
