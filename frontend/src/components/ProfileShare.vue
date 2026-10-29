<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { authState } from '../lib/api'
import { publicHomeRoute } from '../data/public-profile'

const router = useRouter()
const linkInput = ref<HTMLInputElement>()
const message = ref('')
const homepage = computed(() => publicHomeRoute(authState.user?.email ?? ''))
const shareUrl = computed(() => new URL(router.resolve(homepage.value).href, window.location.origin).href)

async function copyLink() {
  message.value = ''
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    message.value = '链接已复制'
  } catch {
    linkInput.value?.focus()
    linkInput.value?.select()
    message.value = document.execCommand('copy') ? '链接已复制' : '链接已选中，请按 Ctrl+C 复制'
  }
}
</script>

<template>
  <section v-if="authState.user" class="profile-share" aria-label="分享个人主页">
    <div class="profile-share-heading"><strong>公开个人主页</strong><RouterLink :to="homepage" class="text-button">查看主页 ↗</RouterLink></div>
    <div class="profile-share-link"><input ref="linkInput" :value="shareUrl" aria-label="个人主页地址" readonly @click="linkInput?.select()" /><button type="button" class="text-button" @click="copyLink">复制链接</button></div>
    <p class="form-help">访客无需登录即可阅读公开资料。取消笔记的“私有”勾选并保存后，即可展示。</p>
    <span v-if="message" class="saved-hint" role="status">{{ message }}</span>
  </section>
</template>
