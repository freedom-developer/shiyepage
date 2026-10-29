import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { findKernelTag, readKernelDirectory, readKernelSourceFile, readKernelSourceFileByPath, searchKernelTags } from '../src/kernel-tags.js'

test('sorted ctags support exact and prefix lookup with definition navigation', async (t) => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'kernel-tags-test-'))
  const sourceRoot = path.join(tempDir, 'linux-6.8')
  await mkdir(path.join(sourceRoot, 'kernel'), { recursive: true })
  await writeFile(path.join(sourceRoot, 'kernel', 'a.c'), '#include <linux/init.h>\nint alpha(void) {\n    return 1;\n}\nstruct node *proc_mkdir(const char *name,\n    void *parent) {\n    return parent;\n}\n')
  await writeFile(path.join(sourceRoot, 'kernel', 'b.c'), 'void alpha(void) {\n}\n')
  await writeFile(path.join(tempDir, 'outside.c'), 'int secret(void) {\n}\n')
  const tagsFile = path.join(sourceRoot, 'tags')
  await writeFile(tagsFile, [
    '!_TAG_FILE_SORTED\t1\t/0=unsorted, 1=sorted, 2=foldcase/',
    'alpha\tkernel/a.c\t/^int alpha(void) {$/;" f',
    'alpha\tkernel/b.c\t/^void alpha(void) {$/;" f',
    'alphabet\tkernel/a.c\t/^int alpha(void) {$/;" f',
    'beta\tkernel/a.c\t/^int alpha(void) {$/;" f',
    'proc_mkdir\tkernel/a.c\t/^struct node *proc_mkdir(const char *name,$/;" f',
    '',
  ].join('\n'))
  t.after(() => rm(tempDir, { recursive: true, force: true }))

  const exact = await searchKernelTags(tagsFile, 'alpha')
  assert.equal(exact.matchMode, 'exact')
  assert.equal(exact.results.length, 2)
  assert.equal(exact.results[0]?.kind, 'f')
  assert.deepEqual(exact.results.map((tag) => tag.file), ['kernel/a.c', 'kernel/b.c'])
  assert.deepEqual(await findKernelTag(tagsFile, 'alpha', 'kernel/b.c', exact.results[1]!.address), exact.results[1])
  assert.equal(await findKernelTag(tagsFile, 'alpha', '../outside.c', exact.results[0]!.address), undefined)

  const secondPage = await searchKernelTags(tagsFile, 'alpha', 1, 1)
  assert.equal(secondPage.results.length, 1)
  assert.equal(secondPage.results[0]?.file, 'kernel/b.c')
  assert.equal(secondPage.hasMore, false)

  const prefix = await searchKernelTags(tagsFile, 'alph')
  assert.equal(prefix.matchMode, 'prefix')
  assert.equal(prefix.results.length, 3)

  const source = await readKernelSourceFile(sourceRoot, 'kernel/a.c', 'alpha', exact.results[0]!.address)
  assert.equal(source.line, 2)
  assert.equal(source.startLine, 1)
  assert.equal(source.lines.length, 8)
  assert.match(source.lines[source.line - source.startLine] ?? '', /int alpha/)
  const pointerDefinition = await readKernelSourceFile(sourceRoot, 'kernel/a.c', 'proc_mkdir', '/^struct node *proc_mkdir(const char *name,$/')
  assert.equal(pointerDefinition.line, 5)
  assert.equal(pointerDefinition.lines.length, 8)
  assert.match(pointerDefinition.lines[pointerDefinition.line - pointerDefinition.startLine] ?? '', /\*proc_mkdir/)
  const fullFile = await readKernelSourceFileByPath(sourceRoot, 'kernel/a.c')
  assert.equal(fullFile.lines.length, 8)
  const directory = await readKernelDirectory(sourceRoot, 'kernel')
  assert.deepEqual(directory.entries.map((entry) => entry.name), ['a.c', 'b.c'])
  await assert.rejects(readKernelSourceFile(sourceRoot, '../outside.c', 'secret', '/^int secret\(void\) {$/'), /超出 Linux-6.8 目录/)
  await assert.rejects(readKernelDirectory(sourceRoot, '../'), /无效的源码路径/)
})
