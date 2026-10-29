import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import bcrypt from 'bcryptjs'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import pdfParse from 'pdf-parse'
import { Prisma, PrismaClient } from '@prisma/client'
import { config } from './config.js'
import { canReadPrivateResource, currentUser, isAdmin, requireAuth } from './auth.js'
import { getCatalog, getPublicCatalog, findNodeByPath } from './catalog.js'
import { findKernelTag, findKernelTagsForNames, findKernelTagsForReferences, readKernelDirectory, readKernelSourceFile, readKernelSourceFileByPath, searchKernelTags, type KernelDirectoryEntry, type KernelTagReference } from './kernel-tags.js'
import { archiveNode, ensureNoteAssignments } from './note-assignment.js'
import {
  loginSchema,
  noteCreateSchema,
  nodeCreateSchema,
  progressSchema,
  registerSchema,
  resourcePatchSchema,
  subjectCreateSchema,
  userCreateSchema,
} from './validation.js'

export const prisma = new PrismaClient()

async function ensureKernelCatalog() {
  let rootEntries: KernelDirectoryEntry[]
  try {
    rootEntries = (await readKernelDirectory(config.kernelSourceDir)).entries.filter((entry) => entry.kind === 'directory')
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return
    throw error
  }

  const lastSubject = await prisma.subject.aggregate({ _max: { sortOrder: true } })
  const subject = await prisma.subject.upsert({
    where: { slug: 'linux-kernel' },
    update: {},
    create: {
      slug: 'linux-kernel',
      title: 'Linux Kernel',
      shortTitle: 'Linux Kernel',
      icon: '⌘',
      color: 'green',
      description: 'Linux v6.8 源码浏览与符号索引。',
      sortOrder: (lastSubject._max.sortOrder ?? -1) + 1,
    },
  })
  const ensureVersionTree = async (targetSubjectId: string, parentId: string | null) => {
    let versionNode = await prisma.catalogNode.findFirst({
      where: { subjectId: targetSubjectId, parentId, slug: 'linux-6-8' },
    })
    if (!versionNode) {
      versionNode = await prisma.catalogNode.create({
        data: { subjectId: targetSubjectId, parentId, slug: 'linux-6-8', title: 'Linux-6.8', sortOrder: 0 },
      })
    }
    for (const [sortOrder, entry] of rootEntries.entries()) {
      const existing = await prisma.catalogNode.findFirst({
        where: { subjectId: targetSubjectId, parentId: versionNode.id, slug: entry.slug },
      })
      if (!existing) {
        await prisma.catalogNode.create({
          data: {
            subjectId: targetSubjectId,
            parentId: versionNode.id,
            slug: entry.slug,
            title: entry.name,
            description: `Linux-6.8/${entry.name} 源码目录`,
            sortOrder,
          },
        })
      }
    }
  }

  await ensureVersionTree(subject.id, null)

  const existingKernelMenus = await prisma.catalogNode.findMany({
    where: { OR: [{ slug: 'linux-kernel' }, { title: 'Linux Kernel' }] },
    select: { id: true, subjectId: true },
  })
  for (const node of existingKernelMenus) {
    if (node.subjectId !== subject.id) await ensureVersionTree(node.subjectId, node.id)
  }
}

function parseNodePath(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((part): part is string => typeof part === 'string')
  if (typeof value !== 'string' || !value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((part): part is string => typeof part === 'string') : value.split('/').filter(Boolean)
  } catch {
    return value.split('/').filter(Boolean)
  }
}

function sanitizeResource(resource: Awaited<ReturnType<typeof prisma.resource.findUnique>>) {
  if (!resource) return undefined
  return {
    id: resource.id,
    kind: resource.kind.toLowerCase(),
    title: resource.title,
    summary: resource.summary,
    subjectId: resource.subjectId,
    nodeId: resource.nodeId,
    content: resource.kind === 'NOTE' ? resource.content : undefined,
    originalName: resource.originalName,
    mimeType: resource.mimeType,
    sizeBytes: resource.sizeBytes,
    pageCount: resource.pageCount,
    isPrivate: resource.isPrivate,
    createdAt: resource.createdAt,
    updatedAt: resource.updatedAt,
  }
}

