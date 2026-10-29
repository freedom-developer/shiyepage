import type { CatalogNode, PrismaClient, Resource, Subject } from '@prisma/client'
import type { AuthUser } from './auth.js'

type NodeWithRelations = CatalogNode & { children: NodeWithRelations[] }
interface CatalogNodeDto {
  id: string
  slug: string
  title: string
  description?: string
  children?: CatalogNodeDto[]
  entryIds?: string[]
}

function nodePath(nodeId: string | null, byId: Map<string, CatalogNode>): string[] {
  const path: string[] = []
  let current = nodeId ? byId.get(nodeId) : undefined
  while (current) {
    path.unshift(current.slug)
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return path
}

function buildTree(nodes: CatalogNode[], parentId: string | null): NodeWithRelations[] {
  return nodes
    .filter((node) => node.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title))
    .map((node) => ({ ...node, children: buildTree(nodes, node.id) }))
}

export function toCatalogNode(node: NodeWithRelations, resources: Resource[]): CatalogNodeDto {
  const entryIds = resources.filter((resource) => resource.nodeId === node.id).map((resource) => resource.id)
  return {
    id: node.id,
    slug: node.slug,
    title: node.title,
    description: node.description ?? undefined,
    children: node.children.length ? node.children.map((child) => toCatalogNode(child, resources)) : undefined,
    entryIds: entryIds.length ? entryIds : undefined,
  }
}

export function toLearningEntry(
  resource: Resource,
  subject: Subject,
  byId: Map<string, CatalogNode>,
  user?: AuthUser,
) {
  return {
    id: resource.id,
    title: resource.title,
    kind: resource.kind.toLowerCase() as 'note' | 'pdf' | 'chm',
    subjectSlug: subject.slug,
    topicPath: nodePath(resource.nodeId, byId),
    summary: resource.summary,
    isPrivate: resource.isPrivate,
    canEdit: Boolean(user && (user.role === 'ADMIN' || resource.ownerId === user.sub)),
    updatedAt: resource.updatedAt.toISOString().slice(0, 10),
    pdfPath: resource.kind === 'PDF' ? `/api/resources/${resource.id}/file` : undefined,
    filePath: ['PDF', 'CHM'].includes(resource.kind) ? `/api/resources/${resource.id}/file` : undefined,
    pages: resource.pageCount ?? undefined,
  }
}

export async function getCatalog(prisma: PrismaClient, user?: AuthUser) {
  const [subjects, nodes, resources] = await Promise.all([
    prisma.subject.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.catalogNode.findMany({ orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }] }),
    prisma.resource.findMany({
      where: user?.role === 'ADMIN' ? undefined : { OR: [{ isPrivate: false }, ...(user ? [{ ownerId: user.sub }] : [])] },
      orderBy: { updatedAt: 'desc' },
    }),
  ])
  return catalogResponse(subjects, nodes, resources, user)
}

function catalogResponse(subjects: Subject[], nodes: CatalogNode[], resources: Resource[], user?: AuthUser) {
  const byId = new Map(nodes.map((node) => [node.id, node]))

  return {
    subjects: subjects.map((subject) => ({
      slug: subject.slug,
      title: subject.title,
      shortTitle: subject.shortTitle,
      icon: subject.icon,
      color: subject.color,
      description: subject.description,
      nodes: buildTree(nodes.filter((node) => node.subjectId === subject.id), null).map((node) =>
        toCatalogNode(node, resources),
      ),
    })),
    entries: resources.map((resource) => {
      const subject = subjects.find((candidate) => candidate.id === resource.subjectId)
      return subject ? toLearningEntry(resource, subject, byId, user) : undefined
    }).filter((entry) => entry !== undefined),
  }
}

export async function getPublicCatalog(prisma: PrismaClient, ownerId: string) {
  const resources = await prisma.resource.findMany({
    where: { ownerId, isPrivate: false },
    orderBy: { updatedAt: 'desc' },
  })
  const subjectIds = [...new Set(resources.map((resource) => resource.subjectId))]
  const [subjects, nodes] = await Promise.all([
    prisma.subject.findMany({ where: { id: { in: subjectIds } }, orderBy: { sortOrder: 'asc' } }),
    prisma.catalogNode.findMany({ where: { subjectId: { in: subjectIds } } }),
  ])
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const visibleNodes = new Set<string>()
  for (const resource of resources) {
    let node = resource.nodeId ? byId.get(resource.nodeId) : undefined
    while (node && !visibleNodes.has(node.id)) {
      visibleNodes.add(node.id)
      node = node.parentId ? byId.get(node.parentId) : undefined
    }
  }
  // Only expose menus containing this account's public resources, and their ancestors.
  return catalogResponse(subjects, nodes.filter((node) => visibleNodes.has(node.id)), resources)
}

export async function findNodeByPath(
  prisma: PrismaClient,
  subjectId: string,
  path: string[],
) {
  let parentId: string | null = null
  let node: CatalogNode | null = null
  for (const slug of path) {
    node = await prisma.catalogNode.findFirst({ where: { subjectId, parentId, slug } })
    if (!node) return undefined
    parentId = node.id
  }
  return node ?? undefined
}
