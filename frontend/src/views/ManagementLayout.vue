<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import ProfileShare from '../components/ProfileShare.vue'
</script>

<template>
  <section class="admin-view">
    <div class="admin-heading">
      <div><span class="eyebrow">YOUR LEARNING WORKSPACE</span><h1>学习档案管理</h1><p>整理目录、记录笔记，收藏学习资料。</p></div>
      <RouterLink to="/" class="text-button">返回首页</RouterLink>
    </div>
    <ProfileShare />
    <nav class="management-navigation" aria-label="管理导航">
      <RouterLink to="/admin/subjects" active-class="is-active">学科管理</RouterLink>
      <RouterLink to="/admin/pdfs" active-class="is-active">PDF 资料</RouterLink>
    </nav>
    <RouterView />
  </section>
</template>
