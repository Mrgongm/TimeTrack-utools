<script setup>
import { ref, computed, onMounted } from 'vue'
import { computeDailyTotals } from '../services/aggregation'
import { backRoute } from '../store'
import { formatDurationShort, startOfDay } from '../utils/time'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

const loading = ref(true)
const viewYear = ref(new Date().getFullYear())
const viewMonth = ref(new Date().getMonth())
const dailyTotals = ref(new Map())

async function reload () {
  loading.value = true
  const gridRange = currentGridRange()
  const totals = await computeDailyTotals(gridRange.startMs, gridRange.endMs)
  dailyTotals.value = totals
  loading.value = false
}

function currentGridRange () {
  const firstOfMonth = new Date(viewYear.value, viewMonth.value, 1)
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7
  const gridStart = new Date(firstOfMonth)
  gridStart.setDate(firstOfMonth.getDate() - mondayOffset)
  const gridEnd = new Date(gridStart)
  gridEnd.setDate(gridStart.getDate() + 42)
  return { startMs: gridStart.getTime(), endMs: gridEnd.getTime() }
}

const gridDays = computed(() => {
  const { startMs } = currentGridRange()
  const today = new Date()
  const todayDayStart = startOfDay(today.getTime())
  const days = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(startMs + i * 86400000)
    const dayStart = startOfDay(d.getTime())
    days.push({
      date: d,
      dayNum: d.getDate(),
      inMonth: d.getMonth() === viewMonth.value,
      isToday: dayStart === todayDayStart,
      isWeekend: i % 7 >= 5,
      ms: dailyTotals.value.get(dayStart) || 0
    })
  }
  return days
})

const monthLabel = computed(() => `${viewYear.value}年${viewMonth.value + 1}月`)

const monthTotalMs = computed(() => {
  let sum = 0
  for (const d of gridDays.value) {
    if (d.inMonth) sum += d.ms
  }
  return sum
})

const workedDayCount = computed(() => gridDays.value.filter((d) => d.inMonth && d.ms > 0).length)

function shiftMonth (delta) {
  const next = new Date(viewYear.value, viewMonth.value + delta, 1)
  viewYear.value = next.getFullYear()
  viewMonth.value = next.getMonth()
  reload()
}

function goToday () {
  const now = new Date()
  viewYear.value = now.getFullYear()
  viewMonth.value = now.getMonth()
  reload()
}

onMounted(reload)
</script>

<template>
  <div class="page">
    <div class="back-bar">
      <button class="btn btn--ghost btn--sm" @click="backRoute()">← 返回</button>
    </div>

    <header class="page__header">
      <div class="page__title">
        <h2>工时日历</h2>
        <span class="pill">本月 {{ formatDurationShort(monthTotalMs) }}</span>
        <span v-if="workedDayCount > 0" class="cal-meta">{{ workedDayCount }} 天有记录</span>
      </div>
      <div class="page__actions">
        <button class="btn btn--ghost btn--sm" @click="shiftMonth(-1)">←</button>
        <span class="cal-month-label">{{ monthLabel }}</span>
        <button class="btn btn--ghost btn--sm" @click="shiftMonth(1)">→</button>
        <button class="btn btn--ghost" @click="goToday">今天</button>
      </div>
    </header>

    <div v-if="loading" class="page__loading">加载中…</div>
    <div v-else class="calendar">
      <div v-for="w in WEEKDAYS" :key="w" class="cal-weekday">{{ w }}</div>
      <div
        v-for="d in gridDays"
        :key="d.date.getTime()"
        class="cal-cell"
        :class="{
          'cal-cell--out': !d.inMonth,
          'cal-cell--today': d.isToday,
          'cal-cell--weekend': d.isWeekend,
          'cal-cell--empty': d.ms === 0
        }"
      >
        <div class="cal-cell__day">{{ d.dayNum }}</div>
        <div class="cal-cell__hours">{{ d.ms > 0 ? formatDurationShort(d.ms) : '—' }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page__actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.cal-meta {
  font-size: 12px;
  color: var(--muted);
}
.cal-month-label {
  font-weight: 600;
  font-size: 14px;
  min-width: 96px;
  text-align: center;
}
.calendar {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}
.cal-weekday {
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
  padding: 6px 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.cal-cell {
  aspect-ratio: 1.3 / 1;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 6px 6px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  box-shadow: var(--shadow-sm);
  transition: var(--transition);
}
.cal-cell--out {
  opacity: 0.35;
  background: transparent;
  box-shadow: none;
}
.cal-cell--weekend:not(.cal-cell--out) {
  background: var(--card-bg-soft);
}
.cal-cell--today {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.cal-cell--today .cal-cell__day {
  color: var(--accent);
  font-weight: 700;
}
.cal-cell--empty .cal-cell__hours {
  color: var(--muted);
  opacity: 0.5;
}
.cal-cell__day {
  font-size: 11px;
  color: var(--muted);
  align-self: flex-end;
  line-height: 1;
}
.cal-cell__hours {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-variant-numeric: tabular-nums;
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
  line-height: 1;
}
</style>
