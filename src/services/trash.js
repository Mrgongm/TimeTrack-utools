import { allDocsByPrefix, bulkDocs, removeDoc } from './db'

async function fetchAllNonMeta () {
  const [projects, tasks, sessions] = await Promise.all([
    allDocsByPrefix('project/'),
    allDocsByPrefix('task/'),
    allDocsByPrefix('session/')
  ])
  return [...projects, ...tasks, ...sessions]
}

export async function listTrashBatches () {
  const all = await fetchAllNonMeta()
  const deleted = all.filter((d) => d.deletedAt)
  const batches = new Map()
  for (const d of deleted) {
    if (!batches.has(d.deletedAt)) batches.set(d.deletedAt, [])
    batches.get(d.deletedAt).push(d)
  }
  const result = []
  for (const [batch, items] of batches) {
    const projectsInBatch = items.filter((d) => d._id.startsWith('project/'))
    const tasksInBatch = items.filter((d) => d._id.startsWith('task/'))
    const sessionsInBatch = items.filter((d) => d._id.startsWith('session/'))
    const root = projectsInBatch[0] || tasksInBatch.find((t) => !tasksInBatch.some((x) => x._id === t.parentId)) || tasksInBatch[0]
    result.push({
      batch,
      items,
      projectCount: projectsInBatch.length,
      taskCount: tasksInBatch.length,
      sessionCount: sessionsInBatch.length,
      label: root ? root.name : 'Session'
    })
  }
  return result.sort((a, b) => b.batch - a.batch)
}

export async function restoreBatch (batch) {
  const all = await fetchAllNonMeta()
  const toRestore = all.filter((d) => d.deletedAt === batch)
  for (const d of toRestore) d.deletedAt = null
  if (toRestore.length > 0) await bulkDocs(toRestore)
  return toRestore.length
}

export async function purgeBatch (batch) {
  const all = await fetchAllNonMeta()
  const toPurge = all.filter((d) => d.deletedAt === batch)
  for (const d of toPurge) await removeDoc(d)
  return toPurge.length
}
