import { allDocsByPrefix, bulkDocs, removeDoc } from './db'
import { formatTimestamp, formatDuration } from '../utils/time'

async function fetchAllNonMeta () {
  const [projects, tasks, sessions] = await Promise.all([
    allDocsByPrefix('project/'),
    allDocsByPrefix('task/'),
    allDocsByPrefix('session/')
  ])
  return [...projects, ...tasks, ...sessions]
}

function buildContextMaps (all) {
  const taskMap = new Map()
  const projectMap = new Map()
  for (const d of all) {
    if (d._id.startsWith('task/')) taskMap.set(d._id, d)
    else if (d._id.startsWith('project/')) projectMap.set(d._id, d)
  }
  return { taskMap, projectMap }
}

function describeSession (s, taskMap, projectMap) {
  const task = taskMap.get(s.taskId)
  const project = task ? projectMap.get(task.projectId) : null
  const end = s.end ? formatTimestamp(s.end) : '计时中'
  return {
    projectName: project?.name || '',
    taskName: task?.name || '(任务已永久删除)',
    timeRange: `${formatTimestamp(s.start)} → ${end}`,
    duration: formatDuration(s.effectiveMs || 0)
  }
}

function describeTask (t, projectMap) {
  const project = projectMap.get(t.projectId)
  return {
    projectName: project?.name || '',
    taskName: t.name
  }
}

export async function listTrashBatches () {
  const all = await fetchAllNonMeta()
  const { taskMap, projectMap } = buildContextMaps(all)
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
    const rootProjectName = root ? (projectMap.get(root.projectId)?.name || '') : ''

    const details = []
    for (const p of projectsInBatch) {
      const projTasks = tasksInBatch.filter((t) => t.projectId === p._id)
      const projSessions = sessionsInBatch.filter((s) => taskMap.get(s.taskId)?.projectId === p._id)
      details.push({
        kind: 'project',
        projectName: p.name,
        text: `项目 · ${projTasks.length} 任务 / ${projSessions.length} 段工时`
      })
    }
    for (const t of tasksInBatch) {
      const info = describeTask(t, projectMap)
      details.push({
        kind: 'task',
        projectName: info.projectName,
        taskName: info.taskName
      })
    }
    for (const s of sessionsInBatch) {
      const info = describeSession(s, taskMap, projectMap)
      details.push({
        kind: 'session',
        projectName: info.projectName,
        taskName: info.taskName,
        timeRange: info.timeRange,
        duration: info.duration
      })
    }

    result.push({
      batch,
      items,
      projectCount: projectsInBatch.length,
      taskCount: tasksInBatch.length,
      sessionCount: sessionsInBatch.length,
      label: root ? root.name : '工时记录',
      rootProjectName,
      details
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

export async function purgeAll () {
  const all = await fetchAllNonMeta()
  const toPurge = all.filter((d) => d.deletedAt)
  for (const d of toPurge) await removeDoc(d)
  return toPurge.length
}
