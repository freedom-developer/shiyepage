<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const active = ref(Boolean(document.fullscreenElement))

function syncState() {
  active.value = Boolean(document.fullscreenElement)
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await document.documentElement.requestFullscreen()
  } catch {
    active.value = Boolean(document.fullscreenElement)
  }
}

onMounted(() => document.addEventListener('fullscreenchange', syncState))
onBeforeUnmount(() => document.removeEventListener('fullscreenchange', syncState))
</script>

<template>
  <button class="reader-fullscreen-button" type="button" :title="active ? '退出全屏' : '进入全屏'" @click="toggleFullscreen">
    {{ active ? '退出全屏' : '全屏' }}
  </button>
</template>
