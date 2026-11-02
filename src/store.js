import { reactive, watch } from 'vue'

export const CATEGORIES = [
  { key: 'fasting', label: '空腹血糖', short: '空腹', color: '#0f766e', target: 7.0 },
  { key: 'breakfast', label: '早餐餐后两小时', short: '早餐后', color: '#d97706', target: 7.8 },
  { key: 'lunch', label: '午餐餐后两小时', short: '午餐后', color: '#4f46e5', target: 7.8 },
  { key: 'dinner', label: '晚餐餐后两小时', short: '晚餐后', color: '#e11d48', target: 7.8 },
]

export const catOf = (key) => CATEGORIES.find((c) => c.key === key) || CATEGORIES[0]

const pad = (n) => String(n).padStart(2, '0')

export const fmtDateTime = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`

export const timePart = (t) => (t || '').slice(11, 16)

export const dayPart = (t) => (t || '').slice(0, 10)

export const toDateTime = (t) => new Date((t || '').replace(' ', 'T'))

/** 按测量时间自动分类时段 */
export function classifyByTime(d) {
  const h = d.getHours() + d.getMinutes() / 60
  if (h >= 9 && h < 11.5) return 'breakfast' // 09:00–11:29 早餐后两小时
  if (h >= 11.5 && h < 15.5) return 'lunch' // 11:30–15:29 午餐后两小时
  if (h >= 15.5 && h < 22) return 'dinner' // 15:30–21:59 晚餐后两小时
  return 'fasting' // 22:00–08:59 空腹时段
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    const v = raw ? JSON.parse(raw) : null
    return Array.isArray(v) ? v : fallback
  } catch {
    return fallback
  }
}

const KEY_RECORDS = 'glucose.records.v1'
const KEY_CHAT = 'glucose.chat.v1'

export const store = reactive({
  records: load(KEY_RECORDS, []), // { id, value, time, category, source: 'chat'|'upload', createdAt }
  messages: load(KEY_CHAT, []), // { id, role, text, time, recordId?, kind?, withdrawn? }
})

if (!store.messages.length) {
  store.messages.push({
    id: uid(),
    role: 'bot',
    time: fmtDateTime(new Date()),
    text: '你好，把刚测量的血糖数值发给我（例如 5.6），我会按测量时间自动分类并保存到历史记录。分类不合适可以随时修改，记录也可以撤回。',
  })
}

watch(
  () => [store.records, store.messages],
  () => {
    try {
      localStorage.setItem(KEY_RECORDS, JSON.stringify(store.records))
      localStorage.setItem(KEY_CHAT, JSON.stringify(store.messages))
    } catch (e) {
      console.error('保存失败', e)
    }
  },
  { deep: true },
)

/* ---------- 界面状态 ---------- */
export const ui = reactive({
  sheetRecordId: null,
  toast: '',
})
let toastTimer = null

export function showToast(msg) {
  ui.toast = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (ui.toast = ''), 2800)
}

export function openCategorySheet(recordId) {
  ui.sheetRecordId = recordId
}

/* ---------- 消息 ---------- */
export function pushMessage(m) {
  store.messages.push({ id: uid(), time: fmtDateTime(new Date()), ...m })
}

/* ---------- 记录操作 ---------- */
export function addChatRecord(value) {
  const now = new Date()
  const time = fmtDateTime(now)
  const category = classifyByTime(now)
  const rec = { id: uid(), value, time, category, source: 'chat', createdAt: Date.now() }
  store.records.push(rec)
  pushMessage({ role: 'user', text: String(value), recordId: rec.id, withdrawn: false })
  pushMessage({
    role: 'bot',
    kind: 'classify',
    recordId: rec.id,
    text: `已记录 ${value} mmol/L（${timePart(time)} 测量），按时间分类到【${catOf(category).label}】。如果分类不对，点下面的「修改分类」。`,
  })
  return rec
}

export function removeRecord(id) {
  const i = store.records.findIndex((r) => r.id === id)
  if (i < 0) return
  const rec = store.records[i]
  store.records.splice(i, 1)
  const m = store.messages.find((msg) => msg.role === 'user' && msg.recordId === id)
  if (m) {
    m.withdrawn = true
    pushMessage({
      role: 'bot',
      text: `已撤回 ${rec.value} mmol/L（${timePart(rec.time)}）的记录，历史和统计中不再包含它。`,
    })
  }
}

export function setCategory(id, key) {
  const rec = store.records.find((r) => r.id === id)
  if (!rec || rec.category === key) return
  rec.category = key
  pushMessage({
    role: 'bot',
    kind: 'classify',
    recordId: id,
    text: `已将 ${rec.value} mmol/L（${timePart(rec.time)}）的分类改为【${catOf(key).label}】。`,
  })
}

export function applyCategory(key) {
  const id = ui.sheetRecordId
  ui.sheetRecordId = null
  if (id) {
    setCategory(id, key)
    showToast(`已归类到「${catOf(key).label}」`)
  }
}

/** 批量导入（xlsx 解析后的行：{ time, value, category }），自动去重 */
export function importRecords(rows) {
  const seen = new Set(store.records.map((r) => `${r.time}|${r.value}`))
  let imported = 0
  let dupes = 0
  rows.forEach((r) => {
    const k = `${r.time}|${r.value}`
    if (seen.has(k)) {
      dupes += 1
      return
    }
    seen.add(k)
    store.records.push({
      id: uid(),
      value: r.value,
      time: r.time,
      category: r.category,
      source: 'upload',
      createdAt: Date.now(),
    })
    imported += 1
  })
  return { imported, dupes }
}
