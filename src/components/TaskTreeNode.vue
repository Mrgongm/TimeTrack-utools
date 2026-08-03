<script setup>
import { ref, inject } from 'vue'

const props = defineProps({
  task: { type: Object, required: true }
})

const ctx = inject('taskTreeCtx')

const dropPos = ref(null)

function onDragStart (e) {
  ctx.setDraggedTaskId(props.task._id)
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', props.task._id)
}

function onDragEnd () {
  ctx.setDraggedTaskId(null)
  dropPos.value = null
}

function onDragOver (e) {
  if (!ctx.canDropOn(props.task)) return
  e.preventDefault()
  e.stopPropagation()
  e.dataTransfer.dropEffect = 'move'
  const rect = e.currentTarget.getBoundingClientRect()
  dropPos.value = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
}

function onDragLeave (e) {
  if (e.currentTarget.contains(e.relatedTarget)) return
  dropPos.value = null
}

function onDrop (e) {
  if (!ctx.canDropOn(props.task) || !dropPos.value) return
  e.preventDefault()
  e.stopPropagation()
  ctx.dropTask(props.task, dropPos.value)
  dropPos.value = null
}
</script>

<template>
  <li>
    <div
      class="task-row"
      :class="{
        'task-row--active': ctx.isActive(task._id),
        'task-row--done': task.completed,
        'task-row--dragging': ctx.draggedTaskId === task._id,
        'task-row--drop-before': dropPos === 'before',
        'task-row--drop-after': dropPos === 'after'
      }"
      draggable="true"
      @dragstart="onDragStart"
      @dragend="onDragEnd"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <span
        v-if="ctx.childrenOf(task._id).length > 0"
        class="task-row__expand"
        @click="ctx.toggleExpand(task._id)"
      >
        {{ ctx.expanded.has(task._id) ? '▾' : '▸' }}
      </span>
      <span v-else class="task-row__expand task-row__expand--blank"></span>
      <span class="task-row__complete" @click="ctx.onToggleComplete(task)">
        {{ task.completed ? '✅' : '⬜' }}
      </span>
      <span class="task-row__name" @click="ctx.toggleExpand(task._id)">
        {{ task.name }}
      </span>
      <span
        class="task-row__duration"
        :title="'打开详情'"
        @click="ctx.pushRoute('task-detail', { taskId: task._id })"
      >
        {{ ctx.formatDuration(ctx.aggregations.taskTotalMs.get(task._id) || 0) }}
      </span>
      <div class="task-row__actions">
        <button v-if="!ctx.isActive(task._id)" class="btn btn--sm" @click="ctx.onStart(task._id)">▶</button>
        <button v-else class="btn btn--sm" @click="ctx.onPause()">⏸</button>
        <button class="btn btn--ghost btn--sm" @click="ctx.openRename(task)">✎</button>
        <button class="btn btn--ghost btn--sm" @click="ctx.openAddChild(task)">＋</button>
        <button class="btn btn--danger btn--sm" @click="ctx.openDelete(task)">×</button>
      </div>
    </div>
    <ul v-if="ctx.expanded.has(task._id)" class="task-tree__children">
      <TaskTreeNode
        v-for="child in ctx.childrenOf(task._id)"
        :key="child._id"
        :task="child"
      />
    </ul>
  </li>
</template>

<style scoped>
.task-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--shadow-sm);
  margin-bottom: 6px;
  transition: var(--transition);
  position: relative;
}
.task-row:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-md);
}
.task-row--dragging {
  opacity: 0.4;
}
.task-row--drop-before::before,
.task-row--drop-after::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--accent);
  border-radius: 1px;
  z-index: 1;
}
.task-row--drop-before::before {
  top: -4px;
}
.task-row--drop-after::after {
  bottom: -4px;
}
.task-row--active {
  border-left: 3px solid var(--success);
  background: linear-gradient(135deg, var(--success-soft) 0%, var(--card-bg) 60%);
  padding-left: 10px;
}
.task-row--done .task-row__name {
  text-decoration: line-through;
  color: var(--text-soft);
}
.task-row__expand {
  cursor: pointer;
  width: 16px;
  text-align: center;
  font-size: 12px;
  color: var(--muted);
  flex-shrink: 0;
}
.task-row__expand--blank {
  cursor: default;
}
.task-row__complete {
  cursor: pointer;
  font-size: 14px;
  flex-shrink: 0;
}
.task-row__name {
  flex: 1;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.task-row__duration {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-variant-numeric: tabular-nums;
  font-size: 15px;
  font-weight: 700;
  color: var(--accent);
  cursor: pointer;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  transition: var(--transition);
}
.task-row__duration:hover {
  background: var(--accent-soft);
}
.task-row__actions {
  display: flex;
  gap: 3px;
  flex-shrink: 0;
}
.task-tree__children {
  list-style: none;
  padding-left: 20px;
  margin: 4px 0 0;
}
.task-tree__children .task-row {
  background: var(--card-bg-soft);
}
</style>
