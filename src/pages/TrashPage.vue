<script setup>
import { ref, computed, onMounted } from 'vue'
import { listTrashBatches, restoreBatch, purgeBatch, purgeAll } from '../services/trash'
import { backRoute, setToast } from '../store'
import { formatTimestamp } from '../utils/time'

const batches = ref([])
const loading = ref(true)
const purging = ref(null)
const purgingAll = ref(false)

const totalTrashCount = computed(() =>
  batches.value.reduce((s, b) => s + (b.items?.length || 0), 0)
)

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

function kindLabel (kind) {
  if (kind === 'project') return '项目'
  if (kind === 'task') return '任务'
  return '工时'
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

async function confirmPurgeAll () {
  const n = await purgeAll()
  purgingAll.value = false
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
      <div class="page__title">
        <h2>最近删除</h2>
      </div>
      <div v-if="batches.length > 0" class="page__actions">
        <button class="btn btn--danger btn--sm" @click="purgingAll = true">
          清空全部
        </button>
      </div>
    </header>

    <div v-if="loading" class="page__loading">加载中…</div>
    <div v-else-if="batches.length === 0" class="page__empty">
      暂无已删除项。
    </div>
    <ul v-else class="trash-list">
      <li v-for="batch in batches" :key="batch.batch" class="trash-card">
        <div class="trash-card__head">
          <div class="trash-card__head-main">
            <div class="trash-card__title">
              <span v-if="batch.rootProjectName" class="trash-card__root">{{ batch.rootProjectName }}</span>
              <span v-else class="trash-card__root trash-card__root--muted">工时记录</span>
            </div>
            <div class="trash-card__meta">
              <span class="trash-card__summary">{{ describe(batch) }}</span>
              <span class="trash-card__sep">·</span>
              <span class="trash-card__time">{{ formatTimestamp(batch.batch) }}</span>
            </div>
          </div>
          <div class="trash-card__actions">
            <button class="btn btn--ghost btn--sm" @click="onRestore(batch)">↩ 恢复</button>
            <button class="btn btn--danger btn--sm" @click="purging = batch">✕ 永久删除</button>
          </div>
        </div>

        <ul v-if="batch.details && batch.details.length > 0" class="trash-card__details">
          <li
            v-for="(d, i) in batch.details"
            :key="i"
            class="trash-detail"
            :class="`trash-detail--${d.kind}`"
          >
            <span class="trash-detail__kind">{{ kindLabel(d.kind) }}</span>
            <div class="trash-detail__body">
              <div class="trash-detail__title-row">
                <span v-if="d.projectName" class="trash-detail__project">{{ d.projectName }}</span>
                <span v-if="d.projectName && d.taskName" class="trash-detail__sep">/</span>
                <span v-if="d.taskName" class="trash-detail__task">{{ d.taskName }}</span>
                <span v-if="d.kind === 'project' && d.text" class="trash-detail__sub">
                  {{ d.text }}
                </span>
              </div>
              <div v-if="d.timeRange || d.duration" class="trash-detail__sub-row">
                <span v-if="d.timeRange" class="trash-detail__range">{{ d.timeRange }}</span>
                <span v-if="d.timeRange && d.duration" class="trash-detail__sep">·</span>
                <span v-if="d.duration" class="trash-detail__duration">{{ d.duration }}</span>
              </div>
            </div>
          </li>
        </ul>
      </li>
    </ul>

    <div v-if="purging" class="modal" @click.self="purging = null">
      <div class="modal__body">
        <h3>永久删除</h3>
        <p>将永久删除 <strong>{{ purging.rootProjectName || purging.label }}</strong>（{{ describe(purging) }}）。</p>
        <p class="modal__hint">此操作不可恢复。</p>
        <div class="modal__actions">
          <button class="btn btn--ghost" @click="purging = null">取消</button>
          <button class="btn btn--danger" @click="confirmPurge">永久删除</button>
        </div>
      </div>
    </div>

    <div v-if="purgingAll" class="modal" @click.self="purgingAll = false">
      <div class="modal__body">
        <h3>清空回收站</h3>
        <p>将永久删除回收站中的全部 <strong>{{ totalTrashCount }}</strong> 项记录。</p>
        <p class="modal__hint">此操作不可恢复。</p>
        <div class="modal__actions">
          <button class="btn btn--ghost" @click="purgingAll = false">取消</button>
          <button class="btn btn--danger" @click="confirmPurgeAll">全部删除</button>
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
.trash-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-sm);
  margin-bottom: 12px;
  transition: var(--transition);
  overflow: hidden;
}
.trash-card:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-md);
}
.trash-card__head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: linear-gradient(135deg, var(--card-bg) 0%, var(--card-bg-soft) 100%);
  border-bottom: 1px solid var(--border);
}
.trash-card__head-main {
  flex: 1;
  min-width: 0;
}
.trash-card__title {
  display: flex;
  align-items: center;
  gap: 8px;
}
.trash-card__root {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.trash-card__root--muted {
  color: var(--muted);
  font-weight: 500;
}
.trash-card__meta {
  font-size: 12px;
  color: var(--muted);
  margin-top: 4px;
  font-variant-numeric: tabular-nums;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.trash-card__sep {
  color: var(--border-strong);
}
.trash-card__actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.trash-card__details {
  list-style: none;
  padding: 6px 0;
  margin: 0;
}
.trash-detail {
  display: flex;
  gap: 10px;
  padding: 8px 16px;
  align-items: flex-start;
  border-bottom: 1px dashed var(--border);
}
.trash-detail:last-child {
  border-bottom: none;
}
.trash-detail__kind {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 999px;
  background: var(--hover-bg);
  color: var(--text-soft);
  letter-spacing: 0.3px;
  margin-top: 2px;
  min-width: 32px;
  text-align: center;
}
.trash-detail--session .trash-detail__kind {
  background: var(--accent-soft);
  color: var(--accent);
}
.trash-detail--task .trash-detail__kind {
  background: var(--success-soft);
  color: var(--success);
}
.trash-detail--project .trash-detail__kind {
  background: var(--warning-soft);
  color: var(--warning);
}
.trash-detail__body {
  flex: 1;
  min-width: 0;
}
.trash-detail__title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  flex-wrap: wrap;
}
.trash-detail__project {
  color: var(--text-soft);
  font-size: 12px;
}
.trash-detail__sep {
  color: var(--border-strong);
  font-size: 12px;
}
.trash-detail__task {
  color: var(--text);
  font-weight: 500;
}
.trash-detail__sub {
  color: var(--muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.trash-detail__sub-row {
  margin-top: 3px;
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
  font-size: 12px;
}
.trash-detail__range {
  color: var(--text-soft);
  font-variant-numeric: tabular-nums;
}
.trash-detail__duration {
  color: var(--accent);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
}
</style>
