import type { FastifyReply, FastifyRequest } from 'fastify'

export interface AuthUser {
  sub: string
  email: string
  role: string
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  try {
    await request.jwtVerify()
    return true
  } catch {
    reply.code(401).send({ error: 'UNAUTHORIZED', message: '请先登录' })
    return false
  }
}

export function currentUser(request: FastifyRequest): AuthUser {
  return request.user as AuthUser
}

export function isAdmin(request: FastifyRequest): boolean {
  return currentUser(request).role === 'ADMIN'
}

export async function canReadPrivateResource(
  request: FastifyRequest,
  resource: { isPrivate: boolean; ownerId: string },
): Promise<boolean> {
  if (!resource.isPrivate) return true
  try {
    await request.jwtVerify()
  } catch {
    return false
  }
  const user = currentUser(request)
  return user.role === 'ADMIN' || user.sub === resource.ownerId
}
