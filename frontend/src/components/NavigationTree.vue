<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import type { CatalogNode, LearningEntry } from '../data/catalog'
import { publicEntryRoute, publicSubjectRoute } from '../data/public-profile'

defineOptions({ name: 'NavigationTree' })

const props = defineProps<{
  nodes: CatalogNode[]
  subjectSlug: string
  entries?: LearningEntry[]
  parentPath?: string[]
  activePath?: string[]
  readOnly?: boolean
  account?: string
  collapsedPaths?: Set<string>
}>()

const emit = defineEmits<{
  add: [node: CatalogNode, path: string[]]
  addNote: [node: CatalogNode, path: string[]]
  remove: [node: CatalogNode, path: string[]]
  move: [node: CatalogNode, path: string[]]
  toggle: [path: string[]]
}>()

const parent = computed(() => props.parentPath ?? [])
const route = useRoute()

function relayAdd(node: CatalogNode, path: string[]) { emit('add', node, path) }
function relayAddNote(node: CatalogNode, path: string[]) { emit('addNote', node, path) }
function relayRemove(node: CatalogNode, path: string[]) { emit('remove', node, path) }
function relayMove(node: CatalogNode, path: string[]) { emit('move', node, path) }

function routeFor(node: CatalogNode) {
  if (props.account) return publicSubjectRoute(props.account, props.subjectSlug, [...parent.value, node.slug])
  return {
    name: 'subject',
    params: {
      subjectSlug: props.subjectSlug,
      topicPath: [...parent.value, node.slug],
    },
  }
}

function isActive(node: CatalogNode) {
  const expected = [...parent.value, node.slug]
  return expected.length === props.activePath?.length &&
    expected.every((part, index) => part === props.activePath?.[index])
}

function isKernelSourceRoot(node: CatalogNode) {
  return node.slug === 'linux-6-8' && (props.subjectSlug === 'linux-kernel' || parent.value.some((part) => part === 'linux-kernel'))
}

function notesFor(node: CatalogNode) {
  if (isKernelSourceRoot(node) || [...parent.value, node.slug].includes('linux-6-8')) return []
  const path = [...parent.value, node.slug]
  return (props.entries ?? []).filter((entry) => entry.kind === 'note' &&
    entry.subjectSlug === props.subjectSlug && entry.topicPath.length === path.length &&
    path.every((part, index) => entry.topicPath[index] === part))
}

function hasVisibleChildren(node: CatalogNode) {
  return Boolean((node.children?.length && !isKernelSourceRoot(node)) || notesFor(node).length)
}

function isExpanded(node: CatalogNode) {
  return !props.collapsedPaths?.has([...parent.value, node.slug].join('/'))
}

function toggleNode(node: CatalogNode) {
  emit('toggle', [...parent.value, node.slug])
}

function noteRoute(entry: LearningEntry) {
  return props.account ? publicEntryRoute(props.account, entry) : { name: 'note', params: { entryId: entry.id } }
}
</script>

<template>
  <ul class="tree-list">
    <li v-for="node in nodes" :key="node.slug" class="tree-item">
      <RouterLink
        :to="routeFor(node)"
        class="tree-link"
        :class="{ 'is-active': isActive(node), 'has-children': hasVisibleChildren(node), 'is-readonly': readOnly }"
      >
        <span>{{ node.title }}</span>
      </RouterLink>
      <div v-if="hasVisibleChildren(node) || !readOnly" class="tree-controls">
        <button
          v-if="hasVisibleChildren(node)"
          type="button"
          class="tree-action tree-toggle"
          :aria-label="`${isExpanded(node) ? '折叠' : '展开'}${node.title}`"
          :aria-expanded="isExpanded(node)"
          :title="`${isExpanded(node) ? '折叠' : '展开'}${node.title}`"
          @click="toggleNode(node)"
        >{{ isExpanded(node) ? '<' : '>' }}</button>
        <template v-if="!readOnly">
          <button type="button" class="tree-action" :aria-label="`在${node.title}下添加`" title="添加下级菜单或笔记" @click="emit('add', node, [...parent, node.slug])">＋</button>
          <button type="button" class="tree-action" :aria-label="`移动${node.title}`" title="移动到其他子菜单" @click="emit('move', node, [...parent, node.slug])">↗</button>
          <button type="button" class="tree-action tree-action-danger" :aria-label="`删除${node.title}`" title="删除菜单" @click="emit('remove', node, [...parent, node.slug])">−</button>
        </template>
      </div>
      <Transition name="tree-expand">
        <div v-if="hasVisibleChildren(node) && isExpanded(node)" class="tree-branch">
          <div class="tree-branch-inner">
            <NavigationTree
              v-if="node.children?.length && !isKernelSourceRoot(node)"
              :nodes="node.children"
              :subject-slug="subjectSlug"
              :entries="entries"
              :parent-path="[...parent, node.slug]"
              :active-path="activePath"
              :read-only="readOnly"
              :account="account"
              :collapsed-paths="collapsedPaths"
              @add="relayAdd"
              @add-note="relayAddNote"
              @remove="relayRemove"
              @move="relayMove"
              @toggle="emit('toggle', $event)"
            />
            <ul v-if="notesFor(node).length" class="tree-list tree-note-list">
              <li v-for="entry in notesFor(node)" :key="entry.id" class="tree-item">
                <RouterLink :to="noteRoute(entry)" class="tree-link tree-note-link" :class="{ 'is-active': activePath?.join('/') === entry.topicPath.join('/') && (account ? route.query.note === entry.id : route.name === 'note' && route.params.entryId === entry.id) }">
                  <span>{{ entry.title }}</span>
                </RouterLink>
              </li>
            </ul>
          </div>
        </div>
      </Transition>
    </li>
  </ul>
</template>
