import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { config } from './config.js'

const prisma = new PrismaClient()

const subjectSeeds = [
  {
    slug: 'computer', title: '计算机', shortTitle: '计算机', icon: '⌘', color: 'blue',
    description: '编程、系统与工程实践，持续积累可以复用的知识。',
    nodes: [
      { slug: 'programming', title: '编程语言', children: [
        { slug: 'typescript', title: 'TypeScript', description: '类型系统、语言特性与工程实践。', entryIds: ['ts-async'] },
        { slug: 'python', title: 'Python', description: '语法、工具链与常用代码片段。' },
      ] },
      { slug: 'computer-science', title: '计算机基础', children: [
        { slug: 'algorithms', title: '算法与数据结构', description: '复杂度分析、经典算法和数据结构.', entryIds: ['computer-book'] },
        { slug: 'operating-systems', title: '操作系统', description: '进程、内存、文件系统与并发。' },
      ] },
    ],
  },
  {
    slug: 'math', title: '数学', shortTitle: '数学', icon: '∑', color: 'violet',
    description: '从定义、推导到例题，把抽象概念整理成自己的语言。',
    nodes: [
      { slug: 'calculus', title: '微积分', children: [
        { slug: 'limits', title: '极限与连续', description: '极限的定义、计算方法和连续性。', entryIds: ['limits-note'] },
        { slug: 'derivatives', title: '导数与积分', description: '微分、积分及其应用。', entryIds: ['calculus-book'] },
      ] },
      { slug: 'linear-algebra', title: '线性代数', children: [
        { slug: 'vectors-matrices', title: '向量与矩阵', description: '线性组合、矩阵运算与线性变换。' },
        { slug: 'eigenvalues', title: '特征值与特征向量', description: '谱分解及其几何意义。' },
      ] },
    ],
  },
] as const

type NodeSeed = { slug: string; title: string; description?: string; children?: readonly NodeSeed[]; entryIds?: readonly string[] }

async function createNodes(subjectId: string, nodes: readonly NodeSeed[], parentId: string | null, resourceIds: Map<string, string>) {
  for (const [sortOrder, seed] of nodes.entries()) {
    const existing = await prisma.catalogNode.findFirst({ where: { subjectId, parentId, slug: seed.slug } })
    const node = existing ?? await prisma.catalogNode.create({
      data: { subjectId, parentId, slug: seed.slug, title: seed.title, description: seed.description, sortOrder },
    })
    for (const entryId of seed.entryIds ?? []) resourceIds.set(entryId, node.id)
    if (seed.children) await createNodes(subjectId, seed.children, node.id, resourceIds)
  }
}

async function main() {
  let admin = await prisma.user.findUnique({ where: { email: config.adminEmail.toLowerCase() } })
  if (!admin) {
    const passwordHash = await bcrypt.hash(config.adminPassword, 12)
    admin = await prisma.user.create({
      data: { email: config.adminEmail.toLowerCase(), passwordHash, role: 'ADMIN' },
    })
  }

  const resourceIds = new Map<string, string>()
  const subjectIds = new Map<string, string>()
  for (const [sortOrder, seed] of subjectSeeds.entries()) {
    const subject = await prisma.subject.upsert({
      where: { slug: seed.slug },
      update: {},
      create: {
        slug: seed.slug, title: seed.title, shortTitle: seed.shortTitle, icon: seed.icon,
        color: seed.color, description: seed.description, sortOrder,
      },
    })
    subjectIds.set(seed.slug, subject.id)
    await createNodes(subject.id, seed.nodes, null, resourceIds)
  }

  const noteFiles = [
    { id: 'ts-async', title: 'TypeScript 异步流程速记', subjectSlug: 'computer', summary: '整理 Promise、async/await 与错误处理的常用模式。', file: 'ts-async.md' },
    { id: 'limits-note', title: '数列极限与夹逼准则', subjectSlug: 'math', summary: '用定义和夹逼准则处理典型数列极限。', file: 'limits.md' },
  ]
  for (const note of noteFiles) {
    const content = await fs.readFile(new URL(`../content/notes/${note.file}`, import.meta.url), 'utf8')
    await prisma.resource.upsert({
      where: { id: note.id },
      update: {},
      create: {
        id: note.id, kind: 'NOTE', title: note.title, summary: note.summary,
        subjectId: subjectIds.get(note.subjectSlug)!, nodeId: resourceIds.get(note.id),
        content, searchText: `${note.title}\n${note.summary}\n${content}`,
        isPrivate: false, ownerId: admin.id,
      },
    })
  }
  const pdfSeeds = [
    { id: 'computer-book', title: '计算机基础参考书', subjectSlug: 'computer', summary: '上传 PDF 后可在站内阅读，PDF 文本会自动加入全文搜索。', updatedAt: new Date('2026-10-12') },
    { id: 'calculus-book', title: '微积分课程教材', subjectSlug: 'math', summary: '上传 PDF 后可在站内阅读，文件默认私有。', updatedAt: new Date('2026-10-10') },
  ]
  for (const pdf of pdfSeeds) {
    await prisma.resource.upsert({
      where: { id: pdf.id },
      update: {},
      create: {
        id: pdf.id, kind: 'PDF', title: pdf.title, summary: pdf.summary,
        subjectId: subjectIds.get(pdf.subjectSlug)!, nodeId: resourceIds.get(pdf.id),
        isPrivate: false, ownerId: admin.id, updatedAt: pdf.updatedAt,
      },
    })
  }
  console.log(`Seeded admin ${admin.email}; initial password comes from ADMIN_PASSWORD.`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
}).finally(async () => {
  await prisma.$disconnect()
})
