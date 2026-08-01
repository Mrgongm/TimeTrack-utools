import { allDocsByPrefix, newTaskId, putDoc, getDoc, bulkDocs } from './db'
import { ACTIVE_SESSION_ID } from './db'

export async function listTasksByProject (projectId) {
  const docs = await allDocsByPrefix('task/')
  return docs
    .filter((t) => t.projectId === projectId && !t.deletedAt)
    .sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt))
}

export async function getTask (id) {
  return await getDoc(id)
}

export async function createTask (projectId, parentId, name) {
  const now = Date.now()
  const doc = {
    _id: newTaskId(),
    name,
    projectId,
    parentId: parentId || null,
    completed: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    order: now
  }
  await putDoc(doc)
  return doc
}

export async function renameTask (id, name) {
  const doc = await getDoc(id)
  if (!doc) throw new Error(`Task not found: ${id}`)
  doc.name = name
  doc.updatedAt = Date.now()
  await putDoc(doc)
  return doc
}

export async function setCompleted (id, completed) {
  const doc = await getDoc(id)
  if (!doc) throw new Error(`Task not found: ${id}`)
  doc.completed = completed
  doc.updatedAt = Date.now()
  await putDoc(doc)
  return doc
}

export async function updateTaskOrders (orders) {
  const ids = Object.keys(orders)
  if (ids.length === 0) return
  const docs = await Promise.all(ids.map((id) => getDoc(id)))
  const toUpdate = []
  for (const doc of docs) {
    if (!doc) continue
    doc.order = orders[doc._id]
    doc.updatedAt = Date.now()
    toUpdate.push(doc)
  }
  if (toUpdate.length > 0) await bulkDocs(toUpdate)
}

function collectDescendants (allTasks, rootId) {
  const childrenMap = new Map()
  for (const t of allTasks) {
    if (t.parentId) {
      if (!childrenMap.has(t.parentId)) childrenMap.set(t.parentId, [])
      childrenMap.get(t.parentId).push(t)
    }
  }
  const result = []
  const stack = [rootId]
  while (stack.length > 0) {
    const cur = stack.pop()
    const children = childrenMap.get(cur) || []
    for (const c of children) {
      result.push(c)
      stack.push(c._id)
    }
  }
  return result
}

export async function getDescendantTasks (taskId) {
  const allTasks = await allDocsByPrefix('task/')
  const target = allTasks.find((t) => t._id === taskId)
  if (!target) return []
  const descendants = collectDescendants(allTasks, taskId)
  return descendants
}

export async function softDeleteTaskSubtreeCascade (taskId) {
  const batch = Date.now()
  const allTasks = await allDocsByPrefix('task/')
  const root = allTasks.find((t) => t._id === taskId)
  if (!root) throw new Error(`Task not found: ${taskId}`)
  const descendants = collectDescendants(allTasks, taskId)
  const taskIds = new Set([taskId, ...descendants.map((t) => t._id)])
  const sessions = await allDocsByPrefix('session/')
  const subtreeSessions = sessions.filter((s) => taskIds.has(s.taskId))

  const toUpdate = []
  root.deletedAt = batch
  toUpdate.push(root)
  for (const t of descendants) {
    t.deletedAt = batch
    toUpdate.push(t)
  }
  for (const s of subtreeSessions) {
    s.deletedAt = batch
    toUpdate.push(s)
  }
  const active = await getDoc(ACTIVE_SESSION_ID)
  if (active && active.taskId && taskIds.has(active.taskId)) {
    active.taskId = null
    active.sessionId = null
    active.startedAt = null
    toUpdate.push(active)
  }
  if (toUpdate.length > 0) await bulkDocs(toUpdate)
  return { batch, taskCount: 1 + descendants.length, sessionCount: subtreeSessions.length }
}
