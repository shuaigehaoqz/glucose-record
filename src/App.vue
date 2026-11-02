<script setup>
import { ref } from 'vue'
import TabBar from './components/TabBar.vue'
import ChatView from './components/ChatView.vue'
import HistoryView from './components/HistoryView.vue'
import AnalysisView from './components/AnalysisView.vue'
import CategorySheet from './components/CategorySheet.vue'
import { ui } from './store.js'

const tab = ref('chat')
</script>

<template>
  <div class="relative mx-auto flex h-dvh max-w-[480px] flex-col overflow-hidden bg-paper text-ink">
    <ChatView v-if="tab === 'chat'" />
    <HistoryView v-else-if="tab === 'history'" />
    <AnalysisView v-else />
    <TabBar v-model="tab" />
    <CategorySheet />

    <transition name="fade">
      <div
        v-if="ui.toast"
        class="pointer-events-none absolute bottom-24 left-1/2 z-50 max-w-[86%] -translate-x-1/2 rounded-full bg-ink/90 px-4 py-2 text-center text-sm text-white shadow-lg"
      >
        {{ ui.toast }}
      </div>
    </transition>
  </div>
</template>
