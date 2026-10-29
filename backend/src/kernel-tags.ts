import { createReadStream } from 'node:fs'
import { open, realpath, readdir } from 'node:fs/promises'
import path from 'node:path'
import { createInterface } from 'node:readline'

export interface KernelTag {
  name: string
  file: string
  address: string
  kind: string
  scope?: string
}

export interface KernelDirectoryEntry {
  name: string
  path: string
  slug: string
  kind: 'directory' | 'file'
}

interface TagLine {
  text: string
  start: number
  end: number
}

const BLOCK_SIZE = 16 * 1024
const MAX_TAG_LINE_BYTES = 1024 * 1024
const headerOffsets = new Map<string, { size: number; mtimeMs: number; start: number }>()
const tagNameCache = new Map<string, KernelTag | null>()

async function readLineAt(handle: Awaited<ReturnType<typeof open>>, offset: number, size: number): Promise<TagLine | undefined> {
  if (offset >= size) return undefined

  let start = offset
  if (offset > 0) {
    const previous = Buffer.alloc(1)
    await handle.read(previous, 0, 1, offset - 1)
    if (previous[0] !== 10) {
      let cursor = offset
      while (cursor > 0) {
        const blockStart = Math.max(0, cursor - BLOCK_SIZE)
        const block = Buffer.alloc(cursor - blockStart)
        await handle.read(block, 0, block.length, blockStart)
        const newline = block.lastIndexOf(10)
        if (newline >= 0) {
          start = blockStart + newline + 1
          break
        }
        cursor = blockStart
      }
    }
  }

  const chunks: Buffer[] = []
  let cursor = start
  let length = 0
  while (cursor < size && length <= MAX_TAG_LINE_BYTES) {
    const block = Buffer.alloc(Math.min(BLOCK_SIZE, size - cursor))
    const { bytesRead } = await handle.read(block, 0, block.length, cursor)
    if (!bytesRead) break
    const data = block.subarray(0, bytesRead)
    const newline = data.indexOf(10)
    if (newline >= 0) {
      chunks.push(data.subarray(0, newline))
      length += newline
      cursor += newline + 1
      const text = Buffer.concat(chunks, length).toString('utf8').replace(/\r$/, '')
      return { text, start, end: cursor }
    }
    chunks.push(data)
    length += bytesRead
    cursor += bytesRead
  }
  if (length > MAX_TAG_LINE_BYTES) throw new Error('tags 文件中存在过长记录')
  if (!length) return undefined
  return { text: Buffer.concat(chunks, length).toString('utf8').replace(/\r$/, ''), start, end: cursor }
}

function tagName(line: string): string {
  const tab = line.indexOf('\t')
  return tab < 0 ? line : line.slice(0, tab)
}

function compareTagNames(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left), Buffer.from(right))
}

async function dataStart(handle: Awaited<ReturnType<typeof open>>, tagsFile: string, size: number): Promise<number> {
  const stat = await handle.stat()
  const cached = headerOffsets.get(tagsFile)
  if (cached && cached.size === size && cached.mtimeMs === stat.mtimeMs) return cached.start

  let cursor = 0
  while (cursor < size) {
    const row = await readLineAt(handle, cursor, size)
    if (!row) break
    if (!row.text.startsWith('!_TAG')) break
    cursor = row.end
  }
  headerOffsets.set(tagsFile, { size, mtimeMs: stat.mtimeMs, start: cursor })
  return cursor
}

async function lowerBoundOffset(
  handle: Awaited<ReturnType<typeof open>>,
  size: number,
  start: number,
  query: string,
): Promise<number> {
  let low = start
  let high = size
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2)
    const row = await readLineAt(handle, middle, size)
    if (!row) break
    const comparison = compareTagNames(tagName(row.text), query)
    if (comparison < 0) {
      if (row.end <= low) break
      low = row.end
    } else {
      if (row.start >= high) break
      high = row.start
    }
  }
  return low
}

function decodeTagField(value: string): string {
  return value.replace(/\\([tnr\\])/g, (_match, escaped: string) => {
    if (escaped === 't') return '\t'
    if (escaped === 'n') return '\n'
    if (escaped === 'r') return '\r'
    return '\\'
  })
}

