<script setup>
import { inject } from 'vue'

const props = defineProps({
  task: { type: Object, required: true }
})

const ctx = inject('taskTreeCtx')
</script>

<template>
  <li>
    <div
      class="task-row"
      :class="{ 'task-row--active': ctx.isActive(task._id), 'task-row--done': task.completed }"
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
      <span class="task-row__name" @click="ctx.pushRoute('task-detail', { taskId: task._id })">
        {{ task.name }}
      </span>
      <span class="task-row__duration">
        {{ ctx.formatDuration(ctx.aggregations.taskTotalMs.get(task._id) || 0) }}
      </span>
      <div class="task-row__actions">
        <button v-if="!ctx.isActive(task._id)" class="btn btn--sm" @click="ctx.onStart(task._id)">▶</button>
        <button v-else class="btn btn--sm" @click="ctx.onPause()">⏸</button>
        <button class="btn btn--ghost btn--sm" @click="ctx.openAddChild(task)">＋</button>
        <button class="btn btn--ghost btn--sm" @click="ctx.openRename(task)">✏</button>
        <button class="btn btn--danger btn--sm" @click="ctx.openDelete(task)">🗑</button>
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
  gap: 6px;
  padding: 8px 8px;
  border-radius: 6px;
}
.task-row:hover {
  background: var(--hover-bg);
}
.task-row--active {
  background: rgba(88, 164, 246, 0.12);
}
.task-row--done .task-row__name {
  text-decoration: line-through;
  opacity: 0.5;
}
.task-row__expand {
  cursor: pointer;
  width: 16px;
  text-align: center;
  font-size: 12px;
  opacity: 0.7;
}
.task-row__expand--blank {
  cursor: default;
}
.task-row__complete {
  cursor: pointer;
  font-size: 14px;
}
.task-row__name {
  flex: 1;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.task-row__duration {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12px;
  opacity: 0.7;
}
.task-row__actions {
  display: flex;
  gap: 3px;
}
.task-tree__children {
  list-style: none;
  padding-left: 22px;
  margin: 0;
}
</style>
