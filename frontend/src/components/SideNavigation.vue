<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import NavigationTree from './NavigationTree.vue'
import type { CatalogNode, Subject } from '../data/catalog'
import { loadCatalog } from '../data/catalog'
import { apiRequest } from '../lib/api'

const props = defineProps<{ subject: Subject; activePath?: string[]; readOnly?: boolean; account?: string }>()
const route = useRoute()
const router = useRouter()
const menuOpen = ref(false)
const collapsedPaths = ref(new Set<string>())
const title = ref('')
const slug = ref('')
const description = ref('')
const parentPath = ref<string[]>([])
const actionNode = ref<CatalogNode>()
const busy = ref(false)
const error = ref('')
const actionLabel = computed(() => actionNode.value ? `在“${actionNode.value.title}”下添加` : '添加学科子菜单')

function makeSlug(value: string, fallback: string) {
  return value.trim() || fallback.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `menu-${Date.now().toString(36)}`
}
function openMenu(node?: CatalogNode, path?: string[]) {
  if (props.readOnly) return
  actionNode.value = node; parentPath.value = path ?? []; title.value = ''; slug.value = ''; description.value = ''; error.value = ''; menuOpen.value = true
}
function closeMenu() { if (!busy.value) menuOpen.value = false }
function toggleSubmenu(path: string[]) {
  const key = path.join('/')
  const next = new Set(collapsedPaths.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  collapsedPaths.value = next
}
async function createSubmenu() {
  if (props.readOnly) return
  if (!title.value.trim()) { error.value = '请输入子菜单名称'; return }
  busy.value = true; error.value = ''
  try {
    await apiRequest('/api/admin/nodes', { method: 'POST', body: JSON.stringify({ subjectSlug: props.subject.slug, title: title.value.trim(), slug: makeSlug(slug.value, title.value), description: description.value.trim(), parentPath: parentPath.value }) })
    await loadCatalog(); menuOpen.value = false
  } catch (reason) { error.value = reason instanceof Error ? reason.message : '子菜单创建失败' }
  finally { busy.value = false }
}
async function createNote() {
  if (props.readOnly) return
  menuOpen.value = false
  await router.push({ name: 'subject', params: { subjectSlug: props.subject.slug, topicPath: parentPath.value }, query: { new: '1' } })
}
async function removeNode(node: CatalogNode, path: string[]) {
  if (props.readOnly) return
  if (!window.confirm(`确定删除“${node.title}”及其下级菜单？菜单中的笔记必须先移动或删除。`)) return
  busy.value = true; error.value = ''
  try {
    await apiRequest(`/api/admin/nodes/${encodeURIComponent(node.id)}`, { method: 'DELETE' }); await loadCatalog()
    const current = Array.isArray(route.params.topicPath) ? route.params.topicPath : typeof route.params.topicPath === 'string' ? route.params.topicPath.split('/') : []
    if (current.length >= path.length && path.every((part, index) => current[index] === part)) await router.push({ name: 'subject', params: { subjectSlug: props.subject.slug, topicPath: path.slice(0, -1) } })
  } catch (reason) { error.value = reason instanceof Error ? reason.message : '菜单删除失败' }
  finally { busy.value = false }
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-heading"><h2>{{ subject.title }}</h2><p>{{ subject.description }}</p></div>
    <nav :aria-label="`${subject.title}目录`">
      <div v-if="!readOnly" class="sidebar-root-action"><button type="button" class="sidebar-add-button" @click="openMenu()">添加子菜单 <span>＋</span></button></div>
      <NavigationTree :nodes="subject.nodes" :subject-slug="subject.slug" :active-path="activePath" :read-only="readOnly" :account="account" :collapsed-paths="collapsedPaths" @add="openMenu" @remove="removeNode" @toggle="toggleSubmenu" />
    </nav>
    <p v-if="error" class="sidebar-error" role="alert">{{ error }}</p>
    <div v-if="menuOpen && !readOnly" class="sidebar-action-panel">
      <div class="sidebar-action-heading"><strong>{{ actionLabel }}</strong><button type="button" class="text-button" :disabled="busy" @click="closeMenu">关闭</button></div>
      <div v-if="actionNode" class="sidebar-action-choice"><button type="button" class="text-button is-active">子菜单</button><button type="button" class="text-button" @click="createNote">笔记</button></div>
      <form class="sidebar-form" @submit.prevent="createSubmenu">
        <label>名称<input v-model="title" maxlength="100" required placeholder="例如：线性代数" /></label>
        <label>标识（选填）<input v-model="slug" pattern="[a-z0-9-]+" maxlength="100" placeholder="留空自动生成" /></label>
        <label>说明（选填）<textarea v-model="description" maxlength="500" rows="2"></textarea></label>
        <button type="submit" class="button-primary" :disabled="busy">{{ busy ? '创建中…' : '创建子菜单' }} <span>＋</span></button>
      </form>
    </div>
    <div v-if="!readOnly" class="sidebar-footnote"><span class="small-dot"></span><RouterLink to="/admin">学科管理 →</RouterLink></div>
  </aside>
</template>