export function parseTagLine(line: string): KernelTag | undefined {
  const firstTab = line.indexOf('\t')
  const secondTab = line.indexOf('\t', firstTab + 1)
  if (firstTab < 1 || secondTab < 0) return undefined

  const addressAndFields = line.slice(secondTab + 1)
  const marker = addressAndFields.indexOf(';"')
  if (marker < 0) return undefined
  const address = addressAndFields.slice(0, marker)
  const fields = addressAndFields.slice(marker + 2).split('\t').filter(Boolean)
  const kind = fields[0]?.trim() ?? 'unknown'
  const scope = fields.find((field) => /^[a-zA-Z][\w-]*:/.test(field))

  return {
    name: decodeTagField(line.slice(0, firstTab)),
    file: decodeTagField(line.slice(firstTab + 1, secondTab)),
    address,
    kind,
    scope: scope ? decodeTagField(scope) : undefined,
  }
}

export async function searchKernelTags(
  tagsFile: string,
  query: string,
  offset = 0,
  limit = 50,
): Promise<{ results: KernelTag[]; matchMode: 'exact' | 'prefix' | 'none'; offset: number; limit: number; hasMore: boolean }> {
  const handle = await open(tagsFile, 'r')
  try {
    const size = (await handle.stat()).size
    const start = await dataStart(handle, tagsFile, size)
    const queryBuffer = Buffer.from(query)

    const results: KernelTag[] = []
    let cursor = await lowerBoundOffset(handle, size, start, query)
    let matchMode: 'exact' | 'prefix' | 'none' = 'none'
    let matched = 0
    let hasMore = false
    const prefixBytes = queryBuffer

    while (cursor < size) {
      const row = await readLineAt(handle, cursor, size)
      if (!row) break
      cursor = row.end
      const name = tagName(row.text)
      const isExact = name === query
      const isPrefix = Buffer.from(name).subarray(0, prefixBytes.length).equals(prefixBytes)
      if (!isExact && (matchMode === 'exact' || !isPrefix)) break
      if (matchMode === 'none') matchMode = isExact ? 'exact' : 'prefix'
      if (matchMode === 'exact' && !isExact) break
      if (matchMode === 'prefix' && !isPrefix) break
      if (matched++ < offset) continue
      const tag = parseTagLine(row.text)
      if (!tag) continue
      if (results.length === limit) {
        hasMore = true
        break
      }
      results.push(tag)
    }

    return { results, matchMode, offset, limit, hasMore }
  } finally {
    await handle.close()
  }
}

export async function findKernelTag(
  tagsFile: string,
  name: string,
  file: string,
  address: string,
): Promise<KernelTag | undefined> {
  const handle = await open(tagsFile, 'r')
  try {
    const size = (await handle.stat()).size
    const start = await dataStart(handle, tagsFile, size)
    let cursor = await lowerBoundOffset(handle, size, start, name)
    while (cursor < size) {
      const row = await readLineAt(handle, cursor, size)
      if (!row) break
      cursor = row.end
      const currentName = tagName(row.text)
      if (currentName !== name) break
      const tag = parseTagLine(row.text)
      if (tag?.file === file && tag.address === address) return tag
    }
    return undefined
  } finally {
    await handle.close()
  }
}

export async function findKernelTagsForNames(
  tagsFile: string,
  names: string[],
): Promise<Record<string, KernelTag>> {
  const uniqueNames = [...new Set(names)].filter((name) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)).slice(0, 1000)
  if (!uniqueNames.length) return {}

  const handle = await open(tagsFile, 'r')
  try {
    const size = (await handle.stat()).size
    const start = await dataStart(handle, tagsFile, size)
    const links: Record<string, KernelTag> = {}
    for (const name of uniqueNames) {
      const cached = tagNameCache.get(`${tagsFile}\0${name}`)
      if (cached) {
        links[name] = cached
        continue
      }
      if (cached === null) continue
      let cursor = await lowerBoundOffset(handle, size, start, name)
      let first: KernelTag | undefined
      let functionTag: KernelTag | undefined
      while (cursor < size) {
        const row = await readLineAt(handle, cursor, size)
        if (!row) break
        cursor = row.end
        if (tagName(row.text) !== name) break
        const tag = parseTagLine(row.text)
        if (!tag) continue
        first ??= tag
        if (tag.kind === 'f') {
          functionTag = tag
          break
        }
      }
      const link = functionTag ?? first
      tagNameCache.set(`${tagsFile}\0${name}`, link ?? null)
      if (link) links[name] = link
    }
    return links
  } finally {
    await handle.close()
  }
}

export interface KernelTagReference {
  name: string
  kind: 'function' | 'struct' | 'union' | 'enum'
}

