import { getSqlite } from '../db/client'

// resource_chunks is an FTS5 virtual table (see migration 14) — Drizzle's sqlite-core
// has no typed support for virtual tables, so this repository talks to it with raw SQL
// via the underlying better-sqlite3 connection instead of the usual query builder.

export interface ResourceChunkMatch {
  resourceId: string
  chunkIndex: number
  text: string
}

export function replaceResourceChunks(resourceId: string, chunks: string[]): void {
  const db = getSqlite()
  const run = db.transaction(() => {
    db.prepare('DELETE FROM resource_chunks WHERE resource_id = ?').run(resourceId)
    const insert = db.prepare(
      'INSERT INTO resource_chunks (resource_id, chunk_index, text) VALUES (?, ?, ?)'
    )
    chunks.forEach((text, i) => insert.run(resourceId, i, text))
  })
  run()
}

export function deleteResourceChunks(resourceId: string): void {
  getSqlite().prepare('DELETE FROM resource_chunks WHERE resource_id = ?').run(resourceId)
}

/** A resource's chunks as a plain array, in original order — what publishToPortal sends
 * so the Portal can build its own FTS index over the same chunk boundaries, rather than
 * re-splitting the joined text itself. */
export function listResourceChunks(resourceId: string): string[] {
  const rows = getSqlite()
    .prepare('SELECT text FROM resource_chunks WHERE resource_id = ? ORDER BY chunk_index')
    .all(resourceId) as { text: string }[]
  return rows.map((r) => r.text)
}

/** All of a resource's chunks, in original order, rejoined into one string — used to
 * feed a whole resource's text to the AI (e.g. draftStudyGuide), as opposed to
 * searchResourceChunks's keyword-retrieval of just the relevant few. */
export function getAllResourceChunkText(resourceId: string): string {
  const rows = getSqlite()
    .prepare('SELECT text FROM resource_chunks WHERE resource_id = ? ORDER BY chunk_index')
    .all(resourceId) as { text: string }[]
  return rows.map((r) => r.text).join('\n\n')
}

/** FTS5 keyword search, optionally scoped to a set of resources — e.g. "only search
 * what the teacher selected for this question" rather than the whole library. */
export function searchResourceChunks(
  query: string,
  resourceIds: string[] | null,
  limit: number
): ResourceChunkMatch[] {
  const db = getSqlite()
  // FTS5 query syntax treats bare punctuation as an error, and a raw user question can
  // contain anything — wrap each word in double quotes so it's always a safe phrase
  // match, OR'd together (closer to "any of these words" than a strict phrase search).
  const ftsQuery = query
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `"${word.replace(/"/g, '""')}"`)
    .join(' OR ')
  if (!ftsQuery) return []

  const scopeClause =
    resourceIds && resourceIds.length
      ? `AND resource_id IN (${resourceIds.map(() => '?').join(',')})`
      : ''
  const rows = db
    .prepare(
      `SELECT resource_id, chunk_index, text FROM resource_chunks
       WHERE resource_chunks MATCH ? ${scopeClause}
       ORDER BY rank LIMIT ?`
    )
    .all(ftsQuery, ...(resourceIds ?? []), limit) as {
    resource_id: string
    chunk_index: number
    text: string
  }[]

  return rows.map((r) => ({ resourceId: r.resource_id, chunkIndex: r.chunk_index, text: r.text }))
}
