import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
})

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
})

export const resourcePatchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  summary: z.string().max(2000).optional(),
  content: z.string().max(2_000_000).optional(),
  isPrivate: z.boolean().optional(),
  subjectSlug: z.string().regex(/^[a-z0-9-]+$/).optional(),
  nodePath: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(8).optional(),
})

export const noteCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  summary: z.string().max(2000).default(''),
  content: z.string().max(2_000_000),
  subjectSlug: z.string().regex(/^[a-z0-9-]+$/),
  nodePath: z.array(z.string().regex(/^[a-z0-9-]+$/)).min(1, '笔记必须归属于一个子菜单').max(8),
  isPrivate: z.boolean().default(true),
})

export const progressSchema = z.object({
  page: z.number().int().min(1).max(10_000),
  percent: z.number().min(0).max(100),
})

export const userCreateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  role: z.enum(['ADMIN', 'READER']).default('READER'),
})

export const subjectCreateSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().trim().min(1).max(100),
  shortTitle: z.string().trim().min(1).max(30),
  icon: z.string().trim().min(1).max(12),
  color: z.string().regex(/^[a-z0-9-]+$/).default('blue'),
  description: z.string().max(500).default(''),
})

export const nodeCreateSchema = z.object({
  subjectSlug: z.string().regex(/^[a-z0-9-]+$/),
  parentPath: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(8).default([]),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().trim().min(1).max(100),
  description: z.string().max(500).optional(),
})
