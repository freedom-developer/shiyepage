<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { apiRequest } from '../lib/api'
import { highlightKernelLines, type KernelCodeTag } from '../lib/kernel-code'
import KernelTagPicker from './KernelTagPicker.vue'

const props = defineProps<{
  file: string
  startLine: number
  lines: string[]
  symbols: Record<string, KernelCodeTag>
  highlightLine?: number
}>()
const router = useRouter()

const viewport = ref<HTMLElement>()
const highlightedLines = ref<string[]>([])
const renderedStart = ref(0)
const scrollTop = ref(0)
const viewportHeight = ref(0)
const rowHeight = ref(23)
const pickerName = ref('')
const pickerTags = ref<KernelCodeTag[]>([])
const tagLoading = ref(false)
const overscan = 24
let renderVersion = 0

const visibleStart = computed(() => Math.max(0, Math.floor(scrollTop.value / rowHeight.value) - overscan))
const visibleEnd = computed(() => Math.min(props.lines.length, Math.ceil((scrollTop.value + viewportHeight.value) / rowHeight.value) + overscan))
const sourceWidth = computed(() => {
  const longestLine = props.lines.reduce((max, line) => Math.max(max, line.length), 0)
  return `calc(${longestLine}ch + 90px)`
})
const renderedEnd = computed(() => Math.min(props.lines.length, renderedStart.value + highlightedLines.value.length))
const topSpacerHeight = computed(() => `${renderedStart.value * rowHeight.value}px`)
const bottomSpacerHeight = computed(() => `${Math.max(0, props.lines.length - renderedEnd.value) * rowHeight.value}px`)

function updateViewport() {
  const container = viewport.value
  if (!container) return
  const fontSize = Number.parseFloat(getComputedStyle(container).fontSize)
  if (Number.isFinite(fontSize) && fontSize > 0) rowHeight.value = fontSize * 1.75 + 2
  scrollTop.value = container.scrollTop
  viewportHeight.value = container.clientHeight
}

function scrollToCurrentLocation() {
  const container = viewport.value
  if (!container) return
  const lineIndex = props.highlightLine === undefined ? 0 : Math.max(0, props.highlightLine - props.startLine)
  container.scrollTop = Math.max(0, lineIndex * rowHeight.value - Math.max(0, (container.clientHeight - rowHeight.value) / 2))
  updateViewport()
}

function sourceRoute(tag: KernelCodeTag) {
  return { name: 'kernel-source', query: { file: tag.file, name: tag.name, address: tag.address, q: tag.name, scope: 'kernel' } }
}

async function handleCodeClick(event: MouseEvent) {
  const target = event.target instanceof HTMLElement ? event.target.closest<HTMLAnchorElement>('.source-symbol-link') : null
  if (!target) return
  const name = target.dataset.symbol
  if (!name || tagLoading.value) return
  event.preventDefault()
  tagLoading.value = true
  try {
    const response = await apiRequest<{ results: KernelCodeTag[] }>(`/api/kernel/linux-6.8/tags?q=${encodeURIComponent(name)}&limit=1000`)
    const tags = response.results.filter((tag) => tag.name === name)
    if (tags.length <= 1) {
      const tag = tags[0]
      if (tag) await router.push(sourceRoute(tag))
      else window.location.assign(target.href)
      return
    }
    pickerName.value = name
    pickerTags.value = tags
  } catch {
    window.location.assign(target.href)
  } finally {
    tagLoading.value = false
  }
}

function closePicker() {
  pickerName.value = ''
  pickerTags.value = []
}

onMounted(() => {
  updateViewport()
  window.addEventListener('resize', updateViewport)
})

onBeforeUnmount(() => {
  renderVersion++
  window.removeEventListener('resize', updateViewport)
})

watch(() => [props.file, props.startLine, props.lines, props.highlightLine] as const, async () => {
  highlightedLines.value = []
  renderedStart.value = 0
  await nextTick()
  scrollToCurrentLocation()
}, { immediate: true, flush: 'post' })

watch(() => [props.file, props.startLine, props.lines, props.symbols, props.highlightLine, visibleStart.value, visibleEnd.value] as const, async () => {
  const version = ++renderVersion
  const start = visibleStart.value
  const end = visibleEnd.value
  const rendered = await highlightKernelLines(props.lines.slice(start, end), props.file, props.symbols)
  if (version !== renderVersion) return
  renderedStart.value = start
  highlightedLines.value = rendered
}, { immediate: true })
</script>

<template>
  <div ref="viewport" class="source-code-viewport" tabindex="0" :aria-label="`${file} 源码内容`" @click="handleCodeClick" @scroll.passive="updateViewport">
    <div class="source-code" :style="{ width: sourceWidth }">
      <div class="source-code-spacer" :style="{ height: topSpacerHeight }" aria-hidden="true"></div>
      <div
        v-for="(line, index) in highlightedLines"
        :key="renderedStart + index"
        class="source-code-line"
        :class="{ 'is-definition': startLine + renderedStart + index === highlightLine }"
        :data-line="startLine + renderedStart + index"
      >
        <span class="source-line-number">{{ startLine + renderedStart + index }}</span><code v-html="line || ' '"></code>
      </div>
      <div class="source-code-spacer" :style="{ height: bottomSpacerHeight }" aria-hidden="true"></div>
    </div>
    <KernelTagPicker v-if="pickerTags.length" :name="pickerName" :tags="pickerTags" @close="closePicker" />
  </div>
</template>
