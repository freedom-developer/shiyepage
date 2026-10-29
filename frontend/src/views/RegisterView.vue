<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { register } from '../lib/api'
import { loadCatalog } from '../data/catalog'

const route = useRoute()
const router = useRouter()
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  if (password.value !== confirmPassword.value) {
    error.value = '两次输入的密码不一致'
    return
  }
  loading.value = true
  try {
    await register(email.value, password.value)
    await loadCatalog().catch(() => {})
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/admin'
    await router.push(redirect)
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '注册失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="auth-view">
    <div class="auth-panel">
      <span class="eyebrow">START YOUR ARCHIVE</span>
      <h1>创建学习账号</h1>
      <p>注册后即可管理学科和菜单、上传电子书并记录学习笔记。</p>
      <form class="auth-form" @submit.prevent="submit">
        <label>邮箱<input v-model="email" type="email" autocomplete="email" required /></label>
        <label>密码<input v-model="password" type="password" autocomplete="new-password" minlength="8" maxlength="200" placeholder="至少 8 位" required /></label>
        <label>确认密码<input v-model="confirmPassword" type="password" autocomplete="new-password" minlength="8" maxlength="200" required /></label>
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
        <button class="button-primary" type="submit" :disabled="loading">{{ loading ? '注册中…' : '注册并登录' }} <span>↗</span></button>
      </form>
      <p class="auth-note">已有账号？<RouterLink :to="{ name: 'login', query: route.query }" class="auth-inline-link">前往登录</RouterLink></p>
    </div>
  </section>
</template>
