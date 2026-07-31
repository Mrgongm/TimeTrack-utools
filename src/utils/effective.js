import { dayKeyFor } from './time'

export const DEFAULT_WORK_SCHEDULE = {
  mon: [{ startMin: 540, endMin: 720 }, { startMin: 780, endMin: 1080 }],
  tue: [{ startMin: 540, endMin: 720 }, { startMin: 780, endMin: 1080 }],
  wed: [{ startMin: 540, endMin: 720 }, { startMin: 780, endMin: 1080 }],
  thu: [{ startMin: 540, endMin: 720 }, { startMin: 780, endMin: 1080 }],
  fri: [{ startMin: 540, endMin: 720 }, { startMin: 780, endMin: 1080 }],
  sat: [],
  sun: []
}

export function emptyWorkSchedule () {
  return {
    mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: []
  }
}

function intersectMs (startMs, endMs, dayStartMs, segmentStartMin, segmentEndMin) {
  const segStartMs = dayStartMs + segmentStartMin * 60 * 1000
  const segEndMs = dayStartMs + segmentEndMin * 60 * 1000
  const overlapStart = Math.max(startMs, segStartMs)
  const overlapEnd = Math.min(endMs, segEndMs)
  return Math.max(0, overlapEnd - overlapStart)
}

export function calcEffectiveMs (startMs, endMs, workSchedule) {
  if (endMs <= startMs) return 0
  const schedule = workSchedule || DEFAULT_WORK_SCHEDULE
  let total = 0
  const cursor = new Date(startMs)
  cursor.setHours(0, 0, 0, 0)

  while (cursor.getTime() < endMs) {
    const dayStart = cursor.getTime()
    const dayEnd = dayStart + 24 * 60 * 60 * 1000
    if (dayEnd > startMs) {
      const key = dayKeyFor(dayStart + 12 * 60 * 60 * 1000)
      const segments = schedule[key] || []
      for (const seg of segments) {
        total += intersectMs(startMs, endMs, dayStart, seg.startMin, seg.endMin)
      }
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return total
}

export function isWithinWorkSchedule (ms, workSchedule) {
  const schedule = workSchedule || DEFAULT_WORK_SCHEDULE
  const d = new Date(ms)
  const dayStart = new Date(d)
  dayStart.setHours(0, 0, 0, 0)
  const key = dayKeyFor(ms)
  const segments = schedule[key] || []
  const minutes = d.getHours() * 60 + d.getMinutes()
  return segments.some((seg) => minutes >= seg.startMin && minutes < seg.endMin)
}
