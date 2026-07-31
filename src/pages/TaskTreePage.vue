<script setup>
import { ref, computed, onMounted, watch, provide, reactive } from 'vue'
import { listTasksByProject, getDescendantTasks, createTask, renameTask, softDeleteTaskSubtreeCascade } from '../services/task'
import { getProject } from '../services/project'
import { startTask, pauseActive, completeTask } from '../services/activeSession'
import { computeAggregations } from '../services/aggregation'
import { exportProjectReport } from '../services/exportProjectReport'
import { store, pushRoute, backRoute, setToast, refreshActive } from '../store'
import { formatDuration } from '../utils/time'
import TaskTreeNode from '../components/TaskTreeNode.vue'

const HIDE_COMPLETED_KEY = 'timetrack:hideCompleted'

const props = defineProps({
  projectId: { type: String, required: true }
})

const project = ref(null)
const tasks = ref([])
const aggregations = ref(null)
const loading = ref(true)
const expanded = ref(new Set())
const hideCompleted = ref(localStorage.getItem(HIDE_COMPLETED_KEY) === '1')
const showCreateTop = ref(false)
const newTopName = ref('')
const addingChildFor = ref(null)
const newChildName = ref('')
const renaming = ref(null)
const renameValue = ref('')
const deleting = ref(null)

watch(hideCompleted, (v) => {
  localStorage.setItem(HIDE_COMPLETED_KEY, v ? '1' : '0')
})

async function reload () {
  loading.value = true
  const [p, list, agg] = await Promise.all([
    getProject(props.projectId),
    listTasksByProject(props.projectId),
    computeAggregations()
  ])
  project.value = p
  tasks.value = list
  aggregations.value = agg
  loading.value = false
}

onMounted(reload)

const exporting = ref(false)
async function onExportReport () {
  if (exporting.value) return
  exporting.value = true
  try {
    const path = await exportProjectReport(props.projectId)
    setToast(`已导出到 ${path}`, 'success')
  } catch (e) {
    setToast(`导出失败: ${e.message || e}`, 'error')
  } finally {
    exporting.value = false
  }
}

const tree = computed(() => {
  const byParent = new Map()
  for (const t of tasks.value) {
    if (hideCompleted.value && t.completed) continue
    const key = t.parentId || '__root__'
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key).push(t)
  }
  return byParent
})

const hiddenCount = computed(() => hideCompleted.value ? tasks.value.filter((t) => t.completed).length : 0)

function childrenOf (parentId) {
  return tree.value.get(parentId || '__root__') || []
}

function toggleExpand (id) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

function isActive (taskId) {
  return store.active && store.active.taskId === taskId
}

async function onStart (taskId) {
  await startTask(taskId)
  await refreshActive()
  aggregations.value = await computeAggregations()
  setToast('已开始计时', 'success')
}

async function onPause () {
  await pauseActive()
  await refreshActive()
  aggregations.value = await computeAggregations()
  setToast('已暂停', 'success')
}

async function onToggleComplete (task) {
  await completeTask(task._id, !task.completed)
  await reload()
  await refreshActive()
  setToast(task.completed ? '已取消完成' : '已标记完成', 'success')
}

function openCreateTop () {
  newTopName.value = ''
  showCreateTop.value = true
}

async function confirmCreateTop () {
  const name = newTopName.value.trim()
  if (!name) return
  await createTask(props.projectId, null, name)
  showCreateTop.value = false
  await reload()
  setToast('已创建任务', 'success')
}

function openAddChild (task) {
  addingChildFor.value = task
  newChildName.value = ''
}

async function confirmAddChild () {
  const name = newChildName.value.trim()
  if (!name || !addingChildFor.value) return
  await createTask(props.projectId, addingChildFor.value._id, name)
  const parentId = addingChildFor.value._id
  expanded.value = new Set(expanded.value).add(parentId)
  addingChildFor.value = null
  await reload()
  setToast('已创建子任务', 'success')
}

function openRename (task) {
  renaming.value = task
  renameValue.value = task.name
}

async function confirmRename () {
  const name = renameValue.value.trim()
  if (!name || !renaming.value) return
  await renameTask(renaming.value._id, name)
  renaming.value = null
  await reload()
  setToast('已重命名', 'success')
}

async function openDelete (task) {
  deleting.value = { ...task, _descendants: await getDescendantTasks(task._id) }
}

async function confirmDelete () {
  if (!deleting.value) return
  const result = await softDeleteTaskSubtreeCascade(deleting.value._id)
  deleting.value = null
  await reload()
  await refreshActive()
  setToast(`已删除（${result.taskCount} 任务 / ${result.sessionCount} 段）`, 'success')
}

