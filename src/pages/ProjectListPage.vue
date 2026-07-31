<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { listProjects, createProject, renameProject, softDeleteProjectCascade, setProjectArchived } from '../services/project'
import { computeAggregations } from '../services/aggregation'
import { pushRoute, setToast, refreshActive } from '../store'
import { formatDuration } from '../utils/time'

const SHOW_ARCHIVED_KEY = 'timetrack:showArchived'

const projects = ref([])
const aggregations = ref(null)
const loading = ref(true)
const showCreate = ref(false)
const newName = ref('')
const renaming = ref(null)
const renameValue = ref('')
const deleting = ref(null)
const showArchived = ref(localStorage.getItem(SHOW_ARCHIVED_KEY) === '1')

watch(showArchived, (v) => {
  localStorage.setItem(SHOW_ARCHIVED_KEY, v ? '1' : '0')
})

async function reload () {
  loading.value = true
  const [list, agg] = await Promise.all([listProjects(), computeAggregations()])
  projects.value = list
  aggregations.value = agg
  loading.value = false
}

onMounted(reload)

function openCreate () {
  newName.value = ''
  showCreate.value = true
}

async function confirmCreate () {
  const name = newName.value.trim()
  if (!name) return
  await createProject(name)
  showCreate.value = false
  await reload()
  setToast('已创建项目', 'success')
}

function openRename (project) {
  renaming.value = project
  renameValue.value = project.name
}

async function confirmRename () {
  const name = renameValue.value.trim()
  if (!name || !renaming.value) return
  await renameProject(renaming.value._id, name)
  renaming.value = null
  await reload()
  setToast('已重命名', 'success')
}

function openDelete (project) {
  deleting.value = project
}

async function confirmDelete () {
  if (!deleting.value) return
  const result = await softDeleteProjectCascade(deleting.value._id)
  deleting.value = null
  await reload()
  await refreshActive()
  setToast(`已删除（${result.count} 项），可在最近删除恢复`, 'success')
}

async function toggleArchive (project) {
  await setProjectArchived(project._id, !project.archivedAt)
  await reload()
  setToast(project.archivedAt ? '已取消归档' : '已归档', 'success')
}

const todayMs = computed(() => aggregations.value?.todayTotalMs || 0)
const visibleProjects = computed(() => {
  if (showArchived.value) return projects.value
  return projects.value.filter((p) => !p.archivedAt)
})
const archivedCount = computed(() => projects.value.filter((p) => p.archivedAt).length)
</script>

<template>
  <div class="page">
    <header class="page__header">
      <div class="page__title">
        <h2>项目</h2>
        <span class="pill">今日 {{ formatDuration(todayMs) }}</span>
      </div>
      <div class="page__actions">
        <button
          class="btn"
          :class="showArchived ? 'btn--toggle-on' : 'btn--ghost'"
          @click="showArchived = !showArchived"
        >
          已归档
          <span v-if="archivedCount > 0" class="btn__badge">{{ archivedCount }}</span>
        </button>
        <button class="btn btn--ghost" @click="pushRoute('trash')">📋 最近删除</button>
        <button class="btn btn--ghost" @click="pushRoute('settings')">⚙ 设置</button>
        <button class="btn" @click="openCreate">+ 新建项目</button>
      </div>
    </header>

    <div v-if="loading" class="page__loading">加载中…</div>
    <div v-else-if="visibleProjects.length === 0" class="page__empty">
      <template v-if="archivedCount > 0">
        没有活跃项目。{{ archivedCount }} 个已归档，点击"显示归档"查看。
      </template>
      <template v-else>
        还没有项目。点击右上角"新建项目"开始记录工时。
      </template>
    </div>
    <ul v-else class="project-list">
      <li
        v-for="p in visibleProjects"
        :key="p._id"
        class="project-item"
        :class="{ 'project-item--archived': p.archivedAt }"
      >
        <div class="project-item__main" @click="pushRoute('task-tree', { projectId: p._id })">
          <div class="project-item__name">
            {{ p.name }}
            <span v-if="p.archivedAt" class="project-item__archived-pill">已归档</span>
          </div>
          <div class="project-item__total">合计 {{ formatDuration(aggregations.projectTotalMs.get(p._id) || 0) }}</div>
        </div>
        <div class="project-item__actions">
          <button class="btn btn--ghost" :title="p.archivedAt ? '取消归档' : '归档'" @click="toggleArchive(p)">
            {{ p.archivedAt ? '↩' : '📦' }}
          </button>
          <button class="btn btn--ghost" @click="openRename(p)">✎</button>
          <button class="btn btn--danger" @click="openDelete(p)">×</button>
        </div>
      </li>
    </ul>

    <div v-if="showCreate" class="modal" @click.self="showCreate = false">
      <div class="modal__body">
        <h3>新建项目</h3>
        <input
          v-model="newName"
          class="input"
          placeholder="项目名称"
          autofocus
          @keydown.enter="confirmCreate"
          @keydown.esc="showCreate = false"
        />
        <div class="modal__actions">
          <button class="btn btn--ghost" @click="showCreate = false">取消</button>
          <button class="btn" @click="confirmCreate">创建</button>
        </div>
      </div>
    </div>

    <div v-if="renaming" class="modal" @click.self="renaming = null">
      <div class="modal__body">
        <h3>重命名项目</h3>
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
        <h3>删除项目</h3>
        <p>将删除项目 <strong>{{ deleting.name }}</strong> 及其下所有 Task 和工时。</p>
        <p class="modal__hint">可在"最近删除"中恢复。</p>
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
.project-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.project-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-sm);
  margin-bottom: 8px;
  transition: var(--transition);
}
.project-item:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}
.project-item--archived {
  background: var(--card-bg-soft);
  border-style: dashed;
}
.project-item--archived .project-item__name {
  color: var(--text-soft);
  font-weight: 500;
}
.project-item__main {
  flex: 1;
  cursor: pointer;
  min-width: 0;
}
.project-item__name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 8px;
}
.project-item__archived-pill {
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 999px;
  background: var(--hover-bg);
  color: var(--muted);
  font-weight: 500;
  flex-shrink: 0;
}
.project-item__total {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-variant-numeric: tabular-nums;
  font-size: 13px;
  color: var(--text-soft);
  margin-top: 4px;
}
.project-item__actions {
  display: flex;
  gap: 4px;
}
.btn__badge {
  display: inline-block;
  margin-left: 4px;
  padding: 1px 6px;
  font-size: 11px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
}
.btn--toggle-on .btn__badge {
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
}
</style>
