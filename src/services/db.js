const ID_PREFIX = {
  PROJECT: 'project/',
  TASK: 'task/',
  SESSION: 'session/',
  META: 'meta/'
}

export const ACTIVE_SESSION_ID = 'meta/active-session'
export const WORK_SCHEDULE_ID = 'meta/work-schedule'

export function newProjectId () {
  return ID_PREFIX.PROJECT + crypto.randomUUID()
}

export function newTaskId () {
  return ID_PREFIX.TASK + crypto.randomUUID()
}

export function newSessionId () {
  return ID_PREFIX.SESSION + crypto.randomUUID()
}

export async function getDoc (id) {
  const doc = await window.utools.db.get(id)
  return doc || null
}

export async function putDoc (doc) {
  let attempt = doc
  for (let i = 0; i < 5; i++) {
    let result
    try {
      result = await window.utools.db.put(attempt)
    } catch (e) {
      if (i < 4) {
        await new Promise((r) => setTimeout(r, 50))
        continue
      }
      throw e
    }
    if (result && result.ok) return result
    if (result && result.error === 'conflict') {
      const existing = await window.utools.db.get(attempt._id)
      if (!existing) throw new Error(`Doc not found on conflict retry: ${attempt._id}`)
      attempt = { ...attempt, _rev: existing._rev }
      continue
    }
    throw new Error(`putDoc failed: ${(result && (result.error || result.message)) || 'unknown'}`)
  }
  throw new Error(`putDoc conflict retries exhausted: ${doc._id}`)
}

export async function putNewDoc (doc) {
  const result = await window.utools.db.put(doc)
  if (result && result.ok) return result
  throw new Error(`putNewDoc failed: ${(result && (result.error || result.message)) || 'unknown'}`)
}

export async function removeDoc (doc) {
  const result = await window.utools.db.remove(doc)
  if (result.id) return result
  throw new Error(`removeDoc failed: ${result.error || 'unknown'}`)
}

export async function bulkDocs (docs) {
  const results = await window.utools.db.bulkDocs(docs)
  const failures = results.filter((r) => !r.id)
  if (failures.length > 0) {
    throw new Error(`bulkDocs had ${failures.length} failures: ${JSON.stringify(failures)}`)
  }
  return results
}

export async function allDocsByPrefix (prefix) {
  return await window.utools.db.allDocs(prefix)
}
