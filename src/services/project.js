import { allDocsByPrefix, newProjectId, putDoc, getDoc, bulkDocs } from './db'

export async function listProjects () {
  const docs = await allDocsByPrefix('project/')
  return docs
    .filter((p) => !p.deletedAt)
    .sort((a, b) => a.createdAt - b.createdAt)
}

export async function getProject (id) {
  return await getDoc(id)
}

export async function createProject (name) {
  const now = Date.now()
  const doc = {
    _id: newProjectId(),
    name,
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  }
  await putDoc(doc)
  return doc
}

export async function renameProject (id, name) {
  const doc = await getDoc(id)
  if (!doc) throw new Error(`Project not found: ${id}`)
  doc.name = name
  doc.updatedAt = Date.now()
  await putDoc(doc)
  return doc
}

export async function softDeleteProjectCascade (projectId) {
  const batch = Date.now()
  const tasks = await allDocsByPrefix('task/')
  const projectTasks = tasks.filter((t) => t.projectId === projectId)
  const taskIds = new Set(projectTasks.map((t) => t._id))
  const sessions = await allDocsByPrefix('session/')
  const projectSessions = sessions.filter((s) => taskIds.has(s.taskId))

  const project = await getDoc(projectId)
  const toUpdate = []
  if (project) {
    project.deletedAt = batch
    toUpdate.push(project)
  }
  for (const t of projectTasks) {
    t.deletedAt = batch
    toUpdate.push(t)
  }
  for (const s of projectSessions) {
    s.deletedAt = batch
    toUpdate.push(s)
  }
  if (toUpdate.length > 0) await bulkDocs(toUpdate)
  return { batch, count: toUpdate.length }
}
