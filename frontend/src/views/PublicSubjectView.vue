<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute, type RouteLocationRaw } from 'vue-router'
import NoteReader from '../components/NoteReader.vue'
import { findNode } from '../data/catalog'
import { publicEntryRoute, publicHomeRoute, publicSubjectRoute, usePublicProfile } from '../data/public-profile'

const route = useRoute()
const { account, profile } = usePublicProfile()
const subject = computed(() => profile.value?.subjects.find((item) => item.slug === route.params.subjectSlug))
const topicPath = computed(() => {
  const path = route.params.topicPath
  return Array.isArray(path) ? path : typeof path === 'string' && path ? path.split('/') : []
})
const selectedNode = computed(() => subject.value ? findNode(subject.value.nodes, topicPath.value) : undefined)
const validLocation = computed(() => Boolean(subject.value && (!topicPath.value.length || selectedNode.value)))
const childNodes = computed(() => selectedNode.value ? selectedNode.value.children ?? [] : subject.value?.nodes ?? [])
const visibleEntries = computed(() => {
  const items = profile.value?.entries.filter((entry) => entry.subjectSlug === subject.value?.slug) ?? []
  if (!selectedNode.value) return items
  const ids = new Set(selectedNode.value.entryIds ?? [])
  return items.filter((entry) => ids.has(entry.id))
})
const notes = computed(() => visibleEntries.value.filter((entry) => entry.kind === 'note'))
const files = computed(() => visibleEntries.value.filter((entry) => entry.kind === 'pdf' || entry.kind === 'chm'))
const noteId = computed(() => typeof route.query.note === 'string' ? route.query.note : '')
const selectedNote = computed(() => notes.value.find((note) => note.id === noteId.value))
const breadcrumbs = computed(() => {
  if (!subject.value) return []
  const items: Array<{ title: string; to?: RouteLocationRaw }> = [
    { title: '首页', to: publicHomeRoute(account.value) },
    { title: subject.value.title, to: publicSubjectRoute(account.value, subject.value.slug) },
  ]
  const path: string[] = []
  for (const slug of topicPath.value) {
    path.push(slug)
    const node = findNode(subject.value.nodes, path)
    if (!node) break
    items.push({ title: node.title, to: publicSubjectRoute(account.value, subject.value.slug, [...path]) })
  }
  if (selectedNote.value) items.push({ title: selectedNote.value.title })
  return items
})
</script>

<template>
  <div v-if="subject && validLocation" class="subject-view">
    <nav class="breadcrumb" aria-label="面包屑"><template v-for="(item, index) in breadcrumbs" :key="`${index}-${item.title}`"><span v-if="index" aria-hidden="true">/</span><RouterLink v-if="item.to" :to="item.to">{{ item.title }}</RouterLink><span v-else aria-current="page">{{ item.title }}</span></template></nav>

    <section v-if="noteId" class="note-workspace">
      <NoteReader v-if="selectedNote" :entry-id="selectedNote.id" :public-account="account" :public-entry="selectedNote" :public-subject="subject" read-only />
      <div v-else class="empty-state"><div><h3>这篇笔记未公开或不属于当前目录</h3><p>请返回目录查看作者分享的资料。</p></div></div>
      <RouterLink :to="publicSubjectRoute(account, subject.slug, topicPath)" class="back-link">← 返回笔记列表</RouterLink>
    </section>

    <template v-else>
      <section v-if="childNodes.length" class="topic-section">
        <div class="section-heading compact-heading"><h2>{{ selectedNode ? '子目录' : '目录' }}</h2><span class="section-aside">{{ childNodes.length }} 个子目录</span></div>
        <div class="topic-grid"><RouterLink v-for="node in childNodes" :key="node.id" :to="publicSubjectRoute(account, subject.slug, [...topicPath, node.slug])" class="topic-card"><h3>{{ node.title }}</h3><p>{{ node.description }}</p><span class="topic-card-link">打开目录 <span>→</span></span></RouterLink></div>
      </section>

      <section class="topic-section entries-section">
        <div class="section-heading compact-heading"><h2>{{ selectedNode ? '此目录的笔记' : '全部笔记' }}</h2><span class="section-aside">{{ notes.length }} 篇</span></div>
        <div v-if="notes.length" class="subject-note-list">
          <article v-for="note in notes" :key="note.id" class="subject-note-row"><RouterLink :to="publicEntryRoute(account, note)" class="subject-note-main"><span class="entry-type type-note">笔记</span><strong>{{ note.title }}</strong><small>{{ note.summary || '暂无摘要' }}</small><time :datetime="note.updatedAt">更新于 {{ note.updatedAt }}</time></RouterLink></article>
        </div>
        <div v-else class="empty-state"><div><h3>此目录暂无公开笔记</h3><p>可以从左侧目录继续浏览。</p></div></div>
      </section>

      <section v-if="files.length" class="topic-section entries-section">
        <div class="section-heading compact-heading"><h2>资料文件</h2><span class="section-aside">{{ files.length }} 项</span></div>
        <div class="resource-grid"><RouterLink v-for="entry in files" :key="entry.id" :to="publicEntryRoute(account, entry)" target="_blank" rel="noopener noreferrer" class="resource-card"><div class="resource-card-top"><span class="entry-type" :class="entry.kind === 'pdf' ? 'type-pdf' : 'type-chm'">{{ entry.kind.toUpperCase() }}</span><time :datetime="entry.updatedAt">{{ entry.updatedAt }}</time></div><h3>{{ entry.title }}</h3><p>{{ entry.summary }}</p><span class="resource-open">打开阅读 ↗</span></RouterLink></div>
      </section>
    </template>
  </div>
  <div v-else class="not-found-inline"><h1>这个目录没有公开资料</h1><RouterLink :to="publicHomeRoute(account)" class="text-link">返回个人主页 →</RouterLink></div>
</template>
