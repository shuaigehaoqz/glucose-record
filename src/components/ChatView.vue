<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import {
  store,
  addChatRecord,
  removeRecord,
  openCategorySheet,
  timePart,
} from '../store.js'

const draft = ref('')
const error = ref('')
const listEl = ref(null)
const kb = ref(0)

const hasRecord = (id) => !!id && store.records.some((r) => r.id === id)

const todayStats = computed(() => {
  const today = new Date()
  const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const list = store.records.filter((r) => r.time.startsWith(key))
  if (!list.length) return null
  const avg = list.reduce((s, r) => s + r.value, 0) / list.length
  return { count: list.length, avg: Math.round(avg * 10) / 10 }
})

function scrollBottom() {
  nextTick(() => {
    const el = listEl.value
    if (el) el.scrollTop = el.scrollHeight
  })
}
watch(() => store.messages.length, scrollBottom)

function send() {
  const s = draft.value.trim()
  if (!s) return
  const v = Number(s)
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(s) || isNaN(v) || v < 1 || v > 33.3) {
    error.value = '请输入 1.0 – 33.3 之间的数值（mmol/L），例如 5.6'
    return
  }
  error.value = ''
  draft.value = ''
  addChatRecord(Math.round(v * 100) / 100)
  scrollBottom()
}

function onViewport() {
  const vv = window.visualViewport
  if (!vv) return
  kb.value = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
  scrollBottom()
}

onMounted(() => {
  scrollBottom()
  window.visualViewport?.addEventListener('resize', onViewport)
})
onUnmounted(() => window.visualViewport?.removeEventListener('resize', onViewport))
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col transition-[padding] duration-150" :style="{ paddingBottom: kb ? kb + 'px' : undefined }">
    <header
      class="shrink-0 bg-paper/95 px-5 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 backdrop-blur"
    >
      <div class="flex items-baseline justify-between">
        <div>
          <h1 class="text-xl font-bold tracking-tight">记录血糖</h1>
          <p class="mt-0.5 text-xs text-muted">发送数值即可保存，自动按时间分类</p>
        </div>
        <span v-if="todayStats" class="num rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand-dark">
          今日 {{ todayStats.count }} 条 · 均值 {{ todayStats.avg }}
        </span>
      </div>
    </header>

    <div ref="listEl" class="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pt-2 pb-4">
      <template v-for="m in store.messages" :key="m.id">
        <!-- 用户消息 -->
        <div v-if="m.role === 'user'" class="flex flex-col items-end">
          <div
            class="max-w-[76%] rounded-3xl rounded-br-lg px-4 py-2.5 text-white"
            :class="m.withdrawn ? 'bg-muted/60' : 'bg-brand'"
          >
            <div class="num flex items-baseline gap-1 text-2xl font-semibold leading-none">
              <span :class="m.withdrawn ? 'line-through opacity-70' : ''">{{ m.text }}</span>
              <span class="text-[11px] font-normal opacity-80">mmol/L</span>
            </div>
            <div class="num mt-1.5 text-right text-[11px] opacity-75">
              {{ timePart(m.time) }}
              <template v-if="m.withdrawn"> · 已撤回</template>
            </div>
          </div>
          <button
            v-if="!m.withdrawn && hasRecord(m.recordId)"
            class="mt-1 mr-1 rounded-full px-3 py-1 text-xs text-muted active:bg-line"
            @click="removeRecord(m.recordId)"
          >
            撤回
          </button>
        </div>

        <!-- 助手消息 -->
        <div v-else class="flex items-start gap-2">
          <span
            class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-dark"
          >
            <svg viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor">
              <path d="M12 3.5s-5.5 6.2-5.5 9.7a5.5 5.5 0 0 0 11 0c0-3.5-5.5-9.7-5.5-9.7Z" />
            </svg>
          </span>
          <div class="max-w-[82%] rounded-3xl rounded-tl-lg bg-white px-4 py-3 text-sm leading-relaxed shadow-sm ring-1 ring-line">
            <p>{{ m.text }}</p>
            <div v-if="m.kind === 'classify' && !m.withdrawn" class="mt-2.5">
              <button
                v-if="hasRecord(m.recordId)"
                class="inline-flex items-center gap-1 rounded-full bg-brand-soft px-3.5 py-1.5 text-xs font-medium text-brand-dark active:bg-brand/20"
                @click="openCategorySheet(m.recordId)"
              >
                <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
                修改分类
              </button>
              <span v-else class="text-xs text-muted">（记录已撤回）</span>
            </div>
            <div class="num mt-1.5 text-[10px] text-muted/80">{{ timePart(m.time) }}</div>
          </div>
        </div>
      </template>
    </div>

    <!-- 输入栏 -->
    <form class="shrink-0 border-t border-line bg-white/95 px-4 pt-2.5 pb-3 backdrop-blur" @submit.prevent="send">
      <p v-if="error" class="mb-2 text-xs text-red-500">{{ error }}</p>
      <div class="flex items-center gap-2">
        <div class="relative flex-1">
          <input
            v-model="draft"
            type="text"
            inputmode="decimal"
            enterkeyhint="send"
            placeholder="输入血糖值，如 5.6"
            class="num w-full rounded-full bg-paper px-4 py-3 pr-16 text-base text-ink placeholder:text-muted/70 outline-none ring-1 ring-line focus:ring-brand"
            @input="error = ''"
          />
          <span class="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted">mmol/L</span>
        </div>
        <button
          type="submit"
          class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand text-white transition-transform active:scale-95 disabled:opacity-40"
          :disabled="!draft.trim()"
          aria-label="发送"
        >
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4.5 12 20 4.5l-4 15.5-4.5-6.5-7-1.5Z" />
            <path d="M11.5 13.5 20 4.5" />
          </svg>
        </button>
      </div>
    </form>
  </div>
</template>
