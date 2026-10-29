<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { authState } from '../lib/api'
import ProfileShare from '../components/ProfileShare.vue'
import {
  entries,
  flattenNodes,
  personalSubjects,
  type LearningEntry,
} from '../data/catalog'

const recentEntries = computed(() =>
  [...entries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4),
)

function entryRoute(entry: LearningEntry) {
  return entry.kind === 'note'
    ? { name: 'subject', params: { subjectSlug: entry.subjectSlug, topicPath: entry.topicPath }, query: { note: entry.id } }
    : { name: entry.kind === 'chm' ? 'chm' : 'pdf', params: { entryId: entry.id } }
}

</script>

<template>
  <div class="home-view">
    <section class="hero-panel">
      <div class="hero-copy">
        <div class="eyebrow hero-eyebrow"><span class="eyebrow-line"></span> MY LEARNING JOURNAL</div>
        <h1>读过的书，<br /><em>留下自己的理解。</em></h1>
        <p>一个安静整理学习资料的地方。收好电子书、推演公式，也记录那些值得回看的代码与想法。</p>
        <RouterLink :to="authState.user ? (personalSubjects[0] ? { name: 'subject', params: { subjectSlug: personalSubjects[0].slug } } : { name: 'menu-management' }) : { name: 'login' }" class="button-primary">
          {{ authState.user ? (personalSubjects.length ? '开始浏览' : '添加第一个学科') : '登录学习档案' }} <span aria-hidden="true">↗</span>
        </RouterLink>
        <RouterLink v-if="!authState.user" to="/register" class="hero-register-link">还没有账号？立即注册 →</RouterLink>
      </div>
      <div class="hero-art" aria-hidden="true">
        <div class="orbit orbit-one"></div>
        <div class="orbit orbit-two"></div>
        <div class="book-shape book-back"></div>
        <div class="book-shape book-front">
          <span class="book-rule"></span>
          <span class="book-glyph">∫</span>
          <span class="book-caption">NOTES<br />&amp; IDEAS</span>
        </div>
        <span class="float-symbol symbol-one">∑</span>
        <span class="float-symbol symbol-two">{ }</span>
        <span class="float-symbol symbol-three">π</span>
      </div>
      <div class="hero-index">01 <span>/</span> 04</div>
    </section>

    <ProfileShare />

    <section v-if="authState.user" class="section-block">
      <div class="section-heading">
        <div>
          <span class="eyebrow">EXPLORE BY SUBJECT</span>
          <h2>学习主题</h2>
        </div>
        <span class="section-aside">当前 {{ personalSubjects.length }} 个主题 · 持续生长</span>
      </div>

      <div class="subject-grid">
        <RouterLink
          v-for="(subject, index) in personalSubjects"
          :key="subject.slug"
          :to="{ name: 'subject', params: { subjectSlug: subject.slug } }"
          class="subject-card"
          :class="`subject-${subject.color}`"
        >
          <div class="subject-card-top">
            <span class="subject-icon">{{ subject.icon }}</span>
            <span class="card-number">0{{ index + 1 }}</span>
          </div>
          <h3>{{ subject.title }}</h3>
          <p>{{ subject.description }}</p>
          <span class="subject-card-bottom">
            <span>{{ flattenNodes(subject.nodes).length }} 个目录节点</span>
            <span class="round-arrow">↗</span>
          </span>
        </RouterLink>
        <RouterLink to="/admin" class="subject-card subject-add-card">
          <div class="subject-card-top"><span class="subject-icon">＋</span><span class="card-number">NEXT</span></div>
          <h3>添加学科</h3>
          <p>物理、音乐、影视……为新的兴趣建立一个学习空间。</p>
          <span class="subject-card-bottom"><span>分类不受限</span><span class="round-arrow">＋</span></span>
        </RouterLink>
      </div>
    </section>

    <section v-if="authState.user" class="section-block recent-block">
      <div class="section-heading">
        <div>
          <span class="eyebrow">RECENTLY UPDATED</span>
          <h2>最近整理</h2>
        </div>
        <span class="section-aside">笔记与资料统一归档</span>
      </div>
      <div class="recent-list">
        <RouterLink
          v-for="entry in recentEntries"
          :key="entry.id"
          :to="entryRoute(entry)"
          :target="entry.kind === 'note' ? undefined : '_blank'"
          :rel="entry.kind === 'note' ? undefined : 'noopener noreferrer'"
          class="recent-row"
        >
          <span class="entry-type" :class="`type-${entry.kind}`">{{ entry.kind === 'note' ? '笔记' : 'PDF' }}</span>
          <span class="recent-title-wrap">
            <strong>{{ entry.title }}</strong>
            <small>{{ entry.summary }}</small>
          </span>
          <time :datetime="entry.updatedAt">{{ entry.updatedAt }}</time>
          <span class="recent-arrow" aria-hidden="true">↗</span>
        </RouterLink>
      </div>
      <p v-if="!recentEntries.length" class="form-help">还没有资料，进入任一学科的子菜单后即可创建笔记，或到 <RouterLink to="/admin/pdfs" class="auth-inline-link">PDF 资料</RouterLink>上传电子书。</p>
    </section>

    <section class="home-note">
      <span class="note-star">✳</span>
      <p>用学科和目录整理电子书，留下每一次学习的理解。<br /><strong v-if="authState.user">从 <RouterLink to="/admin" class="auth-inline-link">学科管理</RouterLink>添加顶部菜单，再进入对应学科整理子菜单和笔记。</strong><strong v-else>登录或注册，开始记录你的学习历程。</strong></p>
      <span class="note-code">MARKDOWN + PDF</span>
    </section>
  </div>
</template>
