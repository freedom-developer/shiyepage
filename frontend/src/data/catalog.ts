import { computed, reactive, ref } from 'vue'
import { apiRequest, authState } from '../lib/api'

export type EntryKind = 'note' | 'pdf' | 'chm'

export interface LearningEntry {
  id: string
  title: string
  kind: EntryKind
  subjectSlug: string
  topicPath: string[]
  summary: string
  isPrivate: boolean
  canEdit: boolean
  updatedAt: string
  contentFile?: string
  pdfPath?: string
  filePath?: string
  pages?: number
}

export interface CatalogNode {
  id: string
  slug: string
  title: string
  description?: string
  children?: CatalogNode[]
  entryIds?: string[]
}

export interface Subject {
  slug: string
  title: string
  shortTitle: string
  icon: string
  color: string
  description: string
  nodes: CatalogNode[]
}

export const subjects = reactive<Subject[]>([])
export function isPersonalSubject(subject: Pick<Subject, 'slug'>) {
  return subject.slug !== 'linux-kernel'
}
export const personalSubjects = computed(() => subjects.filter(isPersonalSubject))
export const entries = reactive<LearningEntry[]>([])
export const catalogError = ref('')

interface CatalogResponse {
  subjects: Subject[]
  entries: LearningEntry[]
}

export async function loadCatalog() {
  const token = authState.token
  try {
    const result = await apiRequest<CatalogResponse>('/api/catalog')
    if (token !== authState.token) return
    subjects.splice(0, subjects.length, ...result.subjects)
    entries.splice(0, entries.length, ...result.entries)
    catalogError.value = ''
  } catch (reason) {
    if (token === authState.token) catalogError.value = '学习目录加载失败，请检查后端服务后重试。'
    throw reason
  }
}

export function clearCatalog() {
  subjects.splice(0)
  entries.splice(0)
  catalogError.value = ''
}

const noteModules = import.meta.glob('../content/**/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

export function getNoteContent(entry: LearningEntry): string | undefined {
  if (!entry.contentFile) return undefined
  return noteModules[`../content/${entry.contentFile}`]
}

export function getEntry(id: string | string[] | undefined): LearningEntry | undefined {
  const normalizedId = Array.isArray(id) ? id[0] : id
  return entries.find((entry) => entry.id === normalizedId)
}

export function getSubject(slug: string | string[] | undefined): Subject | undefined {
  const normalizedSlug = Array.isArray(slug) ? slug[0] : slug
  return subjects.find((subject) => subject.slug === normalizedSlug)
}

export function findNode(nodes: CatalogNode[], path: string[]): CatalogNode | undefined {
  if (!path.length) return undefined
  const [currentSlug, ...remainingPath] = path
  const currentNode = nodes.find((node) => node.slug === currentSlug)
  if (!currentNode) return undefined
  return remainingPath.length
    ? currentNode.children && findNode(currentNode.children, remainingPath)
    : currentNode
}

export function flattenNodes(nodes: CatalogNode[], parentPath: string[] = []): Array<{
  node: CatalogNode
  path: string[]
}> {
  return nodes.flatMap((node) => {
    const path = [...parentPath, node.slug]
    return [{ node, path }, ...(node.children ? flattenNodes(node.children, path) : [])]
  })
}

export function entriesForNode(subject: Subject, node?: CatalogNode): LearningEntry[] {
  if (!node) return entries.filter((entry) => entry.subjectSlug === subject.slug)
  const ids = new Set(node.entryIds ?? [])
  return entries.filter((entry) => entry.subjectSlug === subject.slug && ids.has(entry.id))
}

export function getEntryTopicPath(entry: LearningEntry): string[] {
  return entry.topicPath
}