provide('taskTreeCtx', reactive({
  childrenOf,
  expanded,
  toggleExpand,
  isActive,
  onStart,
  onPause,
  onToggleComplete,
  openAddChild,
  openRename,
  openDelete,
  aggregations,
  pushRoute,
  formatDuration
}))

const projectTotalMs = computed(() => {
  return aggregations.value?.projectTotalMs.get(props.projectId) || 0
})
</script>

<template>
  <div class="page">
    <div class="back-bar">
      <button class="btn btn--ghost btn--sm" @click="backRoute()">← 返回</button>
    </div>

    <header class="page__header">
      <div class="page__title">
        <h2 v-if="project">{{ project.name }}</h2>
        <span class="pill">合计 {{ formatDuration(projectTotalMs) }}</span>
      </div>
      <div class="page__actions">
        <button class="btn btn--ghost" @click="hideCompleted = !hideCompleted">
          {{ hideCompleted ? '显示已完成' : '隐藏已完成' }}
        </button>
        <button class="btn btn--ghost" :disabled="exporting" @click="onExportReport">
          {{ exporting ? '导出中…' : '⬇ 导出工时' }}
        </button>
        <button class="btn" @click="openCreateTop">+ 创建任务</button>
      </div>
    </header>

    <div v-if="loading" class="page__loading">加载中…</div>
    <div v-else-if="tasks.length === 0" class="page__empty">
      还没有任务。点击"创建任务"开始。
    </div>
    <ul v-else class="task-tree">
      <TaskTreeNode
        v-for="task in childrenOf(null)"
        :key="task._id"
        :task="task"
      />
    </ul>
    <div v-if="!loading && hiddenCount > 0" class="tree-hidden-hint">
      已隐藏 {{ hiddenCount }} 个完成任务
    </div>

    <div v-if="showCreateTop" class="modal" @click.self="showCreateTop = false">
      <div class="modal__body">
        <h3>新建任务</h3>
        <input
          v-model="newTopName"
          class="input"
          placeholder="任务名称"
          autofocus
          @keydown.enter="confirmCreateTop"
          @keydown.esc="showCreateTop = false"
        />
        <div class="modal__actions">
          <button class="btn btn--ghost" @click="showCreateTop = false">取消</button>
          <button class="btn" @click="confirmCreateTop">创建</button>
        </div>
      </div>
    </div>

    <div v-if="addingChildFor" class="modal" @click.self="addingChildFor = null">
      <div class="modal__body">
        <h3>添加子任务到 "{{ addingChildFor.name }}"</h3>
        <input
          v-model="newChildName"
          class="input"
          placeholder="子任务名称"
          autofocus
          @keydown.enter="confirmAddChild"
          @keydown.esc="addingChildFor = null"
        />
        <div class="modal__actions">
          <button class="btn btn--ghost" @click="addingChildFor = null">取消</button>
          <button class="btn" @click="confirmAddChild">创建</button>
        </div>
      </div>
    </div>

    <div v-if="renaming" class="modal" @click.self="renaming = null">
      <div class="modal__body">
        <h3>重命名任务</h3>
        <input
          v-model="renameValue"
          class="input"
          autofocus
          @keydown.enter="confirmRename"
          @keydown.esc="renaming = null"
        />
        <div class="modal__actions">
          <button class="btn btn--ghost" @click="renaming = null">取消</button>
          <button class="btn" @click="confirmRename">保存</button>
        </div>
      </div>
    </div>

    <div v-if="deleting" class="modal" @click.self="deleting = null">
      <div class="modal__body">
        <h3>删除任务</h3>
        <p>将删除任务 <strong>{{ deleting.name }}</strong></p>
        <p v-if="deleting._descendants && deleting._descendants.length > 0" class="modal__hint">
          及其 {{ deleting._descendants.length }} 个子任务，所有相关工时一并移入最近删除。
        </p>
        <p v-else class="modal__hint">所有相关工时一并移入最近删除。</p>
        <div class="modal__actions">
          <button class="btn btn--ghost" @click="deleting = null">取消</button>
          <button class="btn btn--danger" @click="confirmDelete">删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page__actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.task-tree {
  list-style: none;
  padding: 0;
  margin: 0;
}
.tree-hidden-hint {
  margin-top: 12px;
  padding: 8px 12px;
  text-align: center;
  font-size: 12px;
  color: var(--muted);
  background: var(--card-bg-soft);
  border: 1px dashed var(--border);
  border-radius: var(--radius-md);
}
</style>
