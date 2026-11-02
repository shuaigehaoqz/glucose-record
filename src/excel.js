import * as XLSX from 'xlsx'
import { CATEGORIES, classifyByTime } from './store.js'

/* ---------------- 表头别名匹配 ---------------- */
function findColumns(headers) {
  const cols = { date: -1, time: -1, dateTime: -1, value: -1, category: -1 }
  headers.forEach((h, i) => {
    const s = String(h ?? '').trim().toLowerCase()
    if (!s) return
    if (s.includes('分类') || s.includes('类别') || s.includes('时段') || s.includes('category')) {
      if (cols.category < 0) cols.category = i
      return
    }
    if (s.includes('血糖') || s.includes('glucose') || s === 'value' || s.includes('数值') || s.includes('浓度')) {
      if (cols.value < 0) cols.value = i
      return
    }
    if (s.includes('日期') && s.includes('时间')) {
      if (cols.dateTime < 0) cols.dateTime = i
      return
    }
    if (s.includes('日期') || s === 'date') {
      if (cols.date < 0) cols.date = i
      return
    }
    if (s.includes('时间') || s.includes('时刻') || s === 'time') {
      if (cols.time < 0) cols.time = i
    }
  })
  return cols
}

/* ---------------- 单元格解析 ---------------- */
const pad = (n) => String(n).padStart(2, '0')

/** 把 "2026-1-5" / "2026/1/5" / "2026年1月5日" / "1/5/26" 等归一为 Date */
function parseDateText(raw) {
  const s = String(raw).trim()
  if (!s) return null
  let m = s.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?/)
  if (m) return new Date(+m[1], +m[2] - 1, +m[3])
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/)
  if (m) {
    let [, a, b, y] = m
    y = +y
    if (y < 100) y += 2000
    // Excel 默认 m/d/yy；若第一个数字 > 12 则为 d/m/y
    const first = +a
    if (first > 12) return new Date(y, +b - 1, first)
    return new Date(y, first - 1, +b)
  }
  // Excel 日期序列号（45000 ≈ 2023-03-15）
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const n = Number(s)
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000)
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  }
  const d = new Date(s)
  return isNaN(d) ? null : d
}

/** "9:30" / "09:30:00" / 0.39583（Excel 时间小数） → "HH:mm" */
function parseTimeText(raw) {
  let s = String(raw).trim()
  if (!s) return null
  const m = s.match(/(\d{1,2}):(\d{2})/)
  if (m) return `${pad(Math.min(23, +m[1]))}:${pad(Math.min(59, +m[2]))}`
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s)
    if (n >= 0 && n < 1) {
      const mins = Math.round(n * 24 * 60)
      return `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}`
    }
  }
  return null
}

function parseValueText(raw) {
  const s = String(raw ?? '').replace(/mmol\/l|mmol|l\b/gi, '').trim()
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null
  const v = Number(s)
  if (!isFinite(v) || v < 1 || v > 33.3) return null
  return Math.round(v * 100) / 100
}

function parseCategoryText(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return null
  if (s.includes('空腹')) return 'fasting'
  if (s.includes('早餐')) return 'breakfast'
  if (s.includes('午餐')) return 'lunch'
  if (s.includes('晚餐')) return 'dinner'
  return undefined // 有值但无法识别 → 调用方按时间兜底
}

/* ---------------- 主解析 ---------------- */
export async function parseExcelFile(file) {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { cellDates: false })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) throw new Error('文件里没有可读取的工作表')

  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' })
  if (!aoa.length) throw new Error('表格是空的')

  // 找表头行：含“血糖”或“日期”的第一行
  let headerIdx = aoa.findIndex((row) =>
    row.some((c) => /血糖|日期|时间|glucose/i.test(String(c))),
  )
  if (headerIdx < 0) headerIdx = 0

  const cols = findColumns(aoa[headerIdx])
  if (cols.value < 0) throw new Error('没找到“血糖值”列，请对照模板')
  if (cols.date < 0 && cols.dateTime < 0) throw new Error('没找到“日期”列，请对照模板')

  const rows = []
  const errors = []
  let dupes = 0

  for (let r = headerIdx + 1; r < aoa.length; r++) {
    const row = aoa[r]
    const no = r + 1
    const rawValue = row[cols.value]
    if (String(rawValue ?? '').trim() === '') continue // 空行跳过

    let dateStr = null
    let timeStr = null

    if (cols.dateTime >= 0 && String(row[cols.dateTime] ?? '').trim()) {
      const s = String(row[cols.dateTime]).trim()
      const dm = s.match(/(\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2})/)
      const tm = s.match(/(\d{1,2}:\d{2})/)
      if (dm) dateStr = dm[1]
      if (tm) timeStr = tm[1]
      if (!dm) {
        const d = parseDateText(s)
        if (d) dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      }
    }
    if (cols.date >= 0 && String(row[cols.date] ?? '').trim()) {
      const d = parseDateText(row[cols.date])
      if (d) dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      else dateStr = `__bad__`
    }
    if (cols.time >= 0 && String(row[cols.time] ?? '').trim()) {
      timeStr = parseTimeText(row[cols.time])
    }

    if (!dateStr || dateStr === '__bad__') {
      errors.push(`第${no}行：日期无效（"${String(row[cols.date] ?? row[cols.dateTime] ?? '')}"）`)
      continue
    }
    if (!timeStr) timeStr = '07:00' // 只有日期时默认早晨测量

    const value = parseValueText(rawValue)
    if (value == null) {
      errors.push(`第${no}行：血糖值无效（"${String(rawValue)}"）`)
      continue
    }

    let category = parseCategoryText(cols.category >= 0 ? row[cols.category] : '')
    if (category === null || category === undefined || !CATEGORIES.some((c) => c.key === category)) {
      category = classifyByTime(new Date(`${dateStr}T${timeStr}`))
    }

    rows.push({ time: `${dateStr} ${timeStr}`, value, category })
  }

  if (!rows.length && !errors.length) throw new Error('表格里没有数据行')

  return { rows, errors, dupesHint: dupes }
}

/* ---------------- 模板下载 ---------------- */
export function downloadTemplate() {
  const aoa = [
    ['日期', '时间', '血糖值(mmol/L)', '分类（可留空，按时间自动分）'],
    ['2026-01-05', '07:10', 5.6, '空腹血糖'],
    ['2026-01-05', '09:30', 7.2, '早餐餐后两小时'],
    ['2026-01-05', '14:30', 8.1, ''],
    ['2026-01-05', '20:10', 6.9, ''],
  ]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [{ wch: 13 }, { wch: 8 }, { wch: 14 }, { wch: 30 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '血糖记录')
  XLSX.writeFile(wb, '血糖记录模板.xlsx')
}
