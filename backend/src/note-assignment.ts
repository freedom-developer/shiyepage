import type { Prisma, PrismaClient } from '@prisma/client'

export async function archiveNode(tx: Prisma.TransactionClient, subjectId: string) {
  const existing = await tx.catalogNode.findFirst({ where: { subjectId, parentId: null, slug: 'uncategorized' } })
  if (existing) return existing
  const last = await tx.catalogNode.aggregate({ where: { subjectId, parentId: null }, _max: { sortOrder: true } })
  return tx.catalogNode.create({
    data: {
      subjectId, slug: 'uncategorized', title: '未分类',
      description: '历史笔记和迁移笔记，可在编辑笔记时重新归类。',
      sortOrder: (last._max.sortOrder ?? -1) + 1,
    },
  })
}

// Run once at startup to preserve old notes while enforcing submenu membership.
export async function ensureNoteAssignments(prisma: PrismaClient) {
  await prisma.$transaction(async (tx) => {
    const unassigned = await tx.resource.findMany({
      where: { kind: 'NOTE', nodeId: null }, select: { subjectId: true }, distinct: ['subjectId'],
    })
    for (const { subjectId } of unassigned) {
      const node = await archiveNode(tx, subjectId)
      await tx.resource.updateMany({
        where: { kind: 'NOTE', subjectId, nodeId: null }, data: { nodeId: node.id },
      })
    }
  })
}
