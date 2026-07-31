import { getDoc, putDoc, WORK_SCHEDULE_ID } from './db'
import { DEFAULT_WORK_SCHEDULE, emptyWorkSchedule } from '../utils/effective'

export async function getWorkSchedule () {
  const doc = await getDoc(WORK_SCHEDULE_ID)
  if (!doc) return { ...DEFAULT_WORK_SCHEDULE }
  return doc.schedule || { ...DEFAULT_WORK_SCHEDULE }
}

export async function updateWorkSchedule (schedule) {
  const existing = await getDoc(WORK_SCHEDULE_ID)
  const payload = {
    _id: WORK_SCHEDULE_ID,
    schedule: JSON.parse(JSON.stringify(schedule)),
    updatedAt: Date.now()
  }
  if (existing) payload._rev = existing._rev
  await putDoc(payload)
  return payload
}

export function getDefaultWorkSchedule () {
  return JSON.parse(JSON.stringify(DEFAULT_WORK_SCHEDULE))
}

export function getEmptyWorkSchedule () {
  return emptyWorkSchedule()
}
