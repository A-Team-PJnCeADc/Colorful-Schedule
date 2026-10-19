<script setup>
import { computed } from 'vue'
import { formatWeeks, parseWeeks } from '../lib/weeks.js'
import { findConflicts } from '../lib/layout.js'

const props = defineProps({
  open: { type: Boolean, default: false },
  draft: { type: Object, default: null },
  isNew: { type: Boolean, default: false },
  courses: { type: Array, default: () => [] },
  periodsCount: { type: Number, default: 12 },
  totalWeeks: { type: Number, default: 20 },
  palette: { type: Array, default: () => [] }
})

const emit = defineEmits(['close', 'save', 'delete'])

const DAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

const dayOptions = DAY_NAMES.map((label, i) => ({ v: i + 1, t: label }))

const periodOptions = computed(() =>
  Array.from({ length: props.periodsCount }, (_, i) => i + 1)
)

function spanOptions(period) {
  const max = Math.max(1, Math.min(6, props.periodsCount - period + 1))
  return Array.from({ length: max }, (_, i) => i + 1)
}

function clampSpan(session) {
  const max = Math.max(1, Math.min(6, props.periodsCount - session.period + 1))
  if (session.span > max) session.span = max
}

function weekSummary(session) {
  const weeks = parseWeeks(session.weeks, props.totalWeeks)
  if (!weeks.length) return '没有任何周次，本节不会显示'
  if (weeks.length === props.totalWeeks) return `每周 · 共 ${props.totalWeeks} 周`
  const oddOnly = weeks.every((w) => w % 2 === 1)
  const evenOnly = weeks.every((w) => w % 2 === 0)
  const suffix = oddOnly ? ' · 单周' : evenOnly ? ' · 双周' : ''
  return `${formatWeeks(weeks)} 周${suffix} · 共 ${weeks.length} 周`
}

function conflicts(session) {
  if (!session) return []
  return findConflicts(props.courses, props.draft?.id, session, props.totalWeeks)
}

const selectedColor = computed(() => (props.draft?.color || '').toLowerCase())

function addSession() {
  const last = props.draft.sessions[props.draft.sessions.length - 1]
  props.draft.sessions.push({
    day: last?.day || 1,
    period: last?.period || 1,
    span: 2,
    weeks: last?.weeks || `1-${props.totalWeeks}`
  })
}

function removeSession(index) {
  if (props.draft.sessions.length <= 1) return
  props.draft.sessions.splice(index, 1)
}

function submit() {
  if (!props.draft?.name?.trim()) return
  emit('save')
}
</script>

<template>
  <transition name="fade">
    <div v-if="open && draft" class="overlay" @click.self="emit('close')">
      <div class="modal">
        <header class="modal-head">
          <h2>{{ isNew ? '新建课程' : '编辑课程' }}</h2>
          <button class="icon-btn" @click="emit('close')">✕</button>
        </header>

        <div class="modal-body">
          <div class="row-2">
            <label class="field">
              <span>课程名称</span>
              <input v-model="draft.name" maxlength="20" placeholder="例如：高等数学" />
            </label>
            <label class="field">
              <span>任课教师</span>
              <input v-model="draft.teacher" maxlength="12" placeholder="选填" />
            </label>
          </div>

          <label class="field">
            <span>上课地点</span>
            <input v-model="draft.room" maxlength="20" placeholder="例如：教1-301" />
          </label>

          <div class="field">
            <span>颜色</span>
            <div class="swatches">
              <button
                v-for="color in palette"
                :key="color"
                class="swatch"
                :class="{ on: selectedColor === color.toLowerCase() }"
                :style="{ background: color, color: color }"
                @click="draft.color = color"
              ></button>
              <label class="swatch custom">
                <input v-model="draft.color" type="color" />
                <span>自定义</span>
              </label>
            </div>
          </div>

          <div class="sessions">
            <div class="sessions-head">
              <span>上课时段（一门课可有多段）</span>
              <button class="link-btn" @click="addSession">+ 添加时段</button>
            </div>

            <div v-for="(session, index) in draft.sessions" :key="index" class="session">
              <div class="srow">
                <select v-model.number="session.day">
                  <option v-for="d in dayOptions" :key="d.v" :value="d.v">{{ d.t }}</option>
                </select>
                <select v-model.number="session.period" @change="clampSpan(session)">
                  <option v-for="p in periodOptions" :key="p" :value="p">第 {{ p }} 节</option>
                </select>
                <select v-model.number="session.span">
                  <option v-for="n in spanOptions(session.period)" :key="n" :value="n">
                    连上 {{ n }} 节
                  </option>
                </select>
                <button
                  v-if="draft.sessions.length > 1"
                  class="icon-btn"
                  title="删除该时段"
                  @click="removeSession(index)"
                >
                  ✕
                </button>
              </div>

              <input
                v-model="session.weeks"
                class="weeks-input"
                placeholder="周次：1-16 / 1-16单 / 1-8,10-16"
              />

              <div class="s-hint">{{ weekSummary(session) }}</div>
              <div v-if="conflicts(session).length" class="s-hint warn">
                与「{{ conflicts(session).join('、') }}」时间重叠，重叠周会并排显示
              </div>
            </div>

            <div v-if="!draft.sessions.length" class="s-hint">
              暂无固定时段，这门课只显示在「课程」清单里
            </div>
          </div>
        </div>

        <footer class="modal-foot">
          <button v-if="!isNew" class="danger-btn" @click="emit('delete')">删除课程</button>
          <div class="spacer"></div>
          <button class="ghost-btn" @click="emit('close')">取消</button>
          <button class="primary-btn" :disabled="!draft.name.trim()" @click="submit">保存</button>
        </footer>
      </div>
    </div>
  </transition>
</template>
