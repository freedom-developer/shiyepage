import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import { authState, loadSession } from './lib/api'
import { loadCatalog } from './data/catalog'
import './styles/main.css'
import 'katex/dist/katex.min.css'

async function bootstrap() {
  await loadSession()
  if (authState.user) await loadCatalog().catch(() => {})
  createApp(App).use(router).mount('#app')
}

void bootstrap()
