import { reactive } from 'vue'

export interface ApiUser {
  id: string
  email: string
  role: string
}

interface ApiError {
  error?: string
  message?: string
}

const tokenKey = 'study-library-token'

export const authState = reactive<{
  token: string | null
  user: ApiUser | null
  ready: boolean
}>({
  token: localStorage.getItem(tokenKey),
  user: null,
  ready: false,
})

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (authState.token) headers.set('Authorization', `Bearer ${authState.token}`)
  const response = await fetch(path, { ...init, headers })
  const text = await response.text()
  let body: unknown = undefined
  try {
    body = text ? JSON.parse(text) : undefined
  } catch {
    body = text
  }
  if (!response.ok) {
    if (response.status === 401) clearAuth()
    const error = body as ApiError | undefined
    throw new Error(error?.message ?? `请求失败（${response.status}）`)
  }
  return body as T
}

export async function apiFile(path: string): Promise<Response> {
  const headers = new Headers()
  if (authState.token) headers.set('Authorization', `Bearer ${authState.token}`)
  const response = await fetch(path, { headers })
  if (!response.ok) {
    if (response.status === 401) clearAuth()
    throw new Error(`文件请求失败（${response.status}）`)
  }
  return response
}

export async function login(email: string, password: string) {
  const result = await apiRequest<{ token: string; user: ApiUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  authState.token = result.token
  authState.user = result.user
  localStorage.setItem(tokenKey, result.token)
  return result.user
}

export async function register(email: string, password: string) {
  const result = await apiRequest<{ token: string; user: ApiUser }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  authState.token = result.token
  authState.user = result.user
  localStorage.setItem(tokenKey, result.token)
  return result.user
}

export function clearAuth() {
  authState.token = null
  authState.user = null
  localStorage.removeItem(tokenKey)
}

export function logout() {
  clearAuth()
}

export async function loadSession() {
  if (!authState.token) {
    authState.ready = true
    return
  }
  try {
    const result = await apiRequest<{ user: ApiUser }>('/api/auth/me')
    authState.user = result.user
  } catch {
    clearAuth()
  } finally {
    authState.ready = true
  }
}

export async function uploadFile(form: FormData) {
  return apiRequest<{ resource: Record<string, unknown> }>('/api/resources/upload', {
    method: 'POST',
    body: form,
  })
}

export const uploadPdf = uploadFile
