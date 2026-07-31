<script setup>
import { ref, computed, onMounted, provide, reactive } from 'vue'
import { listTasksByProject, getDescendantTasks, createTask, renameTask, softDeleteTaskSubtreeCascade } from '../services/task'
import { getProject } from '../services/project'
import { startTask, pauseActive, completeTask } from '../services/activeSession'
import { computeAggregations } from '../services/aggregation'
import { store, pushRoute, backRoute, setToast, refreshActive } from '../store'
import { formatDuration } from '../utils/time'
import TaskTreeNode from '../components/TaskTreeNode.vue'

const props = defineProps({
  projectId: { type: String, required: true }
})

const project = ref(null)
const tasks = ref([])
const aggregations = ref(null)
const loading = ref(true)
const expanded = ref(new Set())
const showCreateTop = ref(false)
const newTopName = ref('')
const addingChildFor = ref(null)
const newChildName = ref('')
const renaming = ref(null)
const renameValue = ref('')
const deleting = ref(null)

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

const tree = computed(() => {
  const byParent = new Map()
  for (const t of tasks.value) {
    const key = t.parentId || '__root__'
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key).push(t)
  }
  return byParent
})

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
        <span class="page__total">合计 {{ formatDuration(projectTotalMs) }}</span>
      </div>
      <button class="btn" @click="openCreateTop">+ 创建任务</button>
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
          及其 {{ deleting._descendants.length }} 个子任务，所有相关 Sessions 一并移入最近删除。
        </p>
        <p v-else class="modal__hint">所有相关 Sessions 一并移入最近删除。</p>
        <div class="modal__actions">
          <button class="btn btn--ghost" @click="deleting = null">取消</button>
          <button class="btn btn--danger" @click="confirmDelete">删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page__total {
  font-size: 12px;
  font-family: ui-monospace, Menlo, monospace;
  color: var(--blue);
}
.task-tree {
  list-style: none;
  padding: 0;
  margin: 0;
}
</style>