export async function findKernelTagsForReferences(
  tagsFile: string,
  references: KernelTagReference[],
): Promise<Record<string, KernelTag>> {
  const unique = [...new Map(references.map((reference) => [`${reference.kind}\0${reference.name}`, reference])).values()]
    .filter((reference) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(reference.name))
    .slice(0, 1000)
  if (!unique.length) return {}

  const handle = await open(tagsFile, 'r')
  try {
    const size = (await handle.stat()).size
    const start = await dataStart(handle, tagsFile, size)
    const links: Record<string, KernelTag> = {}
    const referencesWithCandidates: Array<{ reference: KernelTagReference; candidates: KernelTag[] }> = []
    for (const reference of unique) {
      const cached = tagNameCache.get(`${tagsFile}\0${reference.name}`)
      if (cached === null) continue
      let cursor = await lowerBoundOffset(handle, size, start, reference.name)
      const matches: KernelTag[] = []
      while (cursor < size) {
        const row = await readLineAt(handle, cursor, size)
        if (!row) break
        cursor = row.end
        if (tagName(row.text) !== reference.name) break
        const tag = parseTagLine(row.text)
        if (tag) matches.push(tag)
      }

      const expectedKind = reference.kind === 'function'
        ? 'f'
        : reference.kind === 'struct' ? 's' : reference.kind === 'union' ? 'u' : 'e'
      const candidates = matches.filter((tag) => tag.kind === expectedKind && !tag.file.startsWith('tools/'))
      referencesWithCandidates.push({ reference, candidates })
    }

    // A name such as path_init may be defined by several static functions. When
    // querying a code block, symbols from the same source file provide useful
    // context for choosing one; without that context we leave the name unset.
    const fileHints = new Map<string, number>()
    for (const { candidates } of referencesWithCandidates) {
      if (candidates.length !== 1) continue
      const file = candidates[0]?.file
      if (file) fileHints.set(file, (fileHints.get(file) ?? 0) + 1)
    }
    for (const { reference, candidates } of referencesWithCandidates) {
      if (!candidates.length) continue
      let candidate: KernelTag | undefined
      if (candidates.length === 1) {
        candidate = candidates[0]
      } else if (reference.kind === 'function') {
        const ranked = candidates
          .map((tag) => ({ tag, score: fileHints.get(tag.file) ?? 0 }))
          .sort((left, right) => right.score - left.score)
        if (ranked[0]?.score && ranked[0].score > (ranked[1]?.score ?? 0)) candidate = ranked[0].tag
      }
      if (candidate) links[reference.name] = candidate
    }
    return links
  } finally {
    await handle.close()
  }
}

function patternToRegex(address: string): RegExp | undefined {
  if (/^\d+$/.test(address)) return undefined
  const delimiter = address[0]
  if (delimiter !== '/' && delimiter !== '?') return undefined
  let closing = -1
  for (let index = address.length - 1; index > 0; index--) {
    if (address[index] !== delimiter) continue
    let slashes = 0
    for (let before = index - 1; before > 0 && address[before] === '\\'; before--) slashes++
    if (slashes % 2 === 0) {
      closing = index
      break
    }
  }
  if (closing < 0) return undefined

  const source = address.slice(1, closing)
  let translated = ''
  for (let index = 0; index < source.length; index++) {
    const character = source[index]
    if (character === '\\' && index + 1 < source.length) {
      const next = source[++index]
      if ('()|+?{}'.includes(next)) translated += next
      else if (next === '/') translated += '/'
      else translated += `\\${next}`
    } else if (character === '*') {
      const previous = source[index - 1] ?? ''
      const escapedPrevious = previous && source[index - 2] === '\\'
      translated += previous === '.' || previous === ')' || previous === ']' || previous === '*' || escapedPrevious
        ? '*'
        : '\\*'
    } else if ('()+?|{}'.includes(character)) {
      translated += `\\${character}`
    } else {
      translated += character
    }
  }
  try {
    return new RegExp(translated)
  } catch {
    return undefined
  }
}

function literalTagRegex(name: string): RegExp {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return /^[A-Za-z0-9_$]+$/.test(name)
    ? new RegExp(`(^|[^A-Za-z0-9_$])${escaped}($|[^A-Za-z0-9_$])`)
    : new RegExp(escaped)
}

