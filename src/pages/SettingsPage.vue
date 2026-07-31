<script setup>
import { ref, onMounted, computed } from 'vue'
import { getWorkSchedule, updateWorkSchedule, getDefaultWorkSchedule } from '../services/workSchedule'
import { exportAllData } from '../services/exportData'
import { backRoute, setToast, refreshWorkSchedule } from '../store'

const DAY_LABELS = [
  { key: 'mon', label: '周一' },
  { key: 'tue', label: '周二' },
  { key: 'wed', label: '周三' },
  { key: 'thu', label: '周四' },
  { key: 'fri', label: '周五' },
  { key: 'sat', label: '周六' },
  { key: 'sun', label: '周日' }
]

const schedule = ref(getDefaultWorkSchedule())
const loading = ref(true)
const dirty = ref(false)
const exporting = ref(false)

onMounted(async () => {
  const loaded = await getWorkSchedule()
  schedule.value = JSON.parse(JSON.stringify(loaded))
  loading.value = false
})

function minToTime (min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function timeToMin (str) {
  if (!str) return 0
  const [h, m] = str.split(':').map(Number)
  return h * 60 + m
}

function addSegment (dayKey) {
  schedule.value[dayKey].push({ startMin: 9 * 60, endMin: 12 * 60 })
  dirty.value = true
}

function removeSegment (dayKey, index) {
  schedule.value[dayKey].splice(index, 1)
  dirty.value = true
}

function updateSegment (dayKey, index, field, value) {
  schedule.value[dayKey][index][field] = value
  dirty.value = true
}

async function save () {
  for (const day of DAY_LABELS) {
    const segments = schedule.value[day.key]
    for (const seg of segments) {
      if (seg.endMin <= seg.startMin) {
        setToast(`${day.label} 时段结束必须晚于开始`, 'error')
        return
      }
    }
    segments.sort((a, b) => a.startMin - b.startMin)
  }
  try {
    await updateWorkSchedule(schedule.value)
    await refreshWorkSchedule()
    dirty.value = false
    setToast('已保存', 'success')
  } catch (e) {
    setToast(`保存失败: ${e.message || e}`, 'error')
  }
}

async function onExport () {
  exporting.value = true
  try {
    const path = await exportAllData()
    setToast(`已导出到 ${path}`, 'success')
  } catch (e) {
    setToast(`导出失败: ${e.message}`, 'error')
  } finally {
    exporting.value = false
  }
}

function back () {
  if (dirty.value) {
    if (!window.confirm('有未保存改动，确定离开？')) return
  }
  backRoute()
}
</script>

<template>
  <div class="page">
    <div class="back-bar">
      <button class="btn btn--ghost btn--sm" @click="back">← 返回</button>
    </div>

    <header class="page__header">
      <h2>设置</h2>
    </header>

    <div v-if="loading" class="page__loading">加载中…</div>
    <template v-else>
      <section class="settings-section">
        <h3 class="settings-section__title">工作时间段</h3>
        <p class="settings-section__hint">
          工时将仅在配置的工作时段内累计。原始记录数据不变，仅影响实际工时计算。
        </p>

        <div v-for="day in DAY_LABELS" :key="day.key" class="schedule-day">
          <div class="schedule-day__label">{{ day.label }}</div>
          <div class="schedule-day__segments">
            <div
              v-for="(seg, idx) in schedule[day.key]"
              :key="idx"
              class="schedule-segment"
            >
              <input
                type="time"
                class="input input--time"
                :value="minToTime(seg.startMin)"
                @input="updateSegment(day.key, idx, 'startMin', timeToMin($event.target.value))"
              />
              <span class="schedule-segment__dash">–</span>
              <input
                type="time"
                class="input input--time"
                :value="minToTime(seg.endMin)"
                @input="updateSegment(day.key, idx, 'endMin', timeToMin($event.target.value))"
              />
              <button class="btn btn--danger btn--sm" @click="removeSegment(day.key, idx)">×</button>
            </div>
            <button class="btn btn--ghost btn--sm" @click="addSegment(day.key)">+ 添加时段</button>
            <span v-if="schedule[day.key].length === 0" class="schedule-day__empty">休息日</span>
          </div>
        </div>

        <div class="settings-section__actions">
          <button class="btn" @click="save">保存</button>
        </div>
      </section>

      <section class="settings-section">
        <h3 class="settings-section__title">数据</h3>
        <p class="settings-section__hint">导出所有数据（Project / Task / 工时 / 设置）为 JSON 文件，存入下载目录。</p>
        <button class="btn btn--ghost" :disabled="exporting" @click="onExport">
          {{ exporting ? '导出中…' : '⬇ 导出 JSON' }}
        </button>
      </section>
    </template>
  </div>
</template>

<style scoped>
.settings-section {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-sm);
  padding: 18px 20px;
  margin-bottom: 14px;
}
.settings-section__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  margin: 0 0 6px;
}
.settings-section__hint {
  font-size: 12px;
  color: var(--muted);
  margin: 0 0 14px;
}
.settings-section__actions {
  margin-top: 14px;
}
.schedule-day {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 10px 0;
  border-bottom: 1px dashed var(--border);
}
.schedule-day:last-of-type {
  border-bottom: none;
}
.schedule-day__label {
  width: 50px;
  font-weight: 600;
  font-size: 13px;
  color: var(--text);
  flex-shrink: 0;
  padding-top: 6px;
}
.schedule-day__segments {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.schedule-segment {
  display: flex;
  align-items: center;
  gap: 6px;
}
.schedule-segment__dash {
  color: var(--muted);
}
.input--time {
  width: auto;
  padding: 5px 10px;
  font-size: 13px;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-variant-numeric: tabular-nums;
  background: var(--card-bg-soft);
}
.schedule-day__empty {
  font-size: 12px;
  color: var(--muted);
  padding-top: 4px;
  font-style: italic;
}
</style>
