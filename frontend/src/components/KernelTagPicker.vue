<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import type { KernelCodeTag } from '../lib/kernel-code'

defineProps<{ name: string; tags: KernelCodeTag[] }>()
const emit = defineEmits<{ close: [] }>()

function tagKindLabel(kind: string) {
  const labels: Record<string, string> = {
    c: '类', d: '宏/定义', e: '枚举', f: '函数', g: '枚举值', m: '成员', p: '函数原型', s: '结构体',
    t: '类型定义', u: '联合体', v: '变量', n: '命名空间',
  }
  return labels[kind] ?? kind
}

function tagRoute(tag: KernelCodeTag) {
  return { name: 'kernel-source', query: { file: tag.file, name: tag.name, address: tag.address, q: tag.name, scope: 'kernel' } }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <div class="kernel-tag-modal" role="presentation" @click.self="emit('close')">
      <section class="kernel-tag-dialog" role="dialog" aria-modal="true" :aria-labelledby="`kernel-tag-title-${name}`">
        <header class="kernel-tag-dialog-heading">
          <div>
            <span class="eyebrow">MULTIPLE DEFINITIONS</span>
            <h2 :id="`kernel-tag-title-${name}`">{{ name }}</h2>
            <p>找到 {{ tags.length }} 个定义，请选择要打开的源码位置。</p>
          </div>
          <button type="button" class="icon-button" aria-label="关闭定义选项" title="关闭" @click="emit('close')">×</button>
        </header>
        <div class="kernel-tag-options">
          <RouterLink v-for="tag in tags" :key="`${tag.file}:${tag.address}:${tag.kind}`" :to="tagRoute(tag)" class="kernel-tag-option" @click="emit('close')">
            <span class="kernel-result-kind">{{ tagKindLabel(tag.kind) }}</span>
            <span class="kernel-tag-option-copy"><strong>{{ tag.file }}</strong><small>{{ tag.scope ? `${tag.scope} · ` : '' }}{{ tag.address }}</small></span>
            <span class="kernel-result-arrow" aria-hidden="true">↗</span>
          </RouterLink>
        </div>
      </section>
    </div>
  </Teleport>
</template>
