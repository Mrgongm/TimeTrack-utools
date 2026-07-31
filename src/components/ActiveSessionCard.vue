<script setup>
import { computed } from 'vue'
import { store, refreshActive } from '../store'
import { pauseActive } from '../services/activeSession'
import { calcEffectiveMs, isWithinWorkSchedule } from '../utils/effective'
import { formatDuration } from '../utils/time'

const effectiveMs = computed(() => {
  if (!store.active || !store.activeSessionStart) return 0
  return calcEffectiveMs(store.activeSessionStart, store.now, store.workSchedule)
})

const rawMs = computed(() => {
  if (!store.active || !store.activeSessionStart) return 0
  return store.now - store.activeSessionStart
})

const inWorkHours = computed(() => {
  if (!store.active) return true
  return isWithinWorkSchedule(store.now, store.workSchedule)
})

const isLong = computed(() => rawMs.value > 12 * 60 * 60 * 1000)

async function onPause () {
  await pauseActive()
  await refreshActive()
}
</script>

<template>
  <div class="active-card" :class="{ 'is-long': isLong, 'off-hours': !inWorkHours, 'is-idle': !store.active }">
    <span v-if="store.active" class="active-card__pulse" />
    <template v-if="store.active">
      <div class="active-card__path">{{ store.activeTaskPath }}</div>
      <div class="active-card__times">
        <span v-if="!inWorkHours" class="active-card__pill active-card__pill--warning">非工作时段</span>
        <span class="active-card__effective">{{ formatDuration(effectiveMs) }}</span>
      </div>
      <button class="btn btn--ghost active-card__pause" @click="onPause">⏸ 暂停</button>
    </template>
    <template v-else>
      <div class="active-card__idle">
        <span class="active-card__idle-dot" />
        未在计时
      </div>
    </template>
  </div>
</template>

<style scoped>
.active-card {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 12px 14px 4px;
  padding: 14px 18px 14px 22px;
  background: linear-gradient(135deg, var(--card-bg) 0%, var(--card-bg-soft) 100%);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-md);
  overflow: hidden;
}
.active-card__pulse {
  position: absolute;
  left: 0;
  top: 20%;
  bottom: 20%;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--success);
  animation: pulse 2s ease-in-out infinite;
}
.active-card__path {
  flex: 1;
  font-weight: 500;
  font-size: 13px;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.active-card__times {
  display: flex;
  align-items: center;
  gap: 10px;
}
.active-card__effective {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-variant-numeric: tabular-nums;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--accent);
}
.active-card__pill {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 999px;
  font-weight: 500;
}
.active-card__pill--warning {
  background: var(--warning-soft);
  color: var(--warning);
}
.active-card__pause {
  padding: 7px 18px;
  font-size: 13px;
  font-weight: 500;
}
.active-card.is-long {
  background: linear-gradient(135deg, rgba(220, 38, 38, 0.10) 0%, rgba(220, 38, 38, 0.04) 100%);
  border-color: rgba(220, 38, 38, 0.25);
}
.active-card.is-long .active-card__effective {
  color: var(--danger);
}
.active-card.is-long .active-card__pulse {
  background: var(--danger);
  animation: pulse 1.2s ease-in-out infinite;
}
.active-card.is-idle {
  background: var(--card-bg);
  box-shadow: var(--shadow-sm);
}
.active-card__idle {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 13px;
}
.active-card__idle-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--muted);
  display: inline-block;
}
</style>