async function findReadableResource(request: FastifyRequest, reply: FastifyReply, id: string) {
  const resource = await prisma.resource.findUnique({ where: { id } })
  if (!resource) {
    reply.code(404).send({ error: 'NOT_FOUND', message: '资料不存在' })
    return undefined
  }
  if (!(await canReadPrivateResource(request, resource))) {
    reply.code(401).send({ error: 'UNAUTHORIZED', message: '该资料需要登录后访问' })
    return undefined
  }
  return resource
}

async function findPublicResource(account: string, id: string, reply: FastifyReply) {
  const resource = await prisma.resource.findFirst({
    where: { id, isPrivate: false, owner: { email: account.toLowerCase() } },
  })
  if (!resource) reply.code(404).send({ error: 'NOT_FOUND', message: '公开资料不存在或已取消公开' })
  return resource
}

async function sendStoredFile(resource: NonNullable<Awaited<ReturnType<typeof prisma.resource.findUnique>>>, reply: FastifyReply) {
  if (!['PDF', 'CHM'].includes(resource.kind) || !resource.storagePath) return reply.code(404).send({ error: 'FILE_NOT_FOUND', message: '文件不存在' })
  const absolutePath = path.resolve(config.storageDir, resource.storagePath)
  if (!absolutePath.startsWith(`${path.resolve(config.storageDir)}${path.sep}`)) return reply.code(400).send({ error: 'INVALID_PATH' })
  try {
    const stat = await fs.promises.stat(absolutePath)
    reply.header('Content-Length', stat.size)
    reply.header('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(resource.originalName ?? resource.id)}`)
    reply.type(resource.kind === 'PDF' ? 'application/pdf' : 'application/vnd.ms-htmlhelp')
    return reply.send(fs.createReadStream(absolutePath))
  } catch {
    return reply.code(404).send({ error: 'FILE_NOT_FOUND', message: 'PDF 文件不存在' })
  }
}

function registerRoutes(app: FastifyInstance) {
  app.post('/api/auth/login', async (request, reply) => {
    const input = loginSchema.safeParse(request.body)
    if (!input.success) return reply.code(400).send({ error: 'INVALID_INPUT', message: '邮箱或密码格式不正确' })
    const user = await prisma.user.findUnique({ where: { email: input.data.email.toLowerCase() } })
    if (!user || !(await bcrypt.compare(input.data.password, user.passwordHash))) {
      return reply.code(401).send({ error: 'INVALID_CREDENTIALS', message: '邮箱或密码错误' })
    }
    const token = await reply.jwtSign({ sub: user.id, email: user.email, role: user.role }, { expiresIn: '12h' })
    return { token, user: { id: user.id, email: user.email, role: user.role } }
  })

  app.post('/api/auth/register', async (request, reply) => {
    const input = registerSchema.safeParse(request.body)
    if (!input.success) return reply.code(400).send({ error: 'INVALID_INPUT', message: '请输入有效邮箱和至少 8 位密码' })
    const email = input.data.email.toLowerCase()
    try {
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash: await bcrypt.hash(input.data.password, 12),
          role: 'READER',
        },
      })
      const token = await reply.jwtSign({ sub: user.id, email: user.email, role: user.role }, { expiresIn: '12h' })
      return reply.code(201).send({ token, user: { id: user.id, email: user.email, role: user.role } })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return reply.code(409).send({ error: 'EMAIL_EXISTS', message: '该邮箱已经注册' })
      }
      throw error
    }
  })

  app.get('/api/auth/me', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const user = await prisma.user.findUnique({ where: { id: currentUser(request).sub }, select: { id: true, email: true, role: true } })
    return user ? { user } : reply.code(401).send({ error: 'UNAUTHORIZED', message: '用户不存在' })
  })

  app.get('/api/catalog', async (request) => {
    let user
    try {
      await request.jwtVerify()
      user = currentUser(request)
    } catch {
      // Public catalog only contains public resources.
    }
    return getCatalog(prisma, user)
  })

  app.get('/api/public/:account', async (request, reply) => {
    const { account } = request.params as { account: string }
    const user = await prisma.user.findUnique({ where: { email: account.toLowerCase() }, select: { id: true, email: true } })
    if (!user) return reply.code(404).send({ error: 'PROFILE_NOT_FOUND', message: '这个账号的个人主页不存在' })
    const catalog = await getPublicCatalog(prisma, user.id)
    const base = `/api/public/${encodeURIComponent(user.email)}`
    return {
      profile: { account: user.email },
      ...catalog,
      entries: catalog.entries.map((entry) => ({
        ...entry,
        pdfPath: entry.kind === 'pdf' ? `${base}/resources/${entry.id}/file` : undefined,
        filePath: ['pdf', 'chm'].includes(entry.kind) ? `${base}/resources/${entry.id}/file` : undefined,
      })),
    }
  })

  app.get('/api/public/:account/resources/:id', async (request, reply) => {
    const { account, id } = request.params as { account: string; id: string }
    const resource = await findPublicResource(account, id, reply)
    if (!resource) return
    return { resource: sanitizeResource(resource), canEdit: false }
  })

  app.get('/api/public/:account/resources/:id/file', async (request, reply) => {
    const { account, id } = request.params as { account: string; id: string }
    const resource = await findPublicResource(account, id, reply)
    if (!resource) return
    return sendStoredFile(resource, reply)
  })

  app.get('/api/resources/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const resource = await findReadableResource(request, reply, id)
    if (!resource) return
    let progress: { page: number; percent: number; updatedAt: Date } | null = null
    try {
      await request.jwtVerify()
      progress = await prisma.readingProgress.findUnique({
        where: { userId_resourceId: { userId: currentUser(request).sub, resourceId: id } },
        select: { page: true, percent: true, updatedAt: true },
      })
    } catch {
      // Public resource without a logged-in progress record.
    }
    const user = request.user as { sub?: string; role?: string } | undefined
    return {
      resource: sanitizeResource(resource),
      progress,
      canEdit: Boolean(user && (user.role === 'ADMIN' || user.sub === resource.ownerId)),
    }
  })

  app.patch('/api/resources/:id', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const { id } = request.params as { id: string }
    const existing = await prisma.resource.findUnique({ where: { id } })
    if (!existing) return reply.code(404).send({ error: 'NOT_FOUND', message: '资料不存在' })
    const user = currentUser(request)
    if (!isAdmin(request) && existing.ownerId !== user.sub) return reply.code(403).send({ error: 'FORBIDDEN', message: '没有编辑权限' })
    const input = resourcePatchSchema.safeParse(request.body)
    if (!input.success) return reply.code(400).send({ error: 'INVALID_INPUT', message: input.error.issues[0]?.message })
    if (existing.kind === 'NOTE' && (input.data.subjectSlug || input.data.nodePath) && !input.data.nodePath?.length) {
      return reply.code(400).send({ error: 'NOTE_NODE_REQUIRED', message: '笔记必须归属于一个子菜单' })
    }

    let subjectId = existing.subjectId
    let nodeId = existing.nodeId
    if (input.data.subjectSlug || input.data.nodePath) {
      const subject = await prisma.subject.findUnique({
        where: { id: existing.subjectId },
        select: { slug: true },
      })
      const targetSubject = await prisma.subject.findUnique({
        where: { slug: input.data.subjectSlug ?? subject?.slug },
      })
      if (!targetSubject) return reply.code(400).send({ error: 'INVALID_SUBJECT', message: '学习主题不存在' })
      subjectId = targetSubject.id
      const node = input.data.nodePath?.length ? await findNodeByPath(prisma, targetSubject.id, input.data.nodePath) : undefined
      if (input.data.nodePath?.length && !node) return reply.code(400).send({ error: 'INVALID_NODE', message: '目录节点不存在' })
      // Existing notes keep their current assignment when only metadata changes.
      // A note that changes subject or menu must always resolve to a real submenu.
      if (existing.kind === 'NOTE') {
        if (!node) return reply.code(400).send({ error: 'NOTE_NODE_REQUIRED', message: '笔记必须归属于一个子菜单' })
        nodeId = node.id
      } else {
        nodeId = node?.id ?? null
      }
    }
    const updated = await prisma.resource.update({
      where: { id },
      data: {
        title: input.data.title,
        summary: input.data.summary,
        content: existing.kind === 'NOTE' ? input.data.content : undefined,
        searchText: existing.kind === 'NOTE' ? `${input.data.title ?? existing.title}\n${input.data.summary ?? existing.summary}\n${input.data.content ?? existing.content ?? ''}` : undefined,
        isPrivate: input.data.isPrivate,
        subjectId,
        nodeId,
      },
    })
    return { resource: sanitizeResource(updated) }
  })

  app.post('/api/resources/note', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const input = noteCreateSchema.safeParse(request.body)
    if (!input.success) return reply.code(400).send({ error: 'INVALID_INPUT', message: input.error.issues[0]?.message })
    const subject = await prisma.subject.findUnique({ where: { slug: input.data.subjectSlug } })
    if (!subject) return reply.code(400).send({ error: 'INVALID_SUBJECT', message: '学习主题不存在' })
    const node = input.data.nodePath.length ? await findNodeByPath(prisma, subject.id, input.data.nodePath) : undefined
    if (input.data.nodePath.length && !node) return reply.code(400).send({ error: 'INVALID_NODE', message: '目录节点不存在' })
    const id = crypto.randomUUID()
    const isPrivate = input.data.isPrivate
    const resource = await prisma.resource.create({
      data: {
        id,
        kind: 'NOTE',
        title: input.data.title,
        summary: input.data.summary,
        content: input.data.content,
        searchText: `${input.data.title}\n${input.data.summary}\n${input.data.content}`,
        subjectId: subject.id,
        nodeId: node?.id,
        isPrivate,
        ownerId: currentUser(request).sub,
      },
    })
    return reply.code(201).send({ resource: sanitizeResource(resource) })
  })

  app.delete('/api/resources/:id', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const { id } = request.params as { id: string }
    const resource = await prisma.resource.findUnique({ where: { id } })
    if (!resource) return reply.code(404).send({ error: 'NOT_FOUND', message: '资料不存在' })
    if (!isAdmin(request) && resource.ownerId !== currentUser(request).sub) return reply.code(403).send({ error: 'FORBIDDEN', message: '没有删除权限' })
    if (resource.storagePath) await fs.promises.rm(path.resolve(config.storageDir, resource.storagePath), { force: true })
    await prisma.resource.delete({ where: { id } })
    return { ok: true }
  })

  app.post('/api/resources/upload', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const user = currentUser(request)
    const file = await request.file({ limits: { fileSize: config.maxUploadBytes, files: 1 } })
    if (!file) return reply.code(400).send({ error: 'FILE_REQUIRED', message: '请选择 PDF 或 CHM 文件' })
    const extension = path.extname(file.filename).toLowerCase()
    if (!['.pdf', '.chm'].includes(extension)) {
      return reply.code(400).send({ error: 'INVALID_FILE', message: '只允许上传 PDF 或 CHM 文件' })
    }
    const id = crypto.randomUUID()
    await fs.promises.mkdir(config.storageDir, { recursive: true })
    const storagePath = `${id}${extension}`
    const stagingPath = `${storagePath}.upload`
    let buffer: Buffer | undefined
    let sizeBytes = 0
    if (extension === '.chm') {
      const stagingFile = path.join(config.storageDir, stagingPath)
      try {
        await pipeline(file.file, fs.createWriteStream(stagingFile, { flags: 'wx' }))
        if (file.file.truncated) {
          await fs.promises.rm(stagingFile, { force: true })
          return reply.code(413).send({ error: 'FILE_TOO_LARGE', message: '文件超过上传大小限制' })
        }
        const handle = await fs.promises.open(stagingFile, 'r')
        const signature = Buffer.alloc(4)
        try {
          await handle.read(signature, 0, signature.length, 0)
        } finally {
          await handle.close()
        }
        if (signature.toString('ascii') !== 'ITSF') {
          await fs.promises.rm(stagingFile, { force: true })
          return reply.code(400).send({ error: 'INVALID_FILE', message: 'CHM 文件头无效，请选择有效的 CHM 文件' })
        }
        sizeBytes = (await fs.promises.stat(stagingFile)).size
      } catch (error) {
        await fs.promises.rm(stagingFile, { force: true })
        throw error
      }
    } else {
      buffer = await file.toBuffer()
      sizeBytes = buffer.byteLength
    }
    let parsed: { text?: string; nPages?: number } = {}
    if (extension === '.pdf') {
      try {
        parsed = await pdfParse(buffer!)
      } catch {
        request.log.warn({ filename: file.filename }, 'PDF text extraction failed; keeping the file without a text index')
      }
    }
    const fields = file.fields as Record<string, { value?: unknown } | undefined>
    const title = String(fields.title?.value ?? file.filename.slice(0, -extension.length)).trim().slice(0, 200)
    const summary = String(fields.summary?.value ?? '').slice(0, 2000)
    const subjectSlug = String(fields.subjectSlug?.value ?? '')
    const nodePath = parseNodePath(fields.nodePath?.value)
    const isPrivate = String(fields.isPrivate?.value ?? 'true') !== 'false'
    const subject = await prisma.subject.findUnique({ where: { slug: subjectSlug } })
    if (!subject) {
      if (extension === '.chm') await fs.promises.rm(path.join(config.storageDir, stagingPath), { force: true })
      return reply.code(400).send({ error: 'INVALID_SUBJECT', message: '学习主题不存在' })
    }
    const node = nodePath.length ? await findNodeByPath(prisma, subject.id, nodePath) : undefined
    if (nodePath.length && !node) {
      if (extension === '.chm') await fs.promises.rm(path.join(config.storageDir, stagingPath), { force: true })
      return reply.code(400).send({ error: 'INVALID_NODE', message: '目录节点不存在' })
    }

    if (extension === '.chm') {
      await fs.promises.rename(path.join(config.storageDir, stagingPath), path.join(config.storageDir, storagePath))
    } else {
      await fs.promises.writeFile(path.join(config.storageDir, storagePath), buffer!)
    }
    try {
      const resource = await prisma.resource.create({
        data: {
          id,
          kind: extension === '.pdf' ? 'PDF' : 'CHM',
          title,
          summary,
          subjectId: subject.id,
          nodeId: node?.id,
          searchText: `${title}\n${summary}\n${parsed.text ?? ''}`,
          storagePath,
          originalName: file.filename,
          mimeType: extension === '.pdf' ? 'application/pdf' : 'application/vnd.ms-htmlhelp',
          sizeBytes,
          pageCount: parsed.nPages,
          isPrivate,
          ownerId: user.sub,
        },
      })
      return reply.code(201).send({ resource: sanitizeResource(resource) })
    } catch (error) {
      await fs.promises.rm(path.join(config.storageDir, storagePath), { force: true })
      throw error
    }
  })

  app.get('/api/resources/:id/file', async (request, reply) => {
    const { id } = request.params as { id: string }
    const resource = await findReadableResource(request, reply, id)
    if (!resource) return
    return sendStoredFile(resource, reply)
  })

  app.get('/api/resources/:id/progress', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const { id } = request.params as { id: string }
    const resource = await prisma.resource.findUnique({ where: { id }, select: { isPrivate: true, ownerId: true } })
    if (!resource || !(await canReadPrivateResource(request, resource))) return reply.code(404).send({ error: 'NOT_FOUND', message: '资料不存在' })
    return {
      progress: await prisma.readingProgress.findUnique({
        where: { userId_resourceId: { userId: currentUser(request).sub, resourceId: id } },
      }),
    }
  })

  app.put('/api/resources/:id/progress', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const { id } = request.params as { id: string }
    const input = progressSchema.safeParse(request.body)
    if (!input.success) return reply.code(400).send({ error: 'INVALID_INPUT', message: '阅读进度格式不正确' })
    const resource = await prisma.resource.findUnique({ where: { id }, select: { isPrivate: true, ownerId: true } })
    if (!resource || !(await canReadPrivateResource(request, resource))) return reply.code(404).send({ error: 'NOT_FOUND', message: '资料不存在' })
    const progress = await prisma.readingProgress.upsert({
      where: { userId_resourceId: { userId: currentUser(request).sub, resourceId: id } },
      create: { userId: currentUser(request).sub, resourceId: id, page: input.data.page, percent: input.data.percent },
      update: { page: input.data.page, percent: input.data.percent },
    })
    return { progress }
  })

  app.get('/api/search', async (request) => {
    const { q } = request.query as { q?: string }
    const query = q?.trim()
    if (!query) return { results: [] }
    let user
    try {
      await request.jwtVerify()
      user = currentUser(request)
    } catch {
      // Search public content without an account.
    }
    const resources = await prisma.resource.findMany({
      where: {
        ...(user?.role === 'ADMIN' ? {} : { AND: [{ OR: [{ isPrivate: false }, ...(user ? [{ ownerId: user.sub }] : [])] }] }),
        OR: [
          { title: { contains: query } },
          { summary: { contains: query } },
          { searchText: { contains: query } },
        ],
      },
      include: { subject: true },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    })
    return {
      results: resources.map((resource) => ({
        id: resource.id,
        kind: resource.kind.toLowerCase(),
        title: resource.title,
        summary: resource.summary,
        subjectSlug: resource.subject.slug,
        updatedAt: resource.updatedAt,
      })),
    }
  })

  app.get('/api/kernel/linux-6.8/tags', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const { q, offset, limit } = request.query as { q?: string; offset?: string; limit?: string }
    const query = q?.trim()
    if (!query || query.length > 200 || /[\u0000-\u001f\u007f]/.test(query)) {
      return reply.code(400).send({ error: 'INVALID_QUERY', message: '请输入长度不超过 200 个字符的符号名' })
    }
    const parsedOffset = offset === undefined ? 0 : Number(offset)
    if (!Number.isInteger(parsedOffset) || parsedOffset < 0 || parsedOffset > 20_000_000) {
      return reply.code(400).send({ error: 'INVALID_OFFSET', message: '搜索结果偏移量无效' })
    }
    const parsedLimit = limit === undefined ? 50 : Number(limit)
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000) {
      return reply.code(400).send({ error: 'INVALID_LIMIT', message: '搜索结果数量无效' })
    }
    try {
      return await searchKernelTags(path.join(config.kernelSourceDir, 'tags'), query, parsedOffset, parsedLimit)
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return reply.code(503).send({ error: 'KERNEL_INDEX_UNAVAILABLE', message: 'Linux-6.8 tags 索引不可用' })
      }
      throw error
    }
  })

  app.post('/api/kernel/linux-6.8/tags/lookup', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const body = request.body as { references?: unknown } | undefined
    const validKinds = new Set(['function', 'struct', 'union', 'enum'])
    if (!Array.isArray(body?.references) || body.references.length > 1000 || body.references.some((reference) =>
      !reference || typeof reference !== 'object'
      || typeof reference.name !== 'string' || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(reference.name)
      || typeof reference.kind !== 'string' || !validKinds.has(reference.kind),
    )) {
      return reply.code(400).send({ error: 'INVALID_REFERENCES', message: '符号引用列表无效，最多查询 1000 个函数或类型' })
    }
    try {
      const symbols = await findKernelTagsForReferences(path.join(config.kernelSourceDir, 'tags'), body.references as KernelTagReference[])
      return { symbols }
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return reply.code(503).send({ error: 'KERNEL_INDEX_UNAVAILABLE', message: 'Linux-6.8 tags 索引不可用' })
      }
      throw error
    }
  })

  app.get('/api/kernel/linux-6.8/source', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const { file, name, address } = request.query as { file?: string; name?: string; address?: string }
    if (!file || !name || !address || name.length > 200 || address.length > 8192) {
      return reply.code(400).send({ error: 'INVALID_SOURCE_LOCATION', message: '源码定位信息不完整或过长' })
    }
    try {
      const tag = await findKernelTag(path.join(config.kernelSourceDir, 'tags'), name, file, address)
      if (!tag) return reply.code(404).send({ error: 'TAG_NOT_FOUND', message: 'Linux-6.8 tags 中没有这个定义位置' })
      return await readKernelSourceFile(config.kernelSourceDir, tag.file, tag.name, tag.address)
    } catch (error) {
      if (error instanceof Error && error.message.includes('超出 Linux-6.8 目录')) {
        return reply.code(400).send({ error: 'INVALID_SOURCE_PATH', message: '源码路径无效' })
      }
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return reply.code(404).send({ error: 'SOURCE_NOT_FOUND', message: '源码文件不存在' })
      }
      if (error instanceof Error && error.message.includes('找不到符号')) {
        return reply.code(404).send({ error: 'DEFINITION_NOT_FOUND', message: error.message })
      }
      if (error instanceof Error && error.message.includes('地址过长')) {
        return reply.code(400).send({ error: 'INVALID_ADDRESS', message: error.message })
      }
      if (error instanceof Error && error.message.includes('不是文本源码')) {
        return reply.code(415).send({ error: 'SOURCE_NOT_TEXT', message: error.message })
      }
      throw error
    }
  })

  app.get('/api/kernel/linux-6.8/directory', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const { path: relativePath } = request.query as { path?: string }
    try {
      return await readKernelDirectory(config.kernelSourceDir, relativePath ?? '')
    } catch (error) {
      if (error instanceof Error && error.message.includes('源码路径')) {
        return reply.code(400).send({ error: 'INVALID_SOURCE_PATH', message: '源码路径无效' })
      }
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return reply.code(404).send({ error: 'SOURCE_DIRECTORY_NOT_FOUND', message: '源码目录不存在' })
      }
      throw error
    }
  })

  app.get('/api/kernel/linux-6.8/file', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const { path: relativePath } = request.query as { path?: string }
    if (!relativePath) {
      return reply.code(400).send({ error: 'INVALID_SOURCE_LOCATION', message: '源码文件路径无效' })
    }
    try {
      return await readKernelSourceFileByPath(config.kernelSourceDir, relativePath)
    } catch (error) {
      if (error instanceof Error && error.message.includes('源码路径')) {
        return reply.code(400).send({ error: 'INVALID_SOURCE_PATH', message: '源码路径无效' })
      }
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return reply.code(404).send({ error: 'SOURCE_NOT_FOUND', message: '源码文件不存在' })
      }
      if (error instanceof Error && error.message.includes('不是文本源码')) {
        return reply.code(415).send({ error: 'SOURCE_NOT_TEXT', message: error.message })
      }
      throw error
    }
  })

  app.post('/api/admin/users', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    if (!isAdmin(request)) return reply.code(403).send({ error: 'FORBIDDEN', message: '只有管理员可以管理用户' })
    const input = userCreateSchema.safeParse(request.body)
    if (!input.success) return reply.code(400).send({ error: 'INVALID_INPUT', message: input.error.issues[0]?.message })
    const passwordHash = await bcrypt.hash(input.data.password, 12)
    try {
      const user = await prisma.user.create({ data: { email: input.data.email.toLowerCase(), passwordHash, role: input.data.role } })
      return reply.code(201).send({ user: { id: user.id, email: user.email, role: user.role } })
    } catch {
      return reply.code(409).send({ error: 'EMAIL_EXISTS', message: '邮箱已经存在' })
    }
  })

  app.get('/api/admin/users', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    if (!isAdmin(request)) return reply.code(403).send({ error: 'FORBIDDEN', message: '只有管理员可以管理用户' })
    const users = await prisma.user.findMany({
      select: { id: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
    return { users }
  })

  app.post('/api/admin/subjects', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const input = subjectCreateSchema.safeParse(request.body)
    if (!input.success) return reply.code(400).send({ error: 'INVALID_INPUT', message: input.error.issues[0]?.message })
    try {
      const lastSubject = await prisma.subject.aggregate({ _max: { sortOrder: true } })
      const subject = await prisma.subject.create({
        data: { ...input.data, sortOrder: (lastSubject._max.sortOrder ?? -1) + 1 },
      })
      return reply.code(201).send({ subject })
    } catch {
      return reply.code(409).send({ error: 'SLUG_EXISTS', message: '分类 slug 已存在' })
    }
  })

  app.post('/api/admin/nodes', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const input = nodeCreateSchema.safeParse(request.body)
    if (!input.success) return reply.code(400).send({ error: 'INVALID_INPUT', message: input.error.issues[0]?.message })
    const subject = await prisma.subject.findUnique({ where: { slug: input.data.subjectSlug } })
    if (!subject) return reply.code(404).send({ error: 'SUBJECT_NOT_FOUND', message: '学习主题不存在' })
    const parent = input.data.parentPath.length
      ? await findNodeByPath(prisma, subject.id, input.data.parentPath)
      : undefined
    if (input.data.parentPath.length && !parent) return reply.code(404).send({ error: 'PARENT_NOT_FOUND', message: '父级目录不存在' })
    if (input.data.parentPath.length >= 8) return reply.code(400).send({ error: 'MAX_DEPTH', message: '子菜单最多支持 8 层' })
    const existing = await prisma.catalogNode.findFirst({
      where: { subjectId: subject.id, parentId: parent?.id ?? null, slug: input.data.slug },
    })
    if (existing) return reply.code(409).send({ error: 'SLUG_EXISTS', message: '同级目录 slug 已存在' })
    try {
      const node = await prisma.catalogNode.create({
        data: {
          subjectId: subject.id,
          parentId: parent?.id,
          slug: input.data.slug,
          title: input.data.title,
          description: input.data.description,
        },
      })
      return reply.code(201).send({ node })
    } catch {
      return reply.code(409).send({ error: 'SLUG_EXISTS', message: '同级目录 slug 已存在' })
    }
  })

  app.delete('/api/admin/subjects/:slug', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const { slug } = request.params as { slug: string }
    const { moveTo } = request.query as { moveTo?: string }
    const result = await prisma.$transaction(async (tx) => {
      const subject = await tx.subject.findUnique({ where: { slug }, select: { id: true } })
      if (!subject) return { status: 404, error: 'SUBJECT_NOT_FOUND', message: '学习主题不存在' }
      const resourceCount = await tx.resource.count({ where: { subjectId: subject.id } })
      if (resourceCount) {
        const target = typeof moveTo === 'string' && moveTo !== slug
          ? await tx.subject.findUnique({ where: { slug: moveTo }, select: { id: true } })
          : null
        if (!target) return { status: 409, error: 'SUBJECT_HAS_RESOURCES', message: '请选择资料迁入的学科；若没有其他学科，请先新建一个' }
        const noteCount = await tx.resource.count({ where: { subjectId: subject.id, kind: 'NOTE' } })
        if (noteCount) {
          const targetNode = await archiveNode(tx, target.id)
          await tx.resource.updateMany({ where: { subjectId: subject.id, kind: 'NOTE' }, data: { subjectId: target.id, nodeId: targetNode.id } })
        }
        await tx.resource.updateMany({ where: { subjectId: subject.id }, data: { subjectId: target.id, nodeId: null } })
      }
      await tx.subject.delete({ where: { id: subject.id } })
    })
    if (result) return reply.code(result.status).send({ error: result.error, message: result.message })
    return { ok: true }
  })

  app.delete('/api/admin/nodes/:id', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const { id } = request.params as { id: string }
    const result = await prisma.$transaction(async (tx) => {
      const node = await tx.catalogNode.findUnique({ where: { id }, select: { id: true, subjectId: true } })
      if (!node) return { status: 404, error: 'NODE_NOT_FOUND', message: '菜单不存在' }
      const nodes = await tx.catalogNode.findMany({ where: { subjectId: node.subjectId }, select: { id: true, parentId: true } })
      const descendants = new Set([node.id])
      let changed = true
      while (changed) {
        changed = false
        for (const candidate of nodes) {
          if (candidate.parentId && descendants.has(candidate.parentId) && !descendants.has(candidate.id)) {
            descendants.add(candidate.id)
            changed = true
          }
        }
      }
      const noteCount = await tx.resource.count({ where: { kind: 'NOTE', nodeId: { in: [...descendants] } } })
      if (noteCount) return { status: 409, error: 'NODE_HAS_NOTES', message: '该菜单或下级菜单中还有笔记，请先移动或删除笔记；其他用户的私有笔记需由作者或管理员处理' }
      await tx.catalogNode.delete({ where: { id: node.id } })
    })
    if (result) return reply.code(result.status).send({ error: result.error, message: result.message })
    return { ok: true }
  })
}

export async function buildApp(): Promise<FastifyInstance> {
  await ensureKernelCatalog()
  await ensureNoteAssignments(prisma)
  const app = Fastify({ logger: true })
  await app.register(cors, { origin: config.webOrigin, credentials: true })
  await app.register(jwt, { secret: config.jwtSecret })
  await app.register(multipart, { limits: { fileSize: config.maxUploadBytes, files: 1 } })
  registerRoutes(app)
  app.get('/api/health', async () => ({ ok: true }))
  return app
}

if (process.env.NODE_ENV !== 'test') {
  const app = await buildApp()
  await fs.promises.mkdir(config.storageDir, { recursive: true })
  await app.listen({ host: config.host, port: config.port })
  console.log(`API listening on http://${config.host}:${config.port}`)
  const shutdown = async () => {
    await app.close()
    await prisma.$disconnect()
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
}
