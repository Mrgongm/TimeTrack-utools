import { allDocsByPrefix } from './db'

export async function exportAllData () {
  const [projects, tasks, sessions, meta] = await Promise.all([
    allDocsByPrefix('project/'),
    allDocsByPrefix('task/'),
    allDocsByPrefix('session/'),
    allDocsByPrefix('meta/')
  ])
  const payload = {
    version: 1,
    exportedAt: Date.now(),
    projects,
    tasks,
    sessions,
    meta
  }
  const text = JSON.stringify(payload, null, 2)
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `timetrack-${ts}.json`
  return window.services.exportJson(text, filename)
}
