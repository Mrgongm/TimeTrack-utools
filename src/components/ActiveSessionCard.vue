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
  <div class="active-card" :class="{ 'is-long': isLong, 'off-hours': !inWorkHours }">
    <template v-if="store.active">
      <div class="active-card__path">{{ store.activeTaskPath }}</div>
      <div class="active-card__times">
        <span class="active-card__effective">{{ formatDuration(effectiveMs) }}</span>
        <span v-if="!inWorkHours" class="active-card__off">非工作时段</span>
      </div>
      <button class="active-card__pause" @click="onPause">⏸ 暂停</button>
    </template>
    <template v-else>
      <div class="active-card__idle">未在计时</div>
    </template>
  </div>
</template>

<style scoped>
.active-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: var(--card-bg, #fff);
  border-bottom: 1px solid var(--border, #e5e7eb);
  gap: 12px;
}
.active-card__path {
  flex: 1;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.active-card__times {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.active-card__effective {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 18px;
  font-weight: 600;
  color: var(--blue, #58a4f6);
}
.active-card__off {
  font-size: 11px;
  padding: 2px 6px;
  background: rgba(245, 158, 11, 0.2);
  border-radius: 4px;
  color: #b45309;
}
.active-card__pause {
  padding: 6px 14px;
  font-size: 13px;
  border-radius: 4px;
}
.active-card.is-long {
  background: rgba(239, 68, 68, 0.1);
}
.active-card.is-long .active-card__effective {
  color: #dc2626;
}
.active-card__idle {
  opacity: 0.5;
  font-size: 14px;
}
@media (prefers-color-scheme: dark) {
  .active-card {
    background: #1f2937;
    border-bottom-color: #374151;
  }
  .active-card__off {
    color: #fbbf24;
  }
}
</style>
