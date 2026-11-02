<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import * as echarts from 'echarts'
import { store, CATEGORIES, toDateTime } from '../store.js'

const gran = ref('week') // week | month | year
const offset = ref(0) // 相对当前周期的偏移，0 表示当前周期

const pad = (n) => String(n).padStart(2, '0')

function rangeWith(off) {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const d = now.getDate()
  if (gran.value === 'week') {
    const dow = (now.getDay() + 6) % 7 // 周一为一周起点
    const start = new Date(y, m, d - dow + off * 7)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    return [start, end]
  }
  if (gran.value === 'month') {
    return [new Date(y, m + off, 1), new Date(y, m + off + 1, 0, 23, 59, 59, 999)]
  }
  return [new Date(y + off, 0, 1), new Date(y + off, 11, 31, 23, 59, 59, 999)]
}

const avgOf = (list) =>
  list.length ? list.reduce((s, r) => s + r.value, 0) / list.length : null
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10)

const stats = computed(() => {
  const [s, e] = rangeWith(offset.value)
  const [ps, pe] = rangeWith(offset.value - 1)
  const pick = (a, b) => store.records.filter((r) => {
    const t = toDateTime(r.time)
    return t >= a && t <= b
  })
  const cur = pick(s, e)
  const prev = pick(ps, pe)

  const cats = CATEGORIES.map((c) => {
    const cl = cur.filter((r) => r.category === c.key)
    const pl = prev.filter((r) => r.category === c.key)
    const a = avgOf(cl)
    const pa = avgOf(pl)
    return {
      ...c,
      count: cl.length,
      avg: r1(a),
      min: cl.length ? Math.min(...cl.map((r) => r.value)) : null,
      max: cl.length ? Math.max(...cl.map((r) => r.value)) : null,
      delta: a != null && pa != null ? Math.round((a - pa) * 10) / 10 : null,
    }
  })

  const oa = avgOf(cur)
  const opa = avgOf(prev)
  return {
    s,
    e,
    count: cur.length,
    cur,
    cats,
    total: {
      count: cur.length,
      avg: r1(oa),
      delta: oa != null && opa != null ? Math.round((oa - opa) * 10) / 10 : null,
    },
  }
})

const periodLabel = computed(() => {
  const { s, e } = stats.value
  if (gran.value === 'year') return `${s.getFullYear()} 年`
  if (gran.value === 'month') return `${s.getFullYear()} 年 ${s.getMonth() + 1} 月`
  return s.getMonth() === e.getMonth()
    ? `${s.getMonth() + 1} 月 ${s.getDate()} 日 – ${e.getDate()} 日`
    : `${s.getMonth() + 1} 月 ${s.getDate()} 日 – ${e.getMonth() + 1} 月 ${e.getDate()} 日`
})

const granUnit = computed(() => ({ week: '周', month: '月', year: '年' }[gran.value]))

function deltaInfo(d) {
  if (d == null) return null
  if (d === 0) return { text: '与上周期持平', cls: 'text-muted' }
  if (d > 0) return { text: `较上周期 +${d.toFixed(1)}`, cls: 'text-red-500' }
  return { text: `较上周期 ${d.toFixed(1)}`, cls: 'text-emerald-600' }
}

/* ---------------- 图表 ---------------- */
const barEl = ref(null)
const scatterEl = ref(null)
let barChart = null
let scatterChart = null

