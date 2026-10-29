<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { CatalogNode } from '../data/catalog'
import { publicSubjectRoute } from '../data/public-profile'

defineOptions({ name: 'NavigationTree' })

const props = defineProps<{
  nodes: CatalogNode[]
  subjectSlug: string
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
  toggle: [path: string[]]
}>()

const parent = computed(() => props.parentPath ?? [])

function relayAdd(node: CatalogNode, path: string[]) { emit('add', node, path) }
function relayAddNote(node: CatalogNode, path: string[]) { emit('addNote', node, path) }
function relayRemove(node: CatalogNode, path: string[]) { emit('remove', node, path) }

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

function hasVisibleChildren(node: CatalogNode) {
  return Boolean(node.children?.length && !isKernelSourceRoot(node))
}

function isExpanded(node: CatalogNode) {
  return !props.collapsedPaths?.has([...parent.value, node.slug].join('/'))
}

function activateNode(node: CatalogNode) {
  if (hasVisibleChildren(node)) emit('toggle', [...parent.value, node.slug])
}
</script>

<template>
  <ul class="tree-list">
    <li v-for="node in nodes" :key="node.slug" class="tree-item">
      <RouterLink
        :to="routeFor(node)"
        class="tree-link"
        :class="{ 'is-active': isActive(node), 'has-children': hasVisibleChildren(node), 'is-readonly': readOnly }"
        :aria-expanded="hasVisibleChildren(node) ? isExpanded(node) : undefined"
        @click="activateNode(node)"
      >
        <span>{{ node.title }}</span>
      </RouterLink>
      <div v-if="!readOnly" class="tree-actions">
        <button type="button" class="tree-action" :aria-label="`在${node.title}下添加`" title="添加下级菜单或笔记" @click="emit('add', node, [...parent, node.slug])">＋</button>
        <button type="button" class="tree-action tree-action-danger" :aria-label="`删除${node.title}`" title="删除菜单" @click="emit('remove', node, [...parent, node.slug])">−</button>
      </div>
      <NavigationTree
        v-if="hasVisibleChildren(node) && isExpanded(node)"
        :nodes="node.children ?? []"
        :subject-slug="subjectSlug"
        :parent-path="[...parent, node.slug]"
        :active-path="activePath"
        :read-only="readOnly"
        :account="account"
        :collapsed-paths="collapsedPaths"
        @add="relayAdd"
        @add-note="relayAddNote"
        @remove="relayRemove"
        @toggle="emit('toggle', $event)"
      />
    </li>
  </ul>
</template>
