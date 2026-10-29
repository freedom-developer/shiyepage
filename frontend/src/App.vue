<script setup lang="ts">
import { computed, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import SideNavigation from './components/SideNavigation.vue'
import { authState, logout } from './lib/api'
import {
  getEntry,
  getEntryTopicPath,
  getSubject,
  subjects,
  catalogError,
  clearCatalog,
  loadCatalog,
} from './data/catalog'

const route = useRoute()
const router = useRouter()

const navSubjects = computed(() => authState.user ? subjects.filter((subject) => subject.slug !== 'linux-kernel') : [])

const currentEntry = computed(() =>
  route.name === 'note' || route.name === 'pdf' ? getEntry(route.params.entryId) : undefined,
)

const currentSubject = computed(() =>
  getSubject(route.params.subjectSlug) ??
  (currentEntry.value ? getSubject(currentEntry.value.subjectSlug) : undefined),
)

const activePath = computed(() => {
  if (route.name === 'subject') {
    const path = route.params.topicPath
    return Array.isArray(path) ? path : typeof path === 'string' && path ? path.split('/') : []
  }
  return currentEntry.value ? getEntryTopicPath(currentEntry.value) : []
})

const hasSidebar = computed(() => Boolean(authState.user && currentSubject.value && route.name !== 'home'))

watch(() => authState.user, (user) => {
  if (user) return
  clearCatalog()
  if (route.meta.requiresAuth) void router.replace({ name: 'home' })
})

async function retryCatalog() {
  await loadCatalog().catch(() => {})
}

function handleLogout() {
  logout()
}
</script>

<template>
  <RouterView v-if="route.meta.publicProfile" />
  <RouterView v-else-if="route.meta.fullScreenReader" />
  <div v-else class="site-shell">
    <header class="topbar">
      <div class="topbar-inner">
        <RouterLink to="/" class="brand" aria-label="拾页首页">
          <span class="brand-mark">拾</span>
          <span class="brand-copy">
            <strong>拾页</strong>
            <small>PERSONAL LEARNING ARCHIVE</small>
          </span>
        </RouterLink>

        <nav class="top-navigation" aria-label="主导航">
          <RouterLink to="/" class="top-link" exact-active-class="is-active">首页</RouterLink>
          <template v-if="authState.user">
            <RouterLink to="/search" class="top-link search-nav-link" active-class="is-active" aria-label="搜索笔记、资料和 Linux 符号">
              <span aria-hidden="true">⌕</span>搜索
            </RouterLink>
            <RouterLink
              v-for="subject in navSubjects"
              :key="subject.slug"
              :to="{ name: 'subject', params: { subjectSlug: subject.slug } }"
              class="top-link"
              active-class="is-active"
            >
              {{ subject.shortTitle }}
            </RouterLink>
            <RouterLink to="/admin" class="top-link nav-manage-link">学科管理</RouterLink>
          </template>
        </nav>

        <div class="topbar-note">
          <span class="status-dot"></span>
          <RouterLink v-if="!authState.user" to="/login" class="auth-link">登录</RouterLink>
          <template v-else>
            <RouterLink :to="{ name: 'public-home', params: { account: authState.user.email } }" class="auth-link">个人主页</RouterLink>
            <RouterLink to="/admin" class="auth-link">学科管理</RouterLink>
            <button class="logout-button" type="button" @click="handleLogout">退出</button>
          </template>
        </div>
      </div>
    </header>

    <div class="page-layout" :class="{ 'has-sidebar': hasSidebar }">
      <SideNavigation
        v-if="hasSidebar && currentSubject"
        :subject="currentSubject"
        :active-path="activePath"
        :read-only="currentSubject.slug === 'linux-kernel'"
      />
      <main class="main-content">
        <div v-if="catalogError && authState.user" class="form-error form-banner" role="alert">
          {{ catalogError }} <button type="button" class="text-button" @click="retryCatalog">重新加载</button>
        </div>
        <RouterView />
      </main>
    </div>

    <footer class="site-footer">
      <span>拾页 · 把读过的书，变成自己的知识</span>
      <span>{{ authState.user ? '已登录 · 可管理学习目录' : '登录后管理学习目录' }}</span>
    </footer>
  </div>
</template>
