import { allDocsByPrefix } from './db'
import { getProject } from './project'
import { getWorkSchedule } from './workSchedule'
import { calcEffectiveMs } from '../utils/effective'
import { formatDuration } from '../utils/time'

function pad (n) {
  return String(n).padStart(2, '0')
}

function formatTimestampSec (ms) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function formatFileTimestamp (ms) {
  const d = new Date(ms)
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

function sanitizeFilename (name) {
  return (name || '').replace(/[\\/:*?"<>|]/g, '_').trim() || 'project'
}

export async function exportProjectReport (projectId) {
  const project = await getProject(projectId)
  if (!project) throw new Error(`Project not found: ${projectId}`)

  const [allTasks, allSessions, workSchedule] = await Promise.all([
    allDocsByPrefix('task/'),
    allDocsByPrefix('session/'),
    getWorkSchedule()
  ])

  const tasks = allTasks
    .filter((t) => t.projectId === projectId && !t.deletedAt)
    .sort((a, b) => a.createdAt - b.createdAt)
  const taskIds = new Set(tasks.map((t) => t._id))
  const sessions = allSessions
    .filter((s) => taskIds.has(s.taskId) && !s.deletedAt)
    .sort((a, b) => a.start - b.start)

  const childrenMap = new Map()
  for (const t of tasks) {
    const key = t.parentId || '__root__'
    if (!childrenMap.has(key)) childrenMap.set(key, [])
    childrenMap.get(key).push(t)
  }

  const sessionsByTask = new Map()
  for (const s of sessions) {
    if (!sessionsByTask.has(s.taskId)) sessionsByTask.set(s.taskId, [])
    sessionsByTask.get(s.taskId).push(s)
  }

  function taskSelfMs (taskId) {
    const list = sessionsByTask.get(taskId) || []
    return list.reduce((acc, s) => acc + (s.effectiveMs || 0), 0)
  }

  const totalByTask = new Map()
  function taskTotalMs (taskId, seen = new Set()) {
    if (totalByTask.has(taskId)) return totalByTask.get(taskId)
    if (seen.has(taskId)) return 0
    seen.add(taskId)
    const childIds = (childrenMap.get(taskId) || []).map((c) => c._id)
    const childTotal = childIds.reduce((acc, cid) => acc + taskTotalMs(cid, seen), 0)
    const sum = taskSelfMs(taskId) + childTotal
    totalByTask.set(taskId, sum)
    return sum
  }

  function renderTaskTree (parentId, depth) {
    const children = childrenMap.get(parentId || '__root__') || []
    const lines = []
    for (const t of children) {
      const indent = '  '.repeat(depth)
      const mark = t.completed ? ' ✓' : ''
      const self = formatDuration(taskSelfMs(t._id))
      const total = formatDuration(taskTotalMs(t._id))
      const totalLabel = (childrenMap.get(t._id) || []).length > 0 ? ` / 合计 ${total}` : ''
      lines.push(`${indent}- ${t.name}${mark} — 自身 ${self}${totalLabel}`)
      const sub = renderTaskTree(t._id, depth + 1)
      if (sub) lines.push(...sub)
    }
    return lines
  }

  function buildTaskPath (taskId) {
    const path = []
    let cur = tasks.find((t) => t._id === taskId)
    while (cur) {
      path.unshift(cur.name)
      cur = cur.parentId ? tasks.find((t) => t._id === cur.parentId) : null
    }
    return path.join(' / ')
  }

  const projectTotal = tasks.reduce((acc, t) => {
    if (t.parentId) return acc
    return acc + taskTotalMs(t._id)
  }, 0)

  const generatedAt = Date.now()
  const lines = []
  lines.push(`# ${project.name}${project.archivedAt ? '  (已归档)' : ''}`)
  lines.push('')
  lines.push(`生成时间：${formatTimestampSec(generatedAt)}`)
  lines.push('')
  lines.push('## 概览')
  lines.push('')
  lines.push(`- 总工时：${formatDuration(projectTotal)}`)
  lines.push(`- 任务数：${tasks.length}`)
  lines.push(`- 工时记录：${sessions.length} 条`)
  lines.push('')

  lines.push('## 任务工时')
  lines.push('')
  const treeLines = renderTaskTree(null, 0)
  if (treeLines.length === 0) {
    lines.push('（无任务）')
  } else {
    lines.push(...treeLines)
  }
  lines.push('')

  lines.push('## 工时记录明细')
  lines.push('')
  if (sessions.length === 0) {
    lines.push('（无工时记录）')
  } else {
    for (const t of tasks) {
      const taskSessions = sessionsByTask.get(t._id) || []
      if (taskSessions.length === 0) continue
      lines.push(`### ${buildTaskPath(t._id)}`)
      lines.push('')
      for (const s of taskSessions) {
        const end = s.end ? formatTimestampSec(s.end) : '计时中'
        const dur = s.end ? formatDuration(s.effectiveMs || 0) : formatDuration(calcEffectiveMs(s.start, generatedAt, workSchedule))
        lines.push(`- ${formatTimestampSec(s.start)} → ${end} | ${dur}`)
      }
      lines.push('')
    }
  }

  const text = lines.join('\n')
  const filename = `${sanitizeFilename(project.name)}-工时-${formatFileTimestamp(generatedAt)}.md`
  return window.services.exportJson(text, filename)
}
