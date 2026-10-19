// 周次表达式解析
// 支持：1-16 / 1-16单 / 1-16双 / 1,3,5 / 1-8,10-16 / 1-16单,18（全角逗号、顿号、空格也能识别）
export function parseWeeks(expr, totalWeeks) {
  const all = []
  for (let w = 1; w <= totalWeeks; w++) all.push(w)

  const text = String(expr ?? '')
    .replace(/[，、;；\s]/g, ',')
    .replace(/[～~—–]/g, '-')
    .replace(/[ＯO]/g, '0')
    .replace(/周/g, '')
    .replace(/第/g, '')
    .trim()

  if (!text) return all

  const result = new Set()
  let matched = false
  for (const token of text.split(',')) {
    if (!token) continue
    const oddOnly = /单|[oO]dd/.test(token)
    const evenOnly = /双|[eE]ven/.test(token)
    const nums = token.replace(/[^\d-]/g, '').split('-').filter(Boolean).map(Number)
    if (!nums.length) continue
    matched = true

    let from = nums[0]
    let to = nums.length > 1 ? nums[1] : nums[0]
    if (from > to) [from, to] = [to, from]

    for (let w = Math.max(1, from); w <= Math.min(totalWeeks, to); w++) {
      if (oddOnly && w % 2 === 0) continue
      if (evenOnly && w % 2 === 1) continue
      result.add(w)
    }
  }

  if (result.size) return [...result].sort((a, b) => a - b)
  // 有内容但无有效周次时返回空数组
  return matched ? [] : all
}

// 把周次数组压成便于展示的短文本，如 1-16 / 1-8,10-16
export function formatWeeks(list) {
  if (!list.length) return '无'
  const sorted = [...new Set(list)].sort((a, b) => a - b)
  const parts = []
  let start = sorted[0]
  let prev = sorted[0]
  for (let i = 1; i <= sorted.length; i++) {
    const cur = sorted[i]
    if (cur === prev + 1) {
      prev = cur
      continue
    }
    parts.push(start === prev ? `${start}` : `${start}-${prev}`)
    start = prev = cur
  }
  return parts.join(',')
}
