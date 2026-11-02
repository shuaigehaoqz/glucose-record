<script setup>
defineProps({ modelValue: String })
defineEmits(['update:modelValue'])

const tabs = [
  { key: 'chat', label: '记录' },
  { key: 'history', label: '历史' },
  { key: 'analysis', label: '分析' },
]
</script>

<template>
  <nav class="shrink-0 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
    <div class="grid grid-cols-3">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="flex flex-col items-center gap-0.5 py-2 transition-colors"
        :class="modelValue === t.key ? 'text-brand' : 'text-muted'"
        @click="$emit('update:modelValue', t.key)"
      >
        <span
          class="flex h-7 w-14 items-center justify-center rounded-full transition-colors"
          :class="modelValue === t.key ? 'bg-brand-soft' : ''"
        >
          <!-- 记录：对话气泡 -->
          <svg v-if="t.key === 'chat'" viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H7l-3.4 2.7.9-3.6A8.5 8.5 0 1 1 21 11.5Z" />
            <path d="M8.5 11.5h.01M12.5 11.5h.01M16.5 11.5h.01" stroke-width="2.2" />
          </svg>
          <!-- 历史：时钟 -->
          <svg v-else-if="t.key === 'history'" viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 7.5V12l3 1.8" />
          </svg>
          <!-- 分析：柱状图 -->
          <svg v-else viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 19.5V11M12 19.5V5M19 19.5v-6" />
          </svg>
        </span>
        <span class="text-[11px] font-medium">{{ t.label }}</span>
      </button>
    </div>
  </nav>
</template>
