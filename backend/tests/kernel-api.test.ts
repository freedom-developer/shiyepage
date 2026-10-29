import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

test('Linux Kernel API exposes guarded tag search, directories, files, and definition navigation', async (t) => {
  const testDir = await mkdtemp(path.join(os.tmpdir(), 'study-kernel-api-test-'))
  const sourceRoot = path.join(testDir, 'linux-6.8')
  await mkdir(path.join(sourceRoot, 'arch', 'x86'), { recursive: true })
  const sourceLines = [...Array.from({ length: 300 }, (_value, index) => `/* padding ${index + 1} */`), 'int schedule(void) {', '    return 6;', '}']
  await writeFile(path.join(sourceRoot, 'arch', 'x86', 'entry.c'), `${sourceLines.join('\n')}\n`)
  await writeFile(path.join(sourceRoot, 'tags'), [
    '!_TAG_FILE_SORTED\t1\t/0=unsorted, 1=sorted, 2=foldcase/\n',
    'open_how\tinclude/uapi/linux/openat2.h\t/^struct open_how {$/;"\ts\n',
    'path_init\tdrivers/interconnect/core.c\t/^static struct icc_path *path_init(struct device *dev, struct icc_node *dst,$/;"\tf\n',
    'path_init\tfs/namei.c\t/^static const char *path_init(struct nameidata *nd, unsigned flags)$/;"\tf\n',
    'schedule\tarch/x86/entry.c\t/^int schedule(void) {$/;" f\n',
    'set_nameidata\tfs/namei.c\t/^static inline void set_nameidata(struct nameidata *p, int dfd, struct filename *name,$/;"\tf\n',
  ].join(''))
  process.env.NODE_ENV = 'test'
  process.env.DATABASE_URL = `file:${path.join(testDir, 'test.db')}`
  process.env.STORAGE_DIR = path.join(testDir, 'storage')
  process.env.KERNEL_SOURCE_DIR = sourceRoot
  process.env.JWT_SECRET = 'kernel-api-integration-test-secret'
  execFileSync(process.execPath, ['--import', 'tsx', 'src/sqlite-setup.ts'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: process.env,
    stdio: 'pipe',
  })
  const { PrismaClient } = await import('@prisma/client')
  const setupPrisma = new PrismaClient()
  const computer = await setupPrisma.subject.create({
    data: {
      slug: 'computer', title: '计算机', shortTitle: '计算机', icon: '⌘', color: 'blue', description: '计算机知识。',
      nodes: { create: { slug: 'linux-kernel', title: 'Linux Kernel', sortOrder: 0 } },
    },
  })
  await setupPrisma['$' + 'disconnect']()
  const { buildApp, prisma } = await import('../src/index.js')
  const app = await buildApp()
  app.log.level = 'silent'
  t.after(async () => {
    await app.close()
    await prisma.$disconnect()
    await rm(testDir, { recursive: true, force: true })
  })

  for (const url of [
    '/api/kernel/linux-6.8/tags?q=schedule',
    '/api/kernel/linux-6.8/directory',
    '/api/kernel/linux-6.8/file?path=arch%2Fx86%2Fentry.c',
  ]) {
    assert.equal((await app.inject({ method: 'GET', url })).statusCode, 401)
  }
  assert.equal((await app.inject({ method: 'POST', url: '/api/kernel/linux-6.8/tags/lookup', payload: { references: [{ name: 'schedule', kind: 'function' }] } })).statusCode, 401)

  const registration = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: 'kernel-reader@example.com', password: 'test-password-789' },
  })
  assert.equal(registration.statusCode, 201)
  const headers = { authorization: `Bearer ${registration.json().token}` }

  const catalog = await app.inject({ method: 'GET', url: '/api/catalog', headers })
  const kernel = catalog.json().subjects.find((subject: { slug: string }) => subject.slug === 'linux-kernel')
  assert.equal(kernel.title, 'Linux Kernel')
  assert.equal(kernel.nodes[0].title, 'Linux-6.8')
  assert.equal(kernel.nodes[0].children[0].title, 'arch')
  const computerCatalog = catalog.json().subjects.find((subject: { slug: string }) => subject.slug === computer.slug)
  const existingKernelMenu = computerCatalog.nodes.find((node: { slug: string }) => node.slug === 'linux-kernel')
  assert.equal(existingKernelMenu.children[0].title, 'Linux-6.8')
  assert.equal(existingKernelMenu.children[0].children[0].title, 'arch')

  const rootDirectory = await app.inject({ method: 'GET', url: '/api/kernel/linux-6.8/directory', headers })
  assert.ok(rootDirectory.json().entries.some((entry: { path: string }) => entry.path === 'arch'))
  const directory = await app.inject({ method: 'GET', url: '/api/kernel/linux-6.8/directory?path=arch%2Fx86', headers })
  assert.equal(directory.json().entries[0].name, 'entry.c')
  const unsafeDirectory = await app.inject({ method: 'GET', url: '/api/kernel/linux-6.8/directory?path=..%2Foutside', headers })
  assert.equal(unsafeDirectory.statusCode, 400)

  const search = await app.inject({ method: 'GET', url: '/api/kernel/linux-6.8/tags?q=schedule', headers })
  assert.equal(search.statusCode, 200)
  assert.equal(search.json().results.length, 1, JSON.stringify(search.json()))
  const tag = search.json().results[0]
  assert.equal(tag.name, 'schedule')
  const lookup = await app.inject({ method: 'POST', url: '/api/kernel/linux-6.8/tags/lookup', headers, payload: { references: [{ name: 'schedule', kind: 'function' }, { name: 'open_how', kind: 'struct' }, { name: 'missing_symbol', kind: 'function' }] } })
  assert.equal(lookup.statusCode, 200)
  assert.equal(lookup.json().symbols.schedule.file, 'arch/x86/entry.c')
  assert.equal(lookup.json().symbols.open_how.file, 'include/uapi/linux/openat2.h')
  assert.equal(lookup.json().symbols.missing_symbol, undefined)
  const noteReferences = [
    ['open_how', 'struct'], ['open_flags', 'struct'], ['filename', 'struct'], ['file', 'struct'],
    ['open', 'function'], ['do_sys_open', 'function'], ['build_open_how', 'function'],
    ['do_sys_openat', 'function'], ['build_open_flags', 'function'], ['getname', 'function'],
    ['get_unused_fd_flags', 'function'], ['do_file_open', 'function'], ['fd_install', 'function'],
    ['path_init', 'function'], ['set_nameidata', 'function'],
  ].map(([name, kind]) => ({ name, kind }))
  const noteLookup = await app.inject({
    method: 'POST',
    url: '/api/kernel/linux-6.8/tags/lookup',
    headers,
    payload: { references: noteReferences },
  })
  assert.equal(noteLookup.statusCode, 200, JSON.stringify(noteLookup.json()))
  assert.equal(noteLookup.json().symbols.path_init.file, 'fs/namei.c')
  const invalidLookup = await app.inject({ method: 'POST', url: '/api/kernel/linux-6.8/tags/lookup', headers, payload: { references: [{ name: 'not valid', kind: 'function' }] } })
  assert.equal(invalidLookup.statusCode, 400)
  const sourceQuery = new URLSearchParams({ file: tag.file, name: tag.name, address: tag.address })
  const source = await app.inject({ method: 'GET', url: `/api/kernel/linux-6.8/source?${sourceQuery}`, headers })
  assert.equal(source.statusCode, 200)
  assert.equal(source.json().line, 301)
  assert.equal(source.json().startLine, 1)
  assert.equal(source.json().lines.length, 303)
  assert.match(source.json().lines[300], /int schedule/)
  assert.equal(source.json().lines[302], '}')
  assert.equal(source.json().symbols.schedule.name, 'schedule')

  const fileQuery = new URLSearchParams({ path: tag.file })
  const file = await app.inject({ method: 'GET', url: `/api/kernel/linux-6.8/file?${fileQuery}`, headers })
  assert.equal(file.statusCode, 200)
  assert.equal(file.json().startLine, 1)
  assert.equal(file.json().lines.length, 303)
  assert.equal(file.json().lines[302], '}')

  const unsafeQuery = new URLSearchParams({ file: '../outside.c', name: 'schedule', address: tag.address })
  const unsafe = await app.inject({ method: 'GET', url: `/api/kernel/linux-6.8/source?${unsafeQuery}`, headers })
  assert.equal(unsafe.statusCode, 404)
})
