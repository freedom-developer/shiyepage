<script setup lang="ts">
import { computed, onBeforeUnmount, provide, ref, shallowRef, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import SideNavigation from '../components/SideNavigation.vue'
import { publicApiBase, publicHomeRoute, publicProfileKey, publicRequest, publicSubjectRoute, type PublicProfile } from '../data/public-profile'

const route = useRoute()
const account = computed(() => String(route.params.account ?? '').toLowerCase())
const profile = shallowRef<PublicProfile>()
const visibleSubjects = computed(() => profile.value?.subjects.filter((subject) => subject.slug !== 'linux-kernel') ?? [])
const loading = ref(false)
const error = ref('')
let loadVersion = 0
const currentEntry = computed(() => profile.value?.entries.find((entry) => entry.id === route.params.entryId))
const currentSubject = computed(() => profile.value?.subjects.find((subject) =>
  subject.slug === (route.params.subjectSlug ?? currentEntry.value?.subjectSlug),
))
const activePath = computed(() => {
  if (currentEntry.value) return currentEntry.value.topicPath
  const path = route.params.topicPath
  return Array.isArray(path) ? path : typeof path === 'string' && path ? path.split('/') : []
})

provide(publicProfileKey, { account, profile })

async function loadProfile() {
  const version = ++loadVersion
  const currentAccount = account.value
  profile.value = undefined
  error.value = ''
  loading.value = true
  try {
    const result = await publicRequest<PublicProfile>(publicApiBase(currentAccount))
    if (version === loadVersion) profile.value = result
  } catch (reason) {
    if (version === loadVersion) error.value = reason instanceof Error ? reason.message : '个人主页加载失败'
  } finally {
    if (version === loadVersion) loading.value = false
  }
}

watch(account, () => { void loadProfile() }, { immediate: true })
onBeforeUnmount(() => { loadVersion++ })
</script>

<template>
  <RouterView v-if="route.meta.fullScreenReader" :key="account" />
  <div v-else class="site-shell public-profile">
    <header class="topbar">
      <div class="topbar-inner">
        <RouterLink :to="publicHomeRoute(account)" class="brand" aria-label="个人主页">
          <span class="brand-mark">拾</span>
          <span class="brand-copy"><strong>拾页</strong><small>PERSONAL LEARNING ARCHIVE</small></span>
        </RouterLink>
        <nav class="top-navigation" aria-label="个人主页导航">
          <RouterLink :to="publicHomeRoute(account)" class="top-link" exact-active-class="is-active">首页</RouterLink>
          <RouterLink v-for="subject in visibleSubjects" :key="subject.slug" :to="publicSubjectRoute(account, subject.slug)" class="top-link" active-class="is-active">{{ subject.shortTitle }}</RouterLink>
        </nav>
        <span class="topbar-note public-account" :title="account">{{ account }}</span>
      </div>
    </header>

    <div class="page-layout" :class="{ 'has-sidebar': Boolean(currentSubject) }">
      <SideNavigation v-if="currentSubject" :subject="currentSubject" :active-path="activePath" :account="account" read-only />
      <main class="main-content">
        <p v-if="loading" class="loading-state" role="status">正在加载个人主页…</p>
        <div v-else-if="error" class="not-found-inline" role="alert"><h1>暂时无法查看这个主页</h1><p>{{ error }}</p><button type="button" class="text-button" @click="loadProfile">重新加载</button></div>
        <RouterView v-else-if="profile" :key="account" />
      </main>
    </div>

    <footer class="site-footer"><span>拾页 · 把读过的书，变成自己的知识</span><span>个人学习档案</span></footer>
  </div>
</template>
