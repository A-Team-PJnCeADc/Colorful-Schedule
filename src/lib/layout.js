import { parseWeeks } from './weeks.js'

// 把课程展开成当前周要渲染的块，并做重叠分栏（同一天同一节有多门课时并排显示）
export function buildBlocks(courses, week, totalWeeks) {
  const items = []

  for (const course of courses) {
    ;(course.sessions || []).forEach((session, index) => {
      const weeks = parseWeeks(session.weeks, totalWeeks)
      if (!weeks.includes(week)) return
      items.push({
        key: `${course.id}#${index}`,
        courseId: course.id,
        sessionIndex: index,
        name: course.name,
        teacher: course.teacher,
        room: course.room,
        color: course.color,
        day: session.day,
        period: session.period,
        span: session.span,
        weeks: session.weeks,
        lane: 0,
        lanes: 1
      })
    })
  }

  const byDay = new Map()
  for (const item of items) {
    if (!byDay.has(item.day)) byDay.set(item.day, [])
    byDay.get(item.day).push(item)
  }

  for (const list of byDay.values()) {
    list.sort((a, b) => a.period - b.period || b.span - a.span)

    // 先切成互不相交的簇，簇内再做贪心分栏，避免整列被压窄
    let cluster = []
    let clusterEnd = 0
    const flush = () => {
      if (!cluster.length) return
      const laneEnds = []
      for (const block of cluster) {
        let lane = laneEnds.findIndex((end) => end <= block.period)
        if (lane === -1) {
          lane = laneEnds.length
          laneEnds.push(block.period + block.span)
        } else {
          laneEnds[lane] = block.period + block.span
        }
        block.lane = lane
      }
      const lanes = Math.max(1, laneEnds.length)
      cluster.forEach((block) => {
        block.lanes = lanes
      })
      cluster = []
    }

    for (const block of list) {
      if (cluster.length && block.period >= clusterEnd) {
        flush()
        clusterEnd = 0
      }
      cluster.push(block)
      clusterEnd = Math.max(clusterEnd, block.period + block.span)
    }
    flush()
  }

  return items
}

// 两个时段是否在周次上真的冲突
export function findConflicts(courses, currentId, session, totalWeeks) {
  const weeks = new Set(parseWeeks(session.weeks, totalWeeks))
  const start = session.period
  const end = session.period + session.span
  const hits = []

  for (const course of courses) {
    if (course.id === currentId) continue
    for (const other of course.sessions || []) {
      if (other.day !== session.day) continue
      if (!(start < other.period + other.span && other.period < end)) continue
      const overlap = parseWeeks(other.weeks, totalWeeks).some((w) => weeks.has(w))
      if (overlap) {
        hits.push(course.name)
        break
      }
    }
  }
  return hits
}
