<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  days: { type: Array, required: true },
  periods: { type: Array, required: true },
  blocks: { type: Array, default: () => [] },
  currentPeriod: { type: Number, default: 0 },
  groupStarts: { type: Array, default: () => [] },
  groupLabels: { type: Object, default: () => ({}) },
  editable: { type: Boolean, default: true },
  showHint: { type: Boolean, default: false }
})

const emit = defineEmits(['create', 'select', 'sample'])

// 浏览模式下点块可展开/收起（地点或课程名被截断时看全文）
const expandedKey = ref('')

// 把地点拆成 楼名 / 房号前缀 / 房号，手机上分行显示
function roomParts(room) {
  const text = String(room || '').trim()
  if (!text) return []
  const at = text.indexOf('楼')
  const building = at >= 0 ? text.slice(0, at + 1) : ''
  const rest = at >= 0 ? text.slice(at + 1) : text
  const dash = rest.indexOf('-')
  const head = dash >= 0 ? rest.slice(0, dash + 1) : rest
  const tail = dash >= 0 ? rest.slice(dash + 1) : ''
  return [building, head, tail].filter(Boolean)
}

function onBlockClick(block) {
  if (props.editable) {
    emit('select', block)
    return
  }
  expandedKey.value = expandedKey.value === block.key ? '' : block.key
}

const visibleBlocks = computed(() => {
  const maxSpan = props.periods.length
  return props.blocks
    .filter((b) => b.day <= props.days.length)
    .map((b) => {
      const span = Math.max(1, Math.min(b.span, maxSpan - b.period + 1))
      return { ...b, span }
    })
})

const todayDay = computed(() => {
  const hit = props.days.find((d) => d.isToday)
  return hit ? hit.n : 1
})

function blockStyle(block) {
  return {
    gridRow: `${block.period + 1} / span ${block.span}`,
    gridColumn: `${block.day + 1}`
  }
}

// 同一天重叠分栏：lane/lanes 来自 layout.js
function cardStyle(block) {
  const width = 100 / block.lanes
  return {
    '--c': block.color,
    left: `calc(${block.lane * width}% + 2px)`,
    width: `calc(${width}% - 5px)`
  }
}
</script>

<template>
  <div class="grid-wrap" :style="{ '--days': days.length, '--periods': periods.length }">
    <div class="grid">
      <div class="corner"></div>

      <div
        v-for="day in days"
        :key="'h' + day.n"
        class="day-head"
        :class="{ today: day.isToday }"
        :style="{ gridColumn: day.n + 1 }"
      >
        <span class="dname">{{ day.label }}</span>
        <span class="ddate">{{ day.date }}</span>
      </div>

      <template v-for="p in periods" :key="'r' + p.n">
        <div
          class="time-cell"
          :class="{ now: p.n === currentPeriod, 'group-start': groupStarts.includes(p.n) }"
          :style="{ gridRow: p.n + 1, gridColumn: 1 }"
        >
          <span v-if="groupLabels[p.n]" class="ppart">{{ groupLabels[p.n] }}</span>
          <span class="pnum">{{ p.n }}</span>
          <span class="ptime"><span class="t1">{{ p.start }}</span><span class="tsep">–</span><span class="t2">{{ p.end }}</span></span>
        </div>

        <div
          v-for="day in days"
          :key="day.n + '-' + p.n"
          class="slot"
          :class="{ today: day.isToday, 'group-start': groupStarts.includes(p.n) }"
          :style="{ gridRow: p.n + 1, gridColumn: day.n + 1 }"
          @click="editable && $emit('create', day.n, p.n)"
        ></div>
      </template>

      <div
        v-for="block in visibleBlocks"
        :key="block.key"
        class="block"
        :class="{ dense: block.lanes > 1, expanded: expandedKey === block.key }"
        :style="blockStyle(block)"
        @click.stop="onBlockClick(block)"
      >
        <div class="bcard" :style="cardStyle(block)">
          <div class="bname">{{ block.name }}</div>
          <div v-if="block.span >= 2 && block.room" class="bmeta">
            <span class="at">@</span><span
              v-for="(part, i) in roomParts(block.room)"
              :key="i"
              class="rp"
              >{{ part }}</span
            >
          </div>
        </div>
      </div>
    </div>

    <div v-if="showHint" class="empty-hint">
      <p v-if="editable">点任意空白格子添加课程</p>
      <p v-else>还没有课程，切到编辑模式后点空白格子添加</p>
      <div v-if="editable" class="row">
        <button class="primary-btn" @click="$emit('create', todayDay, 1)">+ 新建课程</button>
        <button class="ghost-btn" @click="$emit('sample')">载入示例课表</button>
      </div>
    </div>
  </div>
</template>