function renderCharts() {
  if (!barChart || !scatterChart) return
  const { cats, cur, count } = stats.value
  const empty = count === 0
  const emptyGraphic = empty
    ? [{ type: 'text', left: 'center', top: 'middle', style: { text: '本周期暂无记录', fill: '#66766d', fontSize: 13 } }]
    : []

  barChart.setOption(
    {
      animationDuration: 300,
      grid: { left: 40, right: 14, top: 30, bottom: 26 },
      tooltip: {
        trigger: 'item',
        formatter: (p) => `${p.name}<br/>平均 ${p.value == null ? '—' : p.value} mmol/L`,
      },
      xAxis: {
        type: 'category',
        data: cats.map((c) => c.short),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#e4e7df' } },
        axisLabel: { color: '#66766d', fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        scale: true,
        splitLine: { lineStyle: { color: '#eceee7' } },
        axisLabel: { color: '#66766d', fontSize: 10 },
      },
      series: [
        {
          type: 'bar',
          barWidth: '44%',
          data: cats.map((c) =>
            c.avg == null
              ? null
              : { value: c.avg, itemStyle: { color: c.color, borderRadius: [6, 6, 0, 0] } },
          ),
          label: {
            show: true,
            position: 'top',
            color: '#16211c',
            fontSize: 12,
            fontWeight: 600,
            formatter: (p) => (p.value == null ? '' : Number(p.value).toFixed(1)),
          },
        },
      ],
      graphic: emptyGraphic,
    },
    true,
  )

  const points = {}
  CATEGORIES.forEach((c) => {
    points[c.key] = cur
      .filter((r) => r.category === c.key)
      .map((r) => [toDateTime(r.time).getTime(), r.value])
  })

  scatterChart.setOption(
    {
      animationDuration: 300,
      grid: { left: 38, right: 16, top: 42, bottom: 42 },
      legend: {
        top: 0,
        left: 'center',
        itemWidth: 8,
        itemHeight: 8,
        itemGap: 14,
        textStyle: { color: '#66766d', fontSize: 11 },
      },
      tooltip: {
        trigger: 'item',
        formatter: (p) => {
          const d = new Date(p.value[0])
          return `${p.seriesName}<br/>${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())} · ${p.value[1]} mmol/L`
        },
      },
      xAxis: {
        type: 'time',
        axisLine: { lineStyle: { color: '#e4e7df' } },
        axisLabel: {
          color: '#66766d',
          fontSize: 10,
          formatter: (v) => {
            const d = new Date(v)
            return gran.value === 'year' ? `${d.getMonth() + 1}月` : `${d.getMonth() + 1}/${d.getDate()}`
          },
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        scale: true,
        name: 'mmol/L',
        nameTextStyle: { color: '#66766d', fontSize: 10 },
        splitLine: { lineStyle: { color: '#eceee7' } },
        axisLabel: { color: '#66766d', fontSize: 10 },
      },
      series: CATEGORIES.map((c, i) => ({
        name: c.short,
        type: 'scatter',
        symbolSize: 9,
        itemStyle: { color: c.color, opacity: 0.85 },
        data: points[c.key],
        markLine:
          i === 0 && !empty
            ? {
                silent: true,
                symbol: 'none',
                lineStyle: { type: 'dashed', color: '#9aa79f' },
                label: { show: true, fontSize: 10, color: '#66766d', position: 'insideEndTop' },
                data: [
                  { yAxis: 7.0, name: '空腹目标 7.0' },
                  { yAxis: 7.8, name: '餐后目标 7.8' },
                ],
              }
            : undefined,
      })),
      graphic: emptyGraphic,
    },
    true,
  )
}

function onResize() {
  barChart?.resize()
  scatterChart?.resize()
}

watch(gran, () => {
  offset.value = 0
})
watch(stats, renderCharts)

onMounted(() => {
  barChart = echarts.init(barEl.value)
  scatterChart = echarts.init(scatterEl.value)
  renderCharts()
  window.addEventListener('resize', onResize)
})
onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  barChart?.dispose()
  scatterChart?.dispose()
})
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <header class="shrink-0 bg-paper/95 px-5 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 backdrop-blur">
      <h1 class="text-xl font-bold tracking-tight">血糖分析</h1>
      <p class="mt-0.5 text-xs text-muted">按分类计算平均值 · 可切换周 / 月 / 年</p>
    </header>

    <div class="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
      <!-- 周期切换 -->
      <div class="mt-1 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-line">
        <div class="grid grid-cols-3 gap-1 rounded-xl bg-paper p-1">
          <button
            v-for="g in [
              { k: 'week', t: '周平均' },
              { k: 'month', t: '月平均' },
              { k: 'year', t: '年平均' },
            ]"
            :key="g.k"
            class="rounded-lg py-2 text-sm font-medium transition-colors"
            :class="gran === g.k ? 'bg-white text-brand shadow-sm ring-1 ring-line' : 'text-muted'"
            @click="gran = g.k"
          >
            {{ g.t }}
          </button>
        </div>

        <div class="mt-2 flex items-center justify-between px-1">
          <button
            class="flex h-8 w-8 items-center justify-center rounded-full text-muted active:bg-paper"
            aria-label="上一周期"
            @click="offset--"
          >
            <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m14.5 6-6 6 6 6" /></svg>
          </button>
          <div class="text-center">
            <div class="text-sm font-semibold">{{ periodLabel }}</div>
            <button
              v-if="offset !== 0"
              class="mt-0.5 text-[11px] text-brand active:underline"
              @click="offset = 0"
            >
              回到当前{{ granUnit }}期
            </button>
          </div>
          <button
            class="flex h-8 w-8 items-center justify-center rounded-full text-muted active:bg-paper disabled:opacity-30"
            :disabled="offset >= 0"
            aria-label="下一周期"
            @click="offset++"
          >
            <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9.5 6 6 6-6 6" /></svg>
          </button>
        </div>
      </div>

      <!-- 总体平均 -->
      <div class="mt-3 flex items-center justify-between rounded-2xl bg-brand px-4 py-4 text-white shadow-sm">
        <div>
          <div class="text-xs opacity-85">本{{ granUnit }}期总体平均</div>
          <div class="num mt-1 text-3xl font-bold leading-none">
            {{ stats.total.avg ?? '—' }}
            <span class="text-xs font-normal opacity-85">mmol/L</span>
          </div>
        </div>
        <div class="text-right text-xs">
          <div class="num opacity-85">{{ stats.total.count }} 条记录</div>
          <div v-if="deltaInfo(stats.total.delta)" class="num mt-1 font-medium" :class="deltaInfo(stats.total.delta).cls === 'text-muted' ? 'text-white/80' : deltaInfo(stats.total.delta).cls === 'text-red-500' ? 'text-amber-200' : 'text-emerald-200'">
            {{ deltaInfo(stats.total.delta).text }}
          </div>
        </div>
      </div>

      <!-- 分类平均卡片 -->
      <div class="mt-3 grid grid-cols-2 gap-3">
        <div v-for="c in stats.cats" :key="c.key" class="rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-line">
          <div class="flex items-center gap-1.5">
            <span class="h-2.5 w-2.5 rounded-full" :style="{ background: c.color }" />
            <span class="text-xs font-medium text-ink">{{ c.short }}</span>
          </div>
          <div class="num mt-1.5 flex items-baseline gap-1">
            <span class="text-2xl font-bold leading-none" :style="{ color: c.avg == null ? '#9aa79f' : c.color }">
              {{ c.avg ?? '—' }}
            </span>
            <span class="text-[10px] text-muted">mmol/L</span>
          </div>
          <div class="num mt-2 text-[10px] leading-relaxed text-muted">
            <div>{{ c.count ? `${c.count} 条 · ${c.min}–${c.max}` : '本周期无数据' }}</div>
            <div class="flex items-center justify-between">
              <span>目标 ≤ {{ c.target.toFixed(1) }}</span>
              <span
                v-if="c.avg != null"
                class="font-medium"
                :class="c.avg <= c.target ? 'text-emerald-600' : 'text-amber-600'"
              >
                {{ c.avg <= c.target ? '达标' : '偏高' }}
              </span>
            </div>
            <div v-if="deltaInfo(c.delta)" class="mt-0.5 font-medium" :class="deltaInfo(c.delta).cls">
              {{ deltaInfo(c.delta).text }}
            </div>
          </div>
        </div>
      </div>

      <!-- 分类平均柱状图 -->
      <div class="mt-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line">
        <h2 class="text-sm font-semibold">各分类平均值</h2>
        <div ref="barEl" class="mt-2 h-[210px] w-full" />
      </div>

      <!-- 趋势散点图 -->
      <div class="mt-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line">
        <div class="flex items-baseline justify-between">
          <h2 class="text-sm font-semibold">测量值趋势</h2>
          <span class="text-[10px] text-muted">虚线为参考目标</span>
        </div>
        <div ref="scatterEl" class="mt-2 h-[240px] w-full" />
      </div>
    </div>
  </div>
</template>
