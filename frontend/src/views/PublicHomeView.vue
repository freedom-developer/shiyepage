<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { isPersonalSubject } from '../data/catalog'
import { publicEntryRoute, publicSubjectRoute, usePublicProfile } from '../data/public-profile'

const { account, profile } = usePublicProfile()
const recentEntries = computed(() => profile.value?.entries.slice(0, 8) ?? [])
const noteCount = computed(() => profile.value?.entries.filter((entry) => entry.kind === 'note').length ?? 0)
const visibleSubjects = computed(() => profile.value?.subjects.filter(isPersonalSubject) ?? [])
</script>

<template>
  <div v-if="profile" class="home-view public-home">
    <header class="public-home-heading">
      <h1>{{ account }} 的学习档案</h1>
      <p>记录读过的书、理解过的公式，以及学习中的思考。</p>
      <p class="form-help">{{ visibleSubjects.length }} 个学科 · {{ noteCount }} 篇笔记 · {{ profile.entries.length - noteCount }} 份电子书</p>
    </header>

    <div v-if="!profile.entries.length" class="empty-state"><span class="empty-state-icon">✳</span><div><h3>还没有公开的学习资料</h3><p>这里将展示作者分享的笔记与电子书。</p></div></div>

    <section v-if="visibleSubjects.length" class="section-block">
      <div class="section-heading"><h2>学习主题</h2></div>
      <div class="subject-grid">
        <RouterLink v-for="subject in visibleSubjects" :key="subject.slug" :to="publicSubjectRoute(account, subject.slug)" class="subject-card" :class="`subject-${subject.color}`">
          <div class="subject-card-top"><span class="subject-icon">{{ subject.icon }}</span></div>
          <h3>{{ subject.title }}</h3><p>{{ subject.description }}</p>
          <span class="subject-card-bottom"><span>{{ profile.entries.filter((entry) => entry.subjectSlug === subject.slug).length }} 项资料</span><span class="round-arrow">↗</span></span>
        </RouterLink>
      </div>
    </section>

    <section v-if="recentEntries.length" class="section-block recent-block">
      <div class="section-heading"><h2>最近更新</h2></div>
      <div class="recent-list">
        <RouterLink v-for="entry in recentEntries" :key="entry.id" :to="publicEntryRoute(account, entry)" :target="entry.kind === 'note' ? undefined : '_blank'" :rel="entry.kind === 'note' ? undefined : 'noopener noreferrer'" class="recent-row">
          <span class="entry-type" :class="`type-${entry.kind}`">{{ entry.kind === 'note' ? '笔记' : 'PDF' }}</span>
          <span class="recent-title-wrap"><strong>{{ entry.title }}</strong><small>{{ entry.summary }}</small></span>
          <time :datetime="entry.updatedAt">{{ entry.updatedAt }}</time><span class="recent-arrow" aria-hidden="true">↗</span>
        </RouterLink>
      </div>
    </section>
  </div>
</template>
