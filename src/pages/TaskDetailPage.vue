<script setup>
import { ref, computed, onMounted } from 'vue'
import { getTask, getDescendantTasks } from '../services/task'
import { getProject } from '../services/project'
import { listSessionsByTask, updateSessionTimes, softDeleteSession, createSession } from '../services/session'
import { startTask, pauseActive, completeTask } from '../services/activeSession'
import { computeAggregations } from '../services/aggregation'
import { store, pushRoute, backRoute, setToast, refreshActive } from '../store'
import { formatDuration, formatTimestamp, toLocalDatetimeInput, fromLocalDatetimeInput } from '../utils/time'

const props = defineProps({
  taskId: { type: String, required: true }
})

const task = ref(null)
const project = ref(null)
const ancestors = ref([])
const sessions = ref([])
const aggregations = ref(null)
const descendants = ref([])
const loading = ref(true)

const showAdd = ref(false)
const newStart = ref('')
const newEnd = ref('')

const editing = ref(null)
const editStart = ref('')
const editEnd = ref('')

const deleting = ref(null)

async function reload () {
  loading.value = true
  const t = await getTask(props.taskId)
  task.value = t
  if (t) {
    const [p, s, agg, desc] = await Promise.all([
      t.projectId ? getProject(t.projectId) : Promise.resolve(null),
      listSessionsByTask(props.taskId),
      computeAggregations(),
      getDescendantTasks(props.taskId)
    ])
    project.value = p
    sessions.value = s
    aggregations.value = agg
    descendants.value = desc
    const chain = []
    let cur = t.parentId ? await getTask(t.parentId) : null
    while (cur) {
      chain.unshift(cur)
      cur = cur.parentId ? await getTask(cur.parentId) : null
    }
    ancestors.value = chain
  }
  loading.value = false
}

onMounted(reload)

function isActive () {
  return store.active && store.active.taskId === props.taskId
}

async function onStart () {
  await startTask(props.taskId)
  await refreshActive()
  setToast('已开始计时', 'success')
}

async function onPause () {
  await pauseActive()
  await refreshActive()
  await reload()
  setToast('已暂停', 'success')
}

async function onToggleComplete () {
  if (!task.value) return
  await completeTask(task.value._id, !task.value.completed)
  await reload()
  await refreshActive()
}

function openAdd () {
  const now = new Date()
  now.setMinutes(0, 0, 0)
  newStart.value = toLocalDatetimeInput(now.getTime())
  newEnd.value = toLocalDatetimeInput(now.getTime() + 60 * 60 * 1000)
  showAdd.value = true
}

async function confirmAdd () {
  const start = fromLocalDatetimeInput(newStart.value)
  const end = newEnd.value ? fromLocalDatetimeInput(newEnd.value) : null
  if (!start || !end) {
    setToast('请填写开始与结束时间', 'error')
    return
  }
  if (end <= start) {
    setToast('结束时间必须晚于开始时间', 'error')
    return
  }
  await createSession(props.taskId, start, end)
  showAdd.value = false
  await reload()
  setToast('已添加 Session', 'success')
}

function openEdit (session) {
  editing.value = session
  editStart.value = toLocalDatetimeInput(session.start)
  editEnd.value = session.end ? toLocalDatetimeInput(session.end) : ''
}

async function confirmEdit () {
  if (!editing.value) return
  const start = fromLocalDatetimeInput(editStart.value)
  const end = editEnd.value ? fromLocalDatetimeInput(editEnd.value) : null
  if (!start) {
    setToast('请填写开始时间', 'error')
    return
  }
  if (end && end <= start) {
    setToast('结束时间必须晚于开始时间', 'error')
    return
  }
  await updateSessionTimes(editing.value._id, start, end)
  editing.value = null
  await reload()
  setToast('已保存', 'success')
}

async function confirmDelete () {
  if (!deleting.value) return
  await softDeleteSession(deleting.value._id)
  deleting.value = null
  await reload()
  setToast('已移入最近删除', 'success')
}

const selfMs = computed(() => aggregations.value?.taskSelfMs.get(props.taskId) || 0)
const totalMs = computed(() => aggregations.value?.taskTotalMs.get(props.taskId) || 0)
const descendantMs = computed(() => totalMs.value - selfMs.value)
</script>

