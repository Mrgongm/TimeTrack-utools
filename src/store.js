import { reactive } from 'vue'
import { getActive } from './services/activeSession'
import { getTask } from './services/task'
import { getProject } from './services/project'
import { getSession } from './services/session'
import { getWorkSchedule } from './services/workSchedule'

export const store = reactive({
  active: null,
  activeTaskPath: '',
  activeSessionStart: null,
  workSchedule: null,
  now: Date.now(),
  toast: null
})

export const router = reactive({
  current: { name: 'project-list', params: {} },
  history: []
})

export function pushRoute (name, params = {}) {
  router.history.push(router.current)
  router.current = { name, params }
}

export function backRoute () {
  if (router.history.length > 0) {
    router.current = router.history.pop()
  } else {
    router.current = { name: 'project-list', params: {} }
  }
}

export function resetRoute () {
  router.current = { name: 'project-list', params: {} }
  router.history.length = 0
}

export function setToast (msg, type = 'info') {
  store.toast = { msg, type, ts: Date.now() }
  setTimeout(() => {
    if (store.toast && store.toast.ts <= Date.now() - 2500) store.toast = null
  }, 2500)
}

export async function refreshActive () {
  const active = await getActive()
  if (!active || !active.taskId || !active.sessionId) {
    store.active = null
    store.activeTaskPath = ''
    store.activeSessionStart = null
    return
  }
  const [task, session] = await Promise.all([
    getTask(active.taskId),
    getSession(active.sessionId)
  ])
  if (!task || task.deletedAt || !session || session.deletedAt) {
    store.active = null
    store.activeTaskPath = ''
    store.activeSessionStart = null
    return
  }
  store.active = active
  store.activeSessionStart = session.start
  const parts = []
  const visited = new Set()
  let cur = task
  while (cur && !visited.has(cur._id)) {
    visited.add(cur._id)
    parts.unshift(cur.name)
    cur = cur.parentId ? await getTask(cur.parentId) : null
  }
  if (task.projectId) {
    const project = await getProject(task.projectId)
    if (project && !project.deletedAt) parts.unshift(project.name)
  }
  store.activeTaskPath = parts.join(' › ')
}

export async function refreshWorkSchedule () {
  store.workSchedule = await getWorkSchedule()
}

export async function refreshAll () {
  await Promise.all([refreshActive(), refreshWorkSchedule()])
}

let ticker = null
export function startTicker () {
  if (ticker) return
  ticker = setInterval(() => {
    store.now = Date.now()
  }, 1000)
}

export function stopTicker () {
  if (ticker) {
    clearInterval(ticker)
    ticker = null
  }
}
