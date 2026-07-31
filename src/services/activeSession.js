import { getDoc, putDoc, ACTIVE_SESSION_ID } from './db'
import { setSessionEnd, createSession } from './session'
import { setCompleted, getTask } from './task'

export async function getActive () {
  return await getDoc(ACTIVE_SESSION_ID)
}

async function clearActivePointer () {
  const cur = await getDoc(ACTIVE_SESSION_ID)
  if (cur) {
    cur.taskId = null
    cur.sessionId = null
    cur.startedAt = null
    await putDoc(cur)
  } else {
    await putDoc({
      _id: ACTIVE_SESSION_ID,
      taskId: null,
      sessionId: null,
      startedAt: null
    })
  }
}

async function setActivePointer (taskId, sessionId) {
  const cur = await getDoc(ACTIVE_SESSION_ID)
  const payload = {
    _id: ACTIVE_SESSION_ID,
    taskId,
    sessionId,
    startedAt: Date.now()
  }
  if (cur) payload._rev = cur._rev
  await putDoc(payload)
}

export async function pauseActive () {
  const active = await getActive()
  if (!active || !active.sessionId) return null
  await setSessionEnd(active.sessionId, Date.now())
  await clearActivePointer()
  return active.sessionId
}

export async function startTask (taskId) {
  const existing = await getActive()
  if (existing && existing.sessionId) {
    if (existing.taskId === taskId) return existing
    await setSessionEnd(existing.sessionId, Date.now())
  }

  const task = await getTask(taskId)
  if (task && task.completed) {
    await setCompleted(task._id, false)
  }

  const session = await createSession(taskId, Date.now(), null)
  await setActivePointer(taskId, session._id)
  return { taskId, sessionId: session._id }
}

export async function completeTask (taskId, completed) {
  if (completed) {
    const active = await getActive()
    if (active && active.taskId === taskId && active.sessionId) {
      await setSessionEnd(active.sessionId, Date.now())
      await clearActivePointer()
    }
  }
  return await setCompleted(taskId, completed)
}