<template>
  <div class="page">
    <div class="back-bar">
      <button class="btn btn--ghost btn--sm" @click="backRoute()">← 返回</button>
    </div>

    <div v-if="loading" class="page__loading">加载中…</div>
    <template v-else-if="task">
      <header class="page__header">
        <div class="page__title">
          <div class="detail-path">
            <span v-if="project" class="detail-path__crumb">{{ project.name }}</span>
            <span v-for="a in ancestors" :key="a._id" class="detail-path__crumb detail-path__crumb--link" @click="pushRoute('task-detail', { taskId: a._id })">
              {{ a.name }}
            </span>
            <h2>{{ task.name }}</h2>
            <span v-if="task.completed" class="detail-done">✅ 已完成</span>
          </div>
        </div>
        <div class="page__actions">
          <button v-if="!isActive()" class="btn" @click="onStart">▶ 开始</button>
          <button v-else class="btn" @click="onPause()">⏸ 暂停</button>
          <button class="btn btn--ghost" @click="onToggleComplete">
            {{ task.completed ? '取消完成' : '✅ 标完成' }}
          </button>
          <button class="btn btn--ghost" @click="openAdd">+ 添加 Session</button>
        </div>
      </header>

      <div class="detail-summary">
        <div class="summary-item">
          <div class="summary-item__label">自身工时</div>
          <div class="summary-item__value">{{ formatDuration(selfMs) }}</div>
        </div>
        <div class="summary-item">
          <div class="summary-item__label">合计工时</div>
          <div class="summary-item__value">{{ formatDuration(totalMs) }}</div>
          <div v-if="descendantMs > 0" class="summary-item__sub">
            （含后代 {{ formatDuration(descendantMs) }}）
          </div>
        </div>
      </div>

      <h3 class="detail-section">Sessions</h3>
      <div v-if="sessions.length === 0" class="page__empty">
        还没有 Session。点击"开始"或"+ 添加 Session"。
      </div>
      <ul v-else class="session-list">
        <li v-for="s in sessions" :key="s._id" class="session-row" @click="openEdit(s)">
          <div class="session-row__time">
            {{ formatTimestamp(s.start) }} → {{ s.end ? formatTimestamp(s.end) : '计时中…' }}
          </div>
          <div class="session-row__duration">{{ formatDuration(s.effectiveMs || 0) }}</div>
          <div class="session-row__actions">
            <button class="btn btn--danger btn--sm" @click.stop="deleting = s">🗑</button>
          </div>
        </li>
      </ul>

      <div v-if="showAdd" class="modal" @click.self="showAdd = false">
        <div class="modal__body">
          <h3>添加 Session</h3>
          <label class="field-label">开始</label>
          <input v-model="newStart" type="datetime-local" step="1" class="input" />
          <label class="field-label">结束</label>
          <input v-model="newEnd" type="datetime-local" step="1" class="input" />
          <div class="modal__actions">
            <button class="btn btn--ghost" @click="showAdd = false">取消</button>
            <button class="btn" @click="confirmAdd">添加</button>
          </div>
        </div>
      </div>

      <div v-if="editing" class="modal" @click.self="editing = null">
        <div class="modal__body">
          <h3>编辑 Session</h3>
          <label class="field-label">开始</label>
          <input v-model="editStart" type="datetime-local" step="1" class="input" />
          <label class="field-label">结束（留空表示计时中）</label>
          <input v-model="editEnd" type="datetime-local" step="1" class="input" />
          <div class="modal__actions">
            <button class="btn btn--ghost" @click="editing = null">取消</button>
            <button class="btn" @click="confirmEdit">保存</button>
          </div>
        </div>
      </div>

      <div v-if="deleting" class="modal" @click.self="deleting = null">
        <div class="modal__body">
          <h3>删除 Session</h3>
          <p>将此 Session 移入最近删除。</p>
          <div class="modal__actions">
            <button class="btn btn--ghost" @click="deleting = null">取消</button>
            <button class="btn btn--danger" @click="confirmDelete">删除</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.detail-path {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.detail-path__crumb {
  font-size: 11px;
  opacity: 0.6;
}
.detail-path__crumb--link {
  cursor: pointer;
}
.detail-path__crumb--link:hover {
  text-decoration: underline;
}
.detail-done {
  font-size: 12px;
  color: var(--blue);
}
.page__actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.detail-summary {
  display: flex;
  gap: 20px;
  padding: 12px;
  background: var(--hover-bg);
  border-radius: 6px;
  margin-bottom: 18px;
}
.summary-item__label {
  font-size: 11px;
  opacity: 0.6;
}
.summary-item__value {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 18px;
  font-weight: 600;
  color: var(--blue);
}
.summary-item__sub {
  font-size: 11px;
  opacity: 0.6;
}
.detail-section {
  font-size: 13px;
  margin: 14px 0 8px;
  opacity: 0.7;
}
.session-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.session-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
}
.session-row:hover {
  background: var(--hover-bg);
}
.session-row__time {
  flex: 1;
  font-size: 13px;
}
.session-row__duration {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 13px;
  font-weight: 500;
}
.session-row__actions {
  display: flex;
  gap: 3px;
}
.field-label {
  display: block;
  font-size: 11px;
  opacity: 0.6;
  margin: 8px 0 4px;
}
</style>
