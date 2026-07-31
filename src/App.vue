<script setup>
import { onMounted, onUnmounted } from 'vue'
import ActiveSessionCard from './components/ActiveSessionCard.vue'
import ProjectListPage from './pages/ProjectListPage.vue'
import TaskTreePage from './pages/TaskTreePage.vue'
import TaskDetailPage from './pages/TaskDetailPage.vue'
import SettingsPage from './pages/SettingsPage.vue'
import TrashPage from './pages/TrashPage.vue'
import { store, router, refreshAll, startTicker, stopTicker, resetRoute } from './store'

onMounted(async () => {
  await refreshAll()
  startTicker()
  window.utools.onPluginEnter((action) => {
    if (action.code === 'timetrack') {
      resetRoute()
      refreshAll()
    }
  })
})

onUnmounted(() => {
  stopTicker()
})
</script>

<template>
  <div class="app">
    <ActiveSessionCard />
    <main class="app__main">
      <ProjectListPage v-if="router.current.name === 'project-list'" />
      <TaskTreePage v-else-if="router.current.name === 'task-tree'" :project-id="router.current.params.projectId" />
      <TaskDetailPage v-else-if="router.current.name === 'task-detail'" :task-id="router.current.params.taskId" />
      <SettingsPage v-else-if="router.current.name === 'settings'" />
      <TrashPage v-else-if="router.current.name === 'trash'" />
    </main>
    <div v-if="store.toast" class="app__toast" :class="`app__toast--${store.toast.type}`">{{ store.toast.msg }}</div>
  </div>
</template>

<style>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.app__main {
  flex: 1;
  overflow-y: auto;
}
.app__toast {
  position: fixed;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  border-radius: 6px;
  font-size: 13px;
  z-index: 100;
}
.app__toast--error {
  background: rgba(220, 38, 38, 0.9);
}
.app__toast--success {
  background: rgba(22, 163, 74, 0.9);
}
</style>
