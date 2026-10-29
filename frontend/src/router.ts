import { createRouter, createWebHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'
import SubjectView from './views/SubjectView.vue'
import NoteView from './views/NoteView.vue'
import PdfView from './views/PdfView.vue'
import NotFoundView from './views/NotFoundView.vue'
import LoginView from './views/LoginView.vue'
import RegisterView from './views/RegisterView.vue'
import PdfManagementView from './views/PdfManagementView.vue'
import ManagementLayout from './views/ManagementLayout.vue'
import MenuManagementView from './views/MenuManagementView.vue'
import NoteManagementView from './views/NoteManagementView.vue'
import SearchView from './views/SearchView.vue'
import PublicProfileLayout from './views/PublicProfileLayout.vue'
import PublicHomeView from './views/PublicHomeView.vue'
import PublicSubjectView from './views/PublicSubjectView.vue'
import PublicPdfView from './views/PublicPdfView.vue'
import KernelSourceView from './views/KernelSourceView.vue'
import { authState } from './lib/api'

export const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: (to) => to.hash ? { el: to.hash, top: 100 } : { top: 0 },
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/help/markdown', name: 'markdown-help', component: () => import('./views/MarkdownHelpView.vue') },
    {
      path: '/u/:account',
      component: PublicProfileLayout,
      meta: { publicProfile: true },
      children: [
        { path: '', name: 'public-home', component: PublicHomeView },
        { path: 'subject/:subjectSlug/:topicPath(.*)*', name: 'public-subject', component: PublicSubjectView },
        { path: 'pdf/:entryId', name: 'public-pdf', component: PublicPdfView, meta: { fullScreenReader: true } },
        { path: 'chm/:entryId', name: 'public-chm', component: () => import('./views/ChmView.vue'), meta: { fullScreenReader: true } },
      ],
    },
    {
      path: '/subject/:subjectSlug/:topicPath(.*)*',
      name: 'subject',
      component: SubjectView,
      meta: { requiresAuth: true },
    },
    { path: '/note/:entryId', name: 'note', component: NoteView, meta: { requiresAuth: true } },
    { path: '/pdf/:entryId', name: 'pdf', component: PdfView, meta: { requiresAuth: true, fullScreenReader: true } },
    { path: '/chm/:entryId', name: 'chm', component: () => import('./views/ChmView.vue'), meta: { requiresAuth: true, fullScreenReader: true } },
    { path: '/login', name: 'login', component: LoginView },
    { path: '/register', name: 'register', component: RegisterView },
    {
      path: '/admin',
      component: ManagementLayout,
      meta: { requiresAuth: true },
      children: [
        { path: '', name: 'admin', redirect: '/admin/subjects' },
        { path: 'subjects', name: 'subject-management', component: MenuManagementView },
        { path: 'menus', name: 'menu-management', component: MenuManagementView },
        { path: 'notes', name: 'note-management', component: NoteManagementView },
        { path: 'pdfs', name: 'pdf-management', component: PdfManagementView },
      ],
    },
    { path: '/search', name: 'search', component: SearchView, meta: { requiresAuth: true } },
    { path: '/kernel/linux-6.8/source', name: 'kernel-source', component: KernelSourceView, meta: { requiresAuth: true } },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView },
  ],
})

router.beforeEach((to) => {
  if (to.meta.requiresAuth && !authState.user) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if ((to.name === 'login' || to.name === 'register') && authState.user) return { name: 'home' }
  return true
})
