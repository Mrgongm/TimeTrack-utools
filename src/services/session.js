import { allDocsByPrefix, newSessionId, putDoc, getDoc, bulkDocs } from './db'
import { calcEffectiveMs } from '../utils/effective'
import { getWorkSchedule } from './workSchedule'

export async function getSession (id) {
  return await getDoc(id)
}

export async function listSessionsByTask (taskId) {
  const docs = await allDocsByPrefix('session/')
  return docs
    .filter((s) => s.taskId === taskId && !s.deletedAt)
    .sort((a, b) => b.start - a.start)
}

export async function listAllActiveSessions () {
  const docs = await allDocsByPrefix('session/')
  return docs.filter((s) => !s.deletedAt)
}

export async function createSession (taskId, start, end, workSchedule) {
  const schedule = workSchedule || await getWorkSchedule()
  const effectiveMs = end ? calcEffectiveMs(start, end, schedule) : 0
  const now = Date.now()
  const doc = {
    _id: newSessionId(),
    taskId,
    start,
    end: end || null,
    effectiveMs,
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  }
  await putDoc(doc)
  return doc
}

export async function updateSessionTimes (id, start, end) {
  const doc = await getDoc(id)
  if (!doc) throw new Error(`Session not found: ${id}`)
  const schedule = await getWorkSchedule()
  doc.start = start
  doc.end = end || null
  doc.effectiveMs = end ? calcEffectiveMs(start, end, schedule) : 0
  doc.updatedAt = Date.now()
  await putDoc(doc)
  return doc
}

export async function setSessionEnd (id, end) {
  const doc = await getDoc(id)
  if (!doc) throw new Error(`Session not found: ${id}`)
  const schedule = await getWorkSchedule()
  doc.end = end
  doc.effectiveMs = end ? calcEffectiveMs(doc.start, end, schedule) : 0
  doc.updatedAt = Date.now()
  await putDoc(doc)
  return doc
}

export async function softDeleteSession (id) {
  const batch = Date.now()
  const doc = await getDoc(id)
  if (!doc) throw new Error(`Session not found: ${id}`)
  doc.deletedAt = batch
  await putDoc(doc)
  return { batch, count: 1 }
}

export async function softDeleteSessionsByIds (ids, batch) {
  const docs = await Promise.all(ids.map((id) => getDoc(id)))
  const valid = docs.filter(Boolean)
  for (const d of valid) d.deletedAt = batch
  if (valid.length > 0) await bulkDocs(valid)
}
