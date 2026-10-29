import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

test('注册、目录管理和私有资料权限', async (t) => {
  const testDir = mkdtempSync(path.join(tmpdir(), 'study-catalog-test-'))
  process.env.NODE_ENV = 'test'
  process.env.DATABASE_URL = `file:${path.join(testDir, 'test.db')}`
  process.env.STORAGE_DIR = path.join(testDir, 'storage')
  process.env.KERNEL_SOURCE_DIR = path.join(testDir, 'kernel-source')
  process.env.JWT_SECRET = 'catalog-integration-test-secret'
  execFileSync(process.execPath, ['--import', 'tsx', 'src/sqlite-setup.ts'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: process.env,
    stdio: 'pipe',
  })
  const { buildApp, prisma } = await import('../src/index.js')
  const app = await buildApp()
  app.log.level = 'silent'
  t.after(async () => {
    await app.close()
    await prisma.$disconnect()
    rmSync(testDir, { recursive: true, force: true })
  })

  const subject = { slug: 'physics', title: '物理', shortTitle: '物理', icon: '∑' }
  let token: string
  let otherToken: string
  let rootId: string
  let noteId: string

  await t.test('未登录不能新增或删除学科和菜单', async () => {
    for (const [method, url, payload] of [
      ['POST', '/api/admin/subjects', subject],
      ['DELETE', '/api/admin/subjects/physics', undefined],
      ['POST', '/api/admin/nodes', { subjectSlug: 'physics', slug: 'mechanics', title: '力学' }],
      ['DELETE', '/api/admin/nodes/missing', undefined],
    ] as const) {
      const response = await app.inject({ method, url, payload })
      assert.equal(response.statusCode, 401)
    }
  })

  await t.test('注册校验密码、拒绝重复邮箱并以普通用户自动登录', async () => {
    const weak = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: 'learner@example.com', password: '123' } })
    assert.equal(weak.statusCode, 400)
    const registration = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: 'Learner@example.com', password: 'test-password-123', role: 'ADMIN' } })
    assert.equal(registration.statusCode, 201)
    const result = registration.json()
    token = result.token
    assert.equal(result.user.email, 'learner@example.com')
    assert.equal(result.user.role, 'READER')
    assert.equal(result.user.passwordHash, undefined)
    const duplicate = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: 'learner@example.com', password: 'test-password-123' } })
    assert.equal(duplicate.statusCode, 409)
    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { authorization: `Bearer ${token}` } })
    assert.equal(me.statusCode, 200)
  })

  await t.test('注册账号可以正常登录，但不能管理用户', async () => {
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'learner@example.com', password: 'test-password-123' } })
    assert.equal(login.statusCode, 200)
    const denied = await app.inject({ method: 'GET', url: '/api/admin/users', headers: { authorization: `Bearer ${token}` } })
    assert.equal(denied.statusCode, 403)
  })

  await t.test('普通用户可以添加学科和多级菜单，拒绝同级重名链接', async () => {
    const headers = { authorization: `Bearer ${token}` }
    const created = await app.inject({ method: 'POST', url: '/api/admin/subjects', headers, payload: subject })
    assert.equal(created.statusCode, 201)
    const duplicate = await app.inject({ method: 'POST', url: '/api/admin/subjects', headers, payload: subject })
    assert.equal(duplicate.statusCode, 409)
    const rootPayload = { subjectSlug: 'physics', slug: 'mechanics', title: '力学' }
    const root = await app.inject({ method: 'POST', url: '/api/admin/nodes', headers, payload: rootPayload })
    assert.equal(root.statusCode, 201)
    rootId = root.json().node.id
    const duplicateRoot = await app.inject({ method: 'POST', url: '/api/admin/nodes', headers, payload: rootPayload })
    assert.equal(duplicateRoot.statusCode, 409)
    const child = await app.inject({ method: 'POST', url: '/api/admin/nodes', headers, payload: { ...rootPayload, slug: 'newton', title: '牛顿定律', parentPath: ['mechanics'] } })
    assert.equal(child.statusCode, 201)
    const catalog = await app.inject({ method: 'GET', url: '/api/catalog', headers })
    assert.equal(catalog.json().subjects[0].nodes[0].id, rootId)
    assert.equal(catalog.json().subjects[0].nodes[0].children[0].title, '牛顿定律')
  })

  await t.test('新注册用户不能在目录或搜索中看到其他人的私有笔记', async () => {
    const note = await app.inject({ method: 'POST', url: '/api/resources/note', headers: { authorization: `Bearer ${token}` }, payload: { subjectSlug: 'physics', nodePath: ['mechanics', 'newton'], title: '私有力学笔记', content: '# private-needle', isPrivate: true } })
    assert.equal(note.statusCode, 201)
    noteId = note.json().resource.id
    const other = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: 'other@example.com', password: 'test-password-456' } })
    otherToken = other.json().token
    for (const headers of [{}, { authorization: `Bearer ${otherToken}` }]) {
      const catalog = await app.inject({ method: 'GET', url: '/api/catalog', headers })
      assert.equal(catalog.json().entries.length, 0)
      const search = await app.inject({ method: 'GET', url: '/api/search?q=private-needle', headers })
      assert.equal(search.json().results.length, 0)
      const resource = await app.inject({ method: 'GET', url: `/api/resources/${noteId}`, headers })
      assert.equal(resource.statusCode, 401)
    }
    const ownerSearch = await app.inject({ method: 'GET', url: '/api/search?q=private-needle', headers: { authorization: `Bearer ${token}` } })
    assert.equal(ownerSearch.json().results[0].id, noteId)
  })

  await t.test('笔记管理元数据、编辑索引和资源权限正确', async () => {
    const ownerHeaders = { authorization: `Bearer ${token}` }
    const otherHeaders = { authorization: `Bearer ${otherToken}` }
    const missingNode = await app.inject({ method: 'POST', url: '/api/resources/note', headers: ownerHeaders, payload: { subjectSlug: 'physics', title: '缺少菜单的笔记', content: 'invalid' } })
    assert.equal(missingNode.statusCode, 400)
    const created = await app.inject({
      method: 'POST',
      url: '/api/resources/note',
      headers: ownerHeaders,
      payload: {
        subjectSlug: 'physics',
        nodePath: ['mechanics'],
        title: '待管理笔记',
        summary: '初始摘要',
        content: '# old-index-needle',
      },
    })
    assert.equal(created.statusCode, 201)
    const managedId = created.json().resource.id

    const missingNodePatch = await app.inject({
      method: 'PATCH',
      url: `/api/resources/${managedId}`,
      headers: ownerHeaders,
      payload: { subjectSlug: 'physics' },
    })
    assert.equal(missingNodePatch.statusCode, 400)

    const catalogBefore = await app.inject({ method: 'GET', url: '/api/catalog', headers: ownerHeaders })
    const entryBefore = catalogBefore.json().entries.find((entry: { id: string }) => entry.id === managedId)
    assert.deepEqual({
      isPrivate: entryBefore.isPrivate,
      canEdit: entryBefore.canEdit,
      topicPath: entryBefore.topicPath,
    }, { isPrivate: true, canEdit: true, topicPath: ['mechanics'] })

    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/resources/${managedId}`,
      headers: ownerHeaders,
      payload: {
        title: '已更新笔记',
        summary: '更新后的摘要',
        content: '# new-index-needle',
        nodePath: ['mechanics', 'newton'],
        isPrivate: true,
      },
    })
    assert.equal(patched.statusCode, 200)
    assert.equal(patched.json().resource.title, '已更新笔记')
    assert.equal(patched.json().resource.isPrivate, true)

    const catalogAfter = await app.inject({ method: 'GET', url: '/api/catalog', headers: ownerHeaders })
    const entryAfter = catalogAfter.json().entries.find((entry: { id: string }) => entry.id === managedId)
    assert.deepEqual({
      title: entryAfter.title,
      summary: entryAfter.summary,
      topicPath: entryAfter.topicPath,
      canEdit: entryAfter.canEdit,
    }, { title: '已更新笔记', summary: '更新后的摘要', topicPath: ['mechanics', 'newton'], canEdit: true })
    const updatedSearch = await app.inject({ method: 'GET', url: '/api/search?q=new-index-needle', headers: ownerHeaders })
    assert.equal(updatedSearch.json().results[0].id, managedId)
    const staleSearch = await app.inject({ method: 'GET', url: '/api/search?q=old-index-needle', headers: ownerHeaders })
    assert.equal(staleSearch.json().results.length, 0)

    const otherResource = await app.inject({ method: 'GET', url: `/api/resources/${managedId}`, headers: otherHeaders })
    assert.equal(otherResource.statusCode, 401)
    const otherDelete = await app.inject({ method: 'DELETE', url: `/api/resources/${managedId}`, headers: otherHeaders })
    assert.equal(otherDelete.statusCode, 403)
    const otherPatch = await app.inject({ method: 'PATCH', url: `/api/resources/${managedId}`, headers: otherHeaders, payload: { title: '非法修改' } })
    assert.equal(otherPatch.statusCode, 403)

    const admin = await prisma.user.create({ data: { email: 'manager@example.com', passwordHash: 'unused-test-hash', role: 'ADMIN' } })
    const adminHeaders = { authorization: `Bearer ${app.jwt.sign({ sub: admin.id, email: admin.email, role: admin.role })}` }
    const adminCatalog = await app.inject({ method: 'GET', url: '/api/catalog', headers: adminHeaders })
    assert.equal(adminCatalog.json().entries.find((entry: { id: string }) => entry.id === managedId).canEdit, true)
    const publish = await app.inject({ method: 'PATCH', url: `/api/resources/${managedId}`, headers: ownerHeaders, payload: { isPrivate: false } })
    assert.equal(publish.statusCode, 200)
    const otherCatalog = await app.inject({ method: 'GET', url: '/api/catalog', headers: otherHeaders })
    const publicEntry = otherCatalog.json().entries.find((entry: { id: string }) => entry.id === managedId)
    assert.equal(publicEntry.isPrivate, false)
    assert.equal(publicEntry.canEdit, false)
    const publicResource = await app.inject({ method: 'GET', url: `/api/resources/${managedId}`, headers: otherHeaders })
    assert.equal(publicResource.statusCode, 200)
    assert.equal(publicResource.json().canEdit, false)
    const deleted = await app.inject({ method: 'DELETE', url: `/api/resources/${managedId}`, headers: ownerHeaders })
    assert.equal(deleted.statusCode, 200)
    const missing = await app.inject({ method: 'GET', url: `/api/resources/${managedId}`, headers: ownerHeaders })
    assert.equal(missing.statusCode, 404)
  })

  await t.test('公开个人主页按账号隔离资料，匿名只读并在取消公开后立即拒绝访问', async () => {
    const ownerHeaders = { authorization: `Bearer ${token}` }
    const otherHeaders = { authorization: `Bearer ${otherToken}` }
    const base = '/api/public/learner%40example.com'
    const createdSubject = await app.inject({ method: 'POST', url: '/api/admin/subjects', headers: ownerHeaders, payload: { ...subject, slug: 'public-demo', title: '公开学科' } })
    assert.equal(createdSubject.statusCode, 201)
    for (const node of [
      { slug: 'systems', title: '系统' },
      { slug: 'vfs', title: 'VFS', parentPath: ['systems'] },
      { slug: 'drafts', title: '私人草稿目录' },
    ]) {
      const response = await app.inject({ method: 'POST', url: '/api/admin/nodes', headers: ownerHeaders, payload: { subjectSlug: 'public-demo', ...node } })
      assert.equal(response.statusCode, 201)
    }
    const createNote = (headers: Record<string, string>, title: string, nodePath: string[], isPrivate?: boolean) => app.inject({
      method: 'POST', url: '/api/resources/note', headers,
      payload: { subjectSlug: 'public-demo', nodePath, title, content: `# ${title}\n\n正文与公式 $x^2$`, ...(isPrivate === undefined ? {} : { isPrivate }) },
    })
    const published = await createNote(ownerHeaders, '公开 VFS 笔记', ['systems', 'vfs'], false)
    assert.equal(published.statusCode, 201)
    assert.equal(published.json().resource.isPrivate, false)
    const publishedId = published.json().resource.id
    const draft = await createNote(ownerHeaders, '私密草稿', ['drafts'])
    assert.equal(draft.json().resource.isPrivate, true)
    const draftId = draft.json().resource.id
    const other = await createNote(otherHeaders, '其他人的公开笔记', ['systems', 'vfs'], false)
    const otherId = other.json().resource.id

    // Exercise upload, the account-scoped PDF stream, and its visibility checks together.
    const boundary = 'public-profile-pdf-boundary'
    const pdfBody = '%PDF-1.4\n%%EOF'
    const fields = { title: '公开电子书', subjectSlug: 'public-demo', nodePath: '["systems","vfs"]', isPrivate: 'false' }
    const multipart = [
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="public.pdf"\r\nContent-Type: application/pdf\r\n\r\n${pdfBody}\r\n`,
      ...Object.entries(fields).map(([name, value]) => `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`),
      `--${boundary}--\r\n`,
    ].join('')
    const uploaded = await app.inject({ method: 'POST', url: '/api/resources/upload', headers: { ...ownerHeaders, 'content-type': `multipart/form-data; boundary=${boundary}` }, payload: multipart })
    assert.equal(uploaded.statusCode, 201)
    assert.equal(uploaded.json().resource.isPrivate, false)
    const pdfId = uploaded.json().resource.id
    const chmBoundary = 'public-profile-chm-boundary'
    const chmBody = 'ITSF test archive body'
    const chmFields = { title: '公开帮助文档', subjectSlug: 'public-demo', nodePath: '["systems","vfs"]', isPrivate: 'false' }
    const chmMultipart = [
      `--${chmBoundary}\r\nContent-Disposition: form-data; name="file"; filename="public.chm"\r\nContent-Type: application/vnd.ms-htmlhelp\r\n\r\n${chmBody}\r\n`,
      ...Object.entries(chmFields).map(([name, value]) => `--${chmBoundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`),
      `--${chmBoundary}--\r\n`,
    ].join('')
    const uploadedChm = await app.inject({ method: 'POST', url: '/api/resources/upload', headers: { ...ownerHeaders, 'content-type': `multipart/form-data; boundary=${chmBoundary}` }, payload: chmMultipart })
    assert.equal(uploadedChm.statusCode, 201)
    assert.equal(uploadedChm.json().resource.kind, 'chm')
    const chmId = uploadedChm.json().resource.id
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'manager@example.com' } })
    const adminHeaders = { authorization: `Bearer ${app.jwt.sign({ sub: admin.id, email: admin.email, role: admin.role })}` }

    for (const headers of [{}, ownerHeaders, otherHeaders, adminHeaders]) {
      const response = await app.inject({ method: 'GET', url: base, headers })
      assert.equal(response.statusCode, 200)
      const page = response.json()
      assert.deepEqual(page.profile, { account: 'learner@example.com' })
      assert.deepEqual(page.entries.map((entry: { id: string }) => entry.id).sort(), [publishedId, pdfId, chmId].sort())
      assert.ok(page.entries.every((entry: { canEdit: boolean; isPrivate: boolean }) => !entry.canEdit && !entry.isPrivate))
      assert.equal(page.subjects.length, 1)
      assert.equal(page.subjects[0].slug, 'public-demo')
      assert.equal(page.subjects[0].nodes.length, 1)
      assert.equal(page.subjects[0].nodes[0].slug, 'systems')
      assert.equal(page.subjects[0].nodes[0].children[0].slug, 'vfs')
      assert.ok(!response.body.includes(draftId))
      assert.ok(!response.body.includes(otherId))
      assert.ok(!response.body.includes('私人草稿目录'))
      const note = await app.inject({ method: 'GET', url: `${base}/resources/${publishedId}`, headers })
      assert.equal(note.statusCode, 200)
      assert.equal(note.json().canEdit, false)
      assert.ok(note.json().resource.content.includes('公开 VFS 笔记'))
      assert.equal(note.json().progress, undefined)
      assert.equal(note.json().resource.storagePath, undefined)
      for (const id of [draftId, otherId]) {
        const hidden = await app.inject({ method: 'GET', url: `${base}/resources/${id}`, headers })
        assert.equal(hidden.statusCode, 404)
        const hiddenFile = await app.inject({ method: 'GET', url: `${base}/resources/${id}/file`, headers })
        assert.equal(hiddenFile.statusCode, 404)
      }
    }
    const file = await app.inject({ method: 'GET', url: `${base}/resources/${pdfId}/file` })
    assert.equal(file.statusCode, 200)
    assert.equal(file.headers['content-type'], 'application/pdf')
    assert.equal(file.body, pdfBody)
    const chmFile = await app.inject({ method: 'GET', url: `${base}/resources/${chmId}/file` })
    assert.equal(chmFile.statusCode, 200)
    assert.equal(chmFile.headers['content-type'], 'application/vnd.ms-htmlhelp')
    assert.equal(chmFile.body, chmBody)
    const wrongFile = await app.inject({ method: 'GET', url: `/api/public/other%40example.com/resources/${pdfId}/file` })
    assert.equal(wrongFile.statusCode, 404)
    const wrongChmFile = await app.inject({ method: 'GET', url: `/api/public/other%40example.com/resources/${chmId}/file` })
    assert.equal(wrongChmFile.statusCode, 404)
    const otherPage = await app.inject({ method: 'GET', url: '/api/public/other%40example.com' })
    assert.deepEqual(otherPage.json().entries.map((entry: { id: string }) => entry.id), [otherId])
    const missingProfile = await app.inject({ method: 'GET', url: '/api/public/missing%40example.com' })
    assert.equal(missingProfile.statusCode, 404)
    const mixedCase = await app.inject({ method: 'GET', url: '/api/public/LEARNER%40example.com' })
    assert.equal(mixedCase.statusCode, 200)
    for (const method of ['POST', 'PATCH', 'DELETE'] as const) {
      const mutation = await app.inject({ method, url: `${base}/resources/${publishedId}`, headers: ownerHeaders, payload: {} })
      assert.equal(mutation.statusCode, 404)
    }
    const unauthorizedPublish = await app.inject({ method: 'PATCH', url: `/api/resources/${draftId}`, headers: otherHeaders, payload: { isPrivate: false } })
    assert.equal(unauthorizedPublish.statusCode, 403)
    const anonymousEdit = await app.inject({ method: 'PATCH', url: `/api/resources/${publishedId}`, payload: { content: '非法修改' } })
    assert.equal(anonymousEdit.statusCode, 401)

    for (const id of [publishedId, pdfId, chmId]) {
      const unpublish = await app.inject({ method: 'PATCH', url: `/api/resources/${id}`, headers: ownerHeaders, payload: { isPrivate: true } })
      assert.equal(unpublish.statusCode, 200)
      for (const suffix of ['', '/file']) {
        const revoked = await app.inject({ method: 'GET', url: `${base}/resources/${id}${suffix}`, headers: ownerHeaders })
        assert.equal(revoked.statusCode, 404)
      }
    }
    const emptyPage = await app.inject({ method: 'GET', url: base })
    assert.deepEqual(emptyPage.json(), { profile: { account: 'learner@example.com' }, subjects: [], entries: [] })

    for (const [id, headers] of [[publishedId, ownerHeaders], [draftId, ownerHeaders], [pdfId, ownerHeaders], [chmId, ownerHeaders], [otherId, otherHeaders]] as const) {
      const deleted = await app.inject({ method: 'DELETE', url: `/api/resources/${id}`, headers })
      assert.equal(deleted.statusCode, 200)
    }
    const removedSubject = await app.inject({ method: 'DELETE', url: '/api/admin/subjects/public-demo', headers: ownerHeaders })
    assert.equal(removedSubject.statusCode, 200)
  })

  await t.test('含笔记的父菜单不能直接删除，移动笔记后才可删除', async () => {
    const headers = { authorization: `Bearer ${token}` }
    await app.inject({ method: 'PUT', url: `/api/resources/${noteId}/progress`, headers, payload: { page: 2, percent: 25 } })
    const blocked = await app.inject({ method: 'DELETE', url: `/api/admin/nodes/${rootId}`, headers })
    assert.equal(blocked.statusCode, 409)
    const safeMenu = await app.inject({ method: 'POST', url: '/api/admin/nodes', headers, payload: { subjectSlug: 'physics', slug: 'safe-menu', title: '安全归档' } })
    assert.equal(safeMenu.statusCode, 201)
    const moved = await app.inject({ method: 'PATCH', url: `/api/resources/${noteId}`, headers, payload: { nodePath: ['safe-menu'] } })
    assert.equal(moved.statusCode, 200)
    const removed = await app.inject({ method: 'DELETE', url: `/api/admin/nodes/${rootId}`, headers })
    assert.equal(removed.statusCode, 200)
    const catalog = await app.inject({ method: 'GET', url: '/api/catalog', headers })
    assert.equal(catalog.json().subjects[0].nodes.length, 1)
    assert.deepEqual(catalog.json().entries[0].topicPath, ['safe-menu'])
    const resource = await app.inject({ method: 'GET', url: `/api/resources/${noteId}`, headers })
    assert.equal(resource.json().resource.content, '# private-needle')
    assert.equal(resource.json().progress.percent, 25)
  })

  await t.test('有资料的学科需指定其他学科，避免丢失资料', async () => {
    const headers = { authorization: `Bearer ${token}` }
    const blocked = await app.inject({ method: 'DELETE', url: '/api/admin/subjects/physics', headers })
    assert.equal(blocked.statusCode, 409)
    const self = await app.inject({ method: 'DELETE', url: '/api/admin/subjects/physics?moveTo=physics', headers })
    assert.equal(self.statusCode, 409)
    const missing = await app.inject({ method: 'DELETE', url: '/api/admin/subjects/physics?moveTo=missing', headers })
    assert.equal(missing.statusCode, 409)
    const existing = await app.inject({ method: 'GET', url: `/api/resources/${noteId}`, headers })
    assert.equal(existing.statusCode, 200)
  })

  await t.test('删除学科时迁移资料，并保留笔记正文和阅读进度', async () => {
    const headers = { authorization: `Bearer ${token}` }
    const target = await app.inject({ method: 'POST', url: '/api/admin/subjects', headers, payload: { ...subject, slug: 'archive', title: '归档' } })
    assert.equal(target.statusCode, 201)
    const removed = await app.inject({ method: 'DELETE', url: '/api/admin/subjects/physics?moveTo=archive', headers })
    assert.equal(removed.statusCode, 200)
    const catalog = await app.inject({ method: 'GET', url: '/api/catalog', headers })
    assert.equal(catalog.json().subjects.length, 1)
    assert.equal(catalog.json().entries[0].subjectSlug, 'archive')
    assert.deepEqual(catalog.json().entries[0].topicPath, ['uncategorized'])
    const existing = await app.inject({ method: 'GET', url: `/api/resources/${noteId}`, headers })
    assert.equal(existing.json().resource.content, '# private-needle')
    assert.equal(existing.json().progress.percent, 25)
  })

  await t.test('可以删除最后一个空学科，目录正确返回空数组', async () => {
    const headers = { authorization: `Bearer ${token}` }
    await app.inject({ method: 'DELETE', url: `/api/resources/${noteId}`, headers })
    const removed = await app.inject({ method: 'DELETE', url: '/api/admin/subjects/archive', headers })
    assert.equal(removed.statusCode, 200)
    const catalog = await app.inject({ method: 'GET', url: '/api/catalog', headers })
    assert.deepEqual(catalog.json(), { subjects: [], entries: [] })
  })
})
