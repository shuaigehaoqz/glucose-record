<script setup>
import { computed } from 'vue'
import { CATEGORIES, catOf, store, ui, applyCategory } from '../store.js'

const record = computed(() => store.records.find((r) => r.id === ui.sheetRecordId) || null)
</script>

<template>
  <transition name="fade">
    <div v-if="ui.sheetRecordId" class="absolute inset-0 z-40">
      <div class="absolute inset-0 bg-black/40" @click="ui.sheetRecordId = null" />

      <transition name="sheet" appear>
        <div
          class="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl"
        >
          <div class="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
          <h3 class="text-base font-semibold">修改分类</h3>
          <p v-if="record" class="mt-1 mb-4 text-sm text-muted">
            <span class="num font-semibold text-ink">{{ record.value }}</span> mmol/L ·
            {{ record.time.slice(5, 16) }} · 当前【{{ catOf(record.category).label }}】
          </p>
          <div v-else class="mb-4" />

          <div class="space-y-2">
            <button
              v-for="c in CATEGORIES"
              :key="c.key"
              class="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left ring-1 transition-colors"
              :class="
                record && record.category === c.key
                  ? 'bg-brand-soft ring-brand'
                  : 'bg-white ring-line active:bg-paper'
              "
              @click="applyCategory(c.key)"
            >
              <span class="h-3 w-3 shrink-0 rounded-full" :style="{ background: c.color }" />
              <span class="flex-1">
                <span class="block text-[15px] font-medium">{{ c.label }}</span>
                <span class="num block text-xs text-muted">参考目标 ≤ {{ c.target.toFixed(1) }} mmol/L</span>
              </span>
              <svg
                v-if="record && record.category === c.key"
                viewBox="0 0 24 24"
                class="h-5 w-5 shrink-0 text-brand"
                fill="none"
                stroke="currentColor"
                stroke-width="2.4"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="m5 12.5 4.5 4.5L19 7.5" />
              </svg>
            </button>
          </div>

          <button
            class="mt-3 w-full rounded-2xl py-3 text-sm text-muted active:bg-paper"
            @click="ui.sheetRecordId = null"
          >
            取消
          </button>
        </div>
      </transition>
    </div>
  </transition>
</template>
