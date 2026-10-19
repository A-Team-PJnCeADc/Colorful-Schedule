// 日期工具：全部以 'YYYY-MM-DD' 字符串为交换格式，避免时区漂移
export function toDate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function toISO(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayISO() {
  return toISO(new Date())
}

export function addDays(iso, n) {
  const d = toDate(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

// 该日期所在周的周一
export function mondayOf(iso) {
  const d = toDate(iso)
  const offset = (d.getDay() + 6) % 7
  return addDays(iso, -offset)
}

// 第几周：startISO 为第一周周一，返回 1 起的周号（可能 <=0 表示未开学）
export function weekOfDate(startISO, iso) {
  const diff = (toDate(iso) - toDate(startISO)) / 86400000
  return Math.floor((diff + 1e-6) / 7) + 1
}

// 1=周一 … 7=周日
export function weekdayOf(iso) {
  return ((toDate(iso).getDay() + 6) % 7) + 1
}

export function monthDay(iso) {
  const d = toDate(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
