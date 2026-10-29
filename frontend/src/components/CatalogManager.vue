<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { apiRequest } from '../lib/api'
import { entries, loadCatalog, personalSubjects, type Subject } from '../data/catalog'

const title = ref('')
const slug = ref('')
const description = ref('')
const icon = ref('✦')
const color = ref('blue')
const busy = ref(false)
const message = ref('')
const error = ref('')
const deleting = ref<Subject>()
const moveTo = ref('')
const destinationSubjects = computed(() => personalSubjects.value.filter((subject) => subject.slug !== deleting.value?.slug))
function makeSlug(value: string) { return value.trim() || title.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `subject-${Date.now().toString(36)}` }
watch(deleting, (subject) => { moveTo.value = destinationSubjects.value.find((item) => item.slug !== subject?.slug)?.slug ?? '' })
async function mutate(action: () => Promise<void>, success: string) { busy.value = true; error.value = ''; message.value = ''; try { await action(); await loadCatalog(); message.value = success } catch (reason) { error.value = reason instanceof Error ? reason.message : '操作失败，请重试' } finally { busy.value = false } }
async function addSubject() {
  const newSlug = makeSlug(slug.value)
  await mutate(async () => { await apiRequest('/api/admin/subjects', { method: 'POST', body: JSON.stringify({ title: title.value.trim(), shortTitle: title.value.trim().slice(0, 30), slug: newSlug, description: description.value.trim(), icon: icon.value, color: color.value }) }); title.value = ''; slug.value = ''; description.value = '' }, '学科已添加，顶部导航已更新。')
}
async function removeSubject() {
  if (!deleting.value) return
  await mutate(async () => { const query = moveTo.value ? `?moveTo=${encodeURIComponent(moveTo.value)}` : ''; await apiRequest(`/api/admin/subjects/${encodeURIComponent(deleting.value!.slug)}${query}`, { method: 'DELETE' }); deleting.value = undefined }, '学科已删除，资料已迁移到目标学科。')
}
function resourceCount(slugValue: string) { return entries.filter((entry) => entry.subjectSlug === slugValue).length }
</script>

<template>
  <section class="catalog-manager">
    <div class="section-heading compact-heading"><div><span class="eyebrow">SUBJECT NAVIGATION</span><h2>学科管理</h2></div><span class="section-aside">这里只管理顶部导航菜单</span></div>
    <p class="catalog-intro">学科会显示在顶部导航栏。进入具体学科后，可在左侧目录栏添加和删除子菜单。</p>
    <p v-if="message" class="form-success" role="status">{{ message }}</p><p v-if="error" class="form-error form-banner" role="alert">{{ error }}</p>
    <div class="admin-grid">
      <form class="admin-form" @submit.prevent="addSubject">
        <div class="form-section-title"><span class="entry-type type-note">学科</span><h2>添加顶部菜单</h2></div>
        <label>学科名称<input v-model="title" maxlength="100" placeholder="例如：物理、音乐、影视" required /></label>
        <label>简介<textarea v-model="description" rows="2" maxlength="500" placeholder="记录你想学习的方向"></textarea></label>
        <div class="form-row"><label>图标<input v-model="icon" maxlength="12" required /></label><label>颜色<select v-model="color"><option value="blue">蓝色</option><option value="violet">紫色</option><option value="green">绿色</option><option value="amber">琥珀色</option></select></label></div>
        <label>链接标识（选填）<input v-model="slug" pattern="[a-z0-9-]+" maxlength="100" placeholder="例如 physics；留空自动生成" /></label>
        <button class="button-primary" type="submit" :disabled="busy">添加学科 <span>＋</span></button>
      </form>
      <div class="admin-form">
        <div class="form-section-title"><h2>已有学科</h2><span class="section-aside">{{ personalSubjects.length }} 个</span></div>
        <div v-if="personalSubjects.length" class="catalog-list"><div v-for="subject in personalSubjects" :key="subject.slug" class="catalog-row"><RouterLink :to="{ name: 'subject', params: { subjectSlug: subject.slug } }" class="catalog-item-title">{{ subject.icon }} {{ subject.title }}</RouterLink><span class="catalog-count">{{ resourceCount(subject.slug) }} 份资料</span><button class="delete-button" type="button" :disabled="busy" @click="deleting = subject">删除</button></div></div><p v-else class="form-help">还没有学科，先添加一个感兴趣的方向。</p>
        <form v-if="deleting" class="delete-subject-panel" @submit.prevent="removeSubject"><strong>删除“{{ deleting.title }}”并迁移资料？</strong><label v-if="destinationSubjects.length">资料迁入<select v-model="moveTo" required><option v-for="subject in destinationSubjects" :key="subject.slug" :value="subject.slug">{{ subject.title }}</option></select></label><p class="form-help">笔记、PDF 和阅读进度都会保留。笔记会放入目标学科的“未分类”子菜单。</p><div class="delete-subject-actions"><button type="submit" class="delete-button" :disabled="busy || (!destinationSubjects.length && resourceCount(deleting.slug) > 0)">确认删除</button><button type="button" class="text-button" :disabled="busy" @click="deleting = undefined">取消</button></div></form>
      </div>
    </div>
  </section>
</template>
