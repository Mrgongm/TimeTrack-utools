<script setup>
import { ref, onMounted } from 'vue'
import { listTrashBatches, restoreBatch, purgeBatch } from '../services/trash'
import { backRoute, setToast } from '../store'
import { formatTimestamp } from '../utils/time'

const batches = ref([])
const loading = ref(true)
const purging = ref(null)

async function reload () {
  loading.value = true
  batches.value = await listTrashBatches()
  loading.value = false
}

onMounted(reload)

function describe (batch) {
  const parts = []
  if (batch.projectCount > 0) parts.push(`${batch.projectCount} 个项目`)
  if (batch.taskCount > 0) parts.push(`${batch.taskCount} 个任务`)
  if (batch.sessionCount > 0) parts.push(`${batch.sessionCount} 段工时`)
  return parts.join(' / ') || '空'
}

async function onRestore (batch) {
  const n = await restoreBatch(batch.batch)
  await reload()
  setToast(`已恢复 ${n} 项`, 'success')
}

async function confirmPurge () {
  if (!purging.value) return
  const n = await purgeBatch(purging.value.batch)
  purging.value = null
  await reload()
  setToast(`已永久删除 ${n} 项`, 'success')
}
</script>

<template>
  <div class="page">
    <div class="back-bar">
      <button class="btn btn--ghost btn--sm" @click="backRoute()">← 返回</button>
    </div>

    <header class="page__header">
      <h2>最近删除</h2>
    </header>

    <div v-if="loading" class="page__loading">加载中…</div>
    <div v-else-if="batches.length === 0" class="page__empty">
      暂无已删除项。
    </div>
    <ul v-else class="trash-list">
      <li v-for="batch in batches" :key="batch.batch" class="trash-item">
        <div class="trash-item__main">
          <div class="trash-item__label">{{ batch.label }}</div>
          <div class="trash-item__meta">
            {{ describe(batch) }} · {{ formatTimestamp(batch.batch) }}
          </div>
        </div>
        <div class="trash-item__actions">
          <button class="btn btn--ghost btn--sm" @click="onRestore(batch)">↩ 恢复</button>
          <button class="btn btn--danger btn--sm" @click="purging = batch">✕ 永久删除</button>
        </div>
      </li>
    </ul>

    <div v-if="purging" class="modal" @click.self="purging = null">
      <div class="modal__body">
        <h3>永久删除</h3>
        <p>将永久删除 <strong>{{ purging.label }}</strong>（{{ describe(purging) }}）。</p>
        <p class="modal__hint">此操作不可恢复。</p>
        <div class="modal__actions">
          <button class="btn btn--ghost" @click="purging = null">取消</button>
          <button class="btn btn--danger" @click="confirmPurge">永久删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.trash-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.trash-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-sm);
  margin-bottom: 8px;
  transition: var(--transition);
}
.trash-item:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-md);
}
.trash-item__main {
  flex: 1;
  min-width: 0;
}
.trash-item__label {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.trash-item__meta {
  font-size: 12px;
  color: var(--muted);
  margin-top: 4px;
  font-variant-numeric: tabular-nums;
}
.trash-item__actions {
  display: flex;
  gap: 6px;
}
</style>
