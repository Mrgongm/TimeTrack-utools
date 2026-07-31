import { allDocsByPrefix } from './db'
import { getWorkSchedule } from './workSchedule'
import { calcEffectiveMs } from '../utils/effective'

function buildChildrenMap (tasks) {
  const map = new Map()
  for (const t of tasks) {
    if (t.parentId) {
      if (!map.has(t.parentId)) map.set(t.parentId, [])
      map.get(t.parentId).push(t._id)
    }
  }
  return map
}

export async function computeAggregations (now = Date.now()) {
  const [sessions, tasks, projects, workSchedule] = await Promise.all([
    allDocsByPrefix('session/'),
    allDocsByPrefix('task/'),
    allDocsByPrefix('project/'),
    getWorkSchedule()
  ])
  const liveSessions = sessions.filter((s) => !s.deletedAt)
  const liveTasks = tasks.filter((t) => !t.deletedAt)
  const liveProjects = projects.filter((p) => !p.deletedAt)

  const sessionMsByTask = new Map()
  for (const s of liveSessions) {
    const ms = s.end ? (s.effectiveMs || 0) : calcEffectiveMs(s.start, now, workSchedule)
    sessionMsByTask.set(s.taskId, (sessionMsByTask.get(s.taskId) || 0) + ms)
  }

  const childrenMap = buildChildrenMap(liveTasks)

  const totalMsByTask = new Map()
  function totalMs (taskId, seen = new Set()) {
    if (totalMsByTask.has(taskId)) return totalMsByTask.get(taskId)
    if (seen.has(taskId)) return 0
    seen.add(taskId)
    const self = sessionMsByTask.get(taskId) || 0
    const childIds = childrenMap.get(taskId) || []
    const childTotal = childIds.reduce((acc, cid) => acc + totalMs(cid, seen), 0)
    const sum = self + childTotal
    totalMsByTask.set(taskId, sum)
    return sum
  }
  for (const t of liveTasks) totalMs(t._id)

  const totalMsByProject = new Map()
  for (const t of liveTasks) {
    if (!t.projectId) continue
    totalMsByProject.set(t.projectId, (totalMsByProject.get(t.projectId) || 0) + (totalMsByTask.get(t._id) || 0))
  }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = todayStart.getTime() + 24 * 60 * 60 * 1000
  const todayTotalMs = liveSessions
    .filter((s) => s.start >= todayStart.getTime() && s.start < todayEnd)
    .reduce((acc, s) => {
      const ms = s.end ? (s.effectiveMs || 0) : calcEffectiveMs(s.start, now, workSchedule)
      return acc + ms
    }, 0)

  return {
    taskSelfMs: sessionMsByTask,
    taskTotalMs: totalMsByTask,
    projectTotalMs: totalMsByProject,
    todayTotalMs,
    liveTaskCount: liveTasks.length,
    liveProjectCount: liveProjects.length
  }
}
