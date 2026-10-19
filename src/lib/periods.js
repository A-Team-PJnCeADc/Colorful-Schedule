// 按相邻节次的时间间隔切分时段：间隔超过 20 分钟视为进入下一个时段
// 返回 [{ label, from, to, start, end }]，from/to 为 0 起的节次下标
export function groupPeriods(periods) {
  const toMin = (t) => {
    const [h, m] = String(t || '0:0').split(':').map(Number)
    return h * 60 + (m || 0)
  }

  const groups = []
  let current = null

  periods.forEach((period, index) => {
    const gap = current ? toMin(period.start) - toMin(current.end) : 0
    if (!current || gap > 20) {
      current = {
        label: labelOf(period.start),
        from: index,
        to: index,
        start: period.start,
        end: period.end
      }
      groups.push(current)
    } else {
      current.to = index
      current.end = period.end
    }
  })

  return groups
}

function labelOf(start) {
  const hour = Number(String(start).split(':')[0])
  if (hour < 12) return '上午'
  if (hour < 18) return '下午'
  return '晚上'
}

// 每个时段第一节课的节次号（1 起），用于在网格上画分隔线；不含第 1 节
export function groupStartPeriods(periods) {
  return groupPeriods(periods)
    .map((g) => g.from + 1)
    .filter((n) => n > 1)
}

// 节次号 -> 时段名（上午/下午/晚上），只在每个时段的第一节上有值
export function periodGroupLabels(periods) {
  const labels = {}
  for (const group of groupPeriods(periods)) labels[group.from + 1] = group.label
  return labels
}
