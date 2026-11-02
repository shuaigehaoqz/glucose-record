<script setup>
import { ref, computed } from 'vue'
import {
  store,
  CATEGORIES,
  catOf,
  removeRecord,
  openCategorySheet,
  importRecords,
  showToast,
} from '../store.js'
import { parseExcelFile, downloadTemplate } from '../excel.js'

const filter = ref('all')
const fileEl = ref(null)
const pendingDelete = ref('')
let deleteTimer = null

const filtered = computed(() =>
  filter.value === 'all'
    ? store.records
    : store.records.filter((r) => r.category === filter.value),
)

const counts = computed(() => {
  const c = { all: store.records.length }
  CATEGORIES.forEach((k) => (c[k.key] = store.records.filter((r) => r.category === k.key).length))
  return c
})

/** 按日期倒序分组，组内按时间倒序 */
const groups = computed(() => {
  const map = new Map()
  ;[...filtered.value]
    .sort((a, b) => b.time.localeCompare(a.time))
    .forEach((r) => {
      const d = r.time.slice(0, 10)
      if (!map.has(d)) map.set(d, [])
      map.get(d).push(r)
    })
  return [...map.entries()]
})

function dayLabel(d) {
  const dt = new Date(`${d}T00:00:00`)
  const now = new Date()
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((startOf(now) - startOf(dt)) / 86400000)
  if (diff === 0) return '今天'
  if (diff === 1) return '昨天'
  const wd = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dt.getDay()]
  return `${dt.getMonth() + 1}月${dt.getDate()}日 ${wd}`
}

function onDelete(id) {
  if (pendingDelete.value !== id) {
    pendingDelete.value = id
    clearTimeout(deleteTimer)
    deleteTimer = setTimeout(() => (pendingDelete.value = ''), 3000)
    return
  }
  clearTimeout(deleteTimer)
  pendingDelete.value = ''
  removeRecord(id)
  showToast('已删除该条记录')
}

function onTemplate() {
  try {
    downloadTemplate()
    showToast('模板已开始下载（血糖记录模板.xlsx）')
  } catch (e) {
    console.error(e)
    showToast('模板下载失败，请重试')
  }
}

async function onFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  try {
    const { rows, errors } = await parseExcelFile(file)
    const { imported, dupes } = importRecords(rows)
    const parts = [`已导入 ${imported} 条`]
    if (dupes) parts.push(`重复跳过 ${dupes} 条`)
    if (errors.length) parts.push(`无效 ${errors.length} 条`)
    showToast(parts.join(' · '))
    if (errors.length) console.warn('导入被跳过的行：', errors)
    if (imported) {
      filter.value = 'all'
    }
  } catch (err) {
    showToast(err.message || '解析失败，请检查文件格式')
  } finally {
    e.target.value = ''
  }
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <header class="shrink-0 bg-paper/95 px-5 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 backdrop-blur">
      <div class="flex items-baseline justify-between">
        <div>
          <h1 class="text-xl font-bold tracking-tight">历史血糖</h1>
          <p class="num mt-0.5 text-xs text-muted">共 {{ store.records.length }} 条记录 · 对话记录与批量上传</p>
        </div>
        <div class="flex gap-2">
          <button
            class="rounded-full bg-brand px-3.5 py-1.5 text-xs font-medium text-white active:scale-95"
            @click="fileEl?.click()"
          >
            上传 Excel
          </button>
          <button
            class="rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-brand ring-1 ring-brand active:scale-95"
            @click="onTemplate"
          >
            模板
          </button>
        </div>
      </div>
      <input ref="fileEl" type="file" accept=".xlsx,.xls,.csv" class="hidden" @change="onFile" />
    </header>

    <!-- 分类筛选 -->
    <div class="no-scrollbar shrink-0 overflow-x-auto px-4 pb-2">
      <div class="flex w-max gap-2">
        <button
          class="shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium ring-1 transition-colors"
          :class="filter === 'all' ? 'bg-ink text-white ring-ink' : 'bg-white text-muted ring-line'"
          @click="filter = 'all'"
        >
          全部 <span class="num">{{ counts.all }}</span>
        </button>
        <button
          v-for="c in CATEGORIES"
          :key="c.key"
          class="shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium ring-1 transition-colors"
          :style="filter === c.key ? { background: c.color, borderColor: c.color, color: '#fff', boxShadow: `0 0 0 1px ${c.color}` } : {}"
          :class="filter === c.key ? '' : 'bg-white text-muted ring-line'"
          @click="filter = c.key"
        >
          {{ c.short }} <span class="num">{{ counts[c.key] }}</span>
        </button>
      </div>
    </div>

    <!-- 列表 -->
    <div class="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
      <template v-if="groups.length">
        <section v-for="[day, list] in groups" :key="day" class="mt-3">
          <div class="mb-1.5 flex items-baseline gap-2 px-1">
            <h2 class="text-sm font-semibold">{{ dayLabel(day) }}</h2>
            <span class="num text-xs text-muted">{{ day.slice(5) }}</span>
          </div>
          <ul class="space-y-2">
            <li
              v-for="r in list"
              :key="r.id"
              class="flex items-center gap-3 rounded-2xl bg-white px-3.5 py-3 shadow-sm ring-1 ring-line"
            >
              <span class="num w-10 shrink-0 text-xs text-muted">{{ r.time.slice(11, 16) }}</span>
              <span class="num w-14 shrink-0 text-xl font-semibold leading-none">
                {{ r.value }}
                <span class="text-[10px] font-normal text-muted">mmol/L</span>
              </span>
              <span
                class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                :style="{ background: catOf(r.category).color }"
              >
                {{ catOf(r.category).short }}
              </span>
              <span v-if="r.source === 'upload'" class="shrink-0 rounded-full bg-paper px-2 py-0.5 text-[11px] text-muted ring-1 ring-line">
                上传
              </span>
              <div class="ml-auto flex shrink-0 items-center gap-1">
                <button
                  class="rounded-full px-2.5 py-1.5 text-xs text-brand active:bg-brand-soft"
                  @click="openCategorySheet(r.id)"
                >
                  改分类
                </button>
                <button
                  class="rounded-full px-2.5 py-1.5 text-xs active:bg-line"
                  :class="pendingDelete === r.id ? 'bg-red-500 text-white' : 'text-muted'"
                  @click="onDelete(r.id)"
                >
                  {{ pendingDelete === r.id ? '确认删除' : '删除' }}
                </button>
              </div>
            </li>
          </ul>
        </section>
      </template>

      <!-- 空状态 -->
      <div v-else class="flex flex-col items-center pt-20 text-center">
        <svg viewBox="0 0 24 24" class="h-12 w-12 text-line" fill="currentColor">
          <path d="M12 3.5s-5.5 6.2-5.5 9.7a5.5 5.5 0 0 0 11 0c0-3.5-5.5-9.7-5.5-9.7Z" />
        </svg>
        <p class="mt-4 text-sm font-medium">{{ store.records.length ? '该分类下还没有记录' : '还没有历史血糖记录' }}</p>
        <p class="mt-1 text-xs text-muted">
          {{ store.records.length ? '换一个筛选条件看看' : '在“记录”页发送血糖值，或点右上角上传 Excel' }}
        </p>
      </div>
    </div>
  </div>
</template>
