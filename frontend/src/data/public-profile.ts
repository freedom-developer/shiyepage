import { inject, type ComputedRef, type InjectionKey, type ShallowRef } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import type { LearningEntry, Subject } from './catalog'

export interface PublicProfile {
  profile: { account: string }
  subjects: Subject[]
  entries: LearningEntry[]
}

export const publicProfileKey: InjectionKey<{
  account: ComputedRef<string>
  profile: ShallowRef<PublicProfile | undefined>
}> = Symbol('public-profile')

export function usePublicProfile() {
  const context = inject(publicProfileKey)
  if (!context) throw new Error('个人主页数据尚未加载')
  return context
}

export function publicApiBase(account: string) {
  return `/api/public/${encodeURIComponent(account)}`
}

// Public pages deliberately make anonymous requests, even when the viewer is signed in.
export async function publicRequest<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: 'omit', cache: 'no-store' })
  const result = await response.json().catch(() => undefined) as { message?: string } | undefined
  if (!response.ok) throw new Error(result?.message ?? '公开内容加载失败，请稍后重试')
  if (!result) throw new Error('公开内容加载失败，请检查后端服务后重试')
  return result as T
}

export function publicHomeRoute(account: string): RouteLocationRaw {
  return { name: 'public-home', params: { account } }
}

export function publicSubjectRoute(account: string, subjectSlug: string, topicPath: string[] = []): RouteLocationRaw {
  return { name: 'public-subject', params: { account, subjectSlug, topicPath } }
}

export function publicEntryRoute(account: string, entry: LearningEntry): RouteLocationRaw {
  if (entry.kind === 'pdf') return { name: 'public-pdf', params: { account, entryId: entry.id } }
  if (entry.kind === 'chm') return { name: 'public-chm', params: { account, entryId: entry.id } }
  return { name: 'public-subject', params: { account, subjectSlug: entry.subjectSlug, topicPath: entry.topicPath }, query: { note: entry.id } }
}
