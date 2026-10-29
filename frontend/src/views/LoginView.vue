<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { login } from '../lib/api'
import { loadCatalog } from '../data/catalog'

const route = useRoute()
const router = useRouter()
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await login(email.value, password.value)
    await loadCatalog().catch(() => {})
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.push(redirect)
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '登录失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="auth-view">
    <div class="auth-panel">
      <span class="eyebrow">PRIVATE ARCHIVE</span>
      <h1>登录学习档案</h1>
      <p>登录后可以上传 PDF、编辑笔记、搜索私有内容并同步阅读进度。</p>
      <form class="auth-form" @submit.prevent="submit">
        <label>邮箱<input v-model="email" type="email" autocomplete="email" required /></label>
        <label>密码<input v-model="password" type="password" autocomplete="current-password" required /></label>
        <p v-if="error" class="form-error">{{ error }}</p>
        <button class="button-primary" type="submit" :disabled="loading">{{ loading ? '登录中…' : '登录' }} <span>↗</span></button>
      </form>
      <p class="auth-note">还没有账号？<RouterLink :to="{ name: 'register', query: route.query }" class="auth-inline-link">注册账号</RouterLink></p>
    </div>
  </section>
</template>