async function resolveSourceFile(sourceRoot: string, relativeFile: string): Promise<string> {
  const normalized = relativeFile.replace(/\\/g, '/')
  if (!normalized || normalized.startsWith('/') || normalized.includes('\0')) throw new Error('无效的源码路径')
  const root = await realpath(sourceRoot)
  const candidate = await realpath(path.resolve(root, normalized))
  const relative = path.relative(root, candidate)
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('源码路径超出 Linux-6.8 目录')
  }
  return candidate
}

function directorySlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export async function readKernelDirectory(
  sourceRoot: string,
  relativePath = '',
): Promise<{ path: string; entries: KernelDirectoryEntry[] }> {
  const root = await realpath(sourceRoot)
  let target = root
  if (relativePath) {
    const normalized = relativePath.replace(/\\/g, '/')
    if (normalized.startsWith('/') || normalized.includes('\0') || normalized.split('/').some((part) => part === '..')) {
      throw new Error('无效的源码路径')
    }
    target = await realpath(path.resolve(root, normalized))
    const relative = path.relative(root, target)
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error('源码路径超出 Linux-6.8 目录')
    }
  }

  const entries = await readdir(target, { withFileTypes: true })
  const currentPath = path.relative(root, target).split(path.sep).filter(Boolean).join('/')
  const result = entries
    .filter((entry) => !entry.isSymbolicLink() && (entry.isDirectory() || (entry.isFile() && entry.name !== 'tags' && entry.name !== 'TAGS')))
    .map((entry) => {
      const entryPath = [currentPath, entry.name].filter(Boolean).join('/')
      return {
        name: entry.name,
        path: entryPath,
        slug: directorySlug(entry.name),
        kind: entry.isDirectory() ? 'directory' as const : 'file' as const,
      }
    })
    .sort((left, right) => left.kind === right.kind
      ? left.name.localeCompare(right.name)
      : left.kind === 'directory' ? -1 : 1)
  return { path: currentPath, entries: result }
}

function calledNames(lines: string[]): string[] {
  const names = new Set<string>()
  for (const line of lines) {
    for (const match of line.matchAll(/\b([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g)) {
      names.add(match[1] ?? '')
      if (names.size === 1000) return [...names]
    }
  }
  return [...names]
}

async function readWholeSourceFile(sourceRoot: string, relativeFile: string): Promise<string[]> {
  const absoluteFile = await resolveSourceFile(sourceRoot, relativeFile)
  const input = createReadStream(absoluteFile, { encoding: 'utf8' })
  const reader = createInterface({ input, crlfDelay: Infinity })
  const lines: string[] = []
  try {
    for await (const text of reader) {
      if (text.includes('\0')) throw new Error('目标文件不是文本源码')
      lines.push(text)
    }
  } finally {
    reader.close()
    input.destroy()
  }
  return lines
}

function findDefinitionLine(lines: string[], name: string, address: string): number | undefined {
  const numericLine = /^\d+$/.test(address) ? Number(address) : undefined
  if (numericLine !== undefined) return numericLine >= 1 && numericLine <= lines.length ? numericLine : undefined
  const pattern = patternToRegex(address)
  if (pattern) {
    const lineIndex = lines.findIndex((text) => pattern.test(text))
    if (lineIndex >= 0) return lineIndex + 1
  }
  const literalPattern = literalTagRegex(name)
  const fallbackIndex = lines.findIndex((text) => literalPattern.test(text))
  return fallbackIndex >= 0 ? fallbackIndex + 1 : undefined
}

export async function readKernelSourceFile(
  sourceRoot: string,
  relativeFile: string,
  name: string,
  address: string,
): Promise<{ file: string; line: number; startLine: number; lines: string[]; symbols: Record<string, KernelTag> }> {
  if (address.length > 8192) throw new Error('tags 地址过长')
  const lines = await readWholeSourceFile(sourceRoot, relativeFile)
  const line = findDefinitionLine(lines, name, address)
  if (line === undefined) throw new Error(`在 ${relativeFile} 中找不到符号 ${name} 的定义位置`)
  const symbols = await findKernelTagsForNames(path.join(sourceRoot, 'tags'), calledNames(lines))
  return { file: relativeFile, line, startLine: 1, lines, symbols }
}

export async function readKernelSourceFileByPath(
  sourceRoot: string,
  relativeFile: string,
): Promise<{ file: string; startLine: number; lines: string[]; symbols: Record<string, KernelTag> }> {
  const lines = await readWholeSourceFile(sourceRoot, relativeFile)
  const symbols = await findKernelTagsForNames(path.join(sourceRoot, 'tags'), calledNames(lines))
  return { file: relativeFile, startLine: 1, lines, symbols }
}
