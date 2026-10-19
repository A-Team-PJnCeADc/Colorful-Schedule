<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import TimetableGrid from './components/TimetableGrid.vue'
import CourseDialog from './components/CourseDialog.vue'
import SettingsDialog from './components/SettingsDialog.vue'
import {
  ENCRYPTED_SEED,
  EXAMPLE_UUID,
  PALETTE,
  clone,
  downloadJSON,
  loadDecryptedState,
  loadState,
  lastKeyUsed,
  markKeyUsed,
  readJSONFile,
  readUuidParam,
  resetLocalState,
  saveState,
  uid
} from './lib/storage.js'
import { decryptSchedule, keyIdOf } from './lib/crypto.js'
import { buildBlocks } from './lib/layout.js'
import { groupStartPeriods, periodGroupLabels } from './lib/periods.js'
import { addDays, mondayOf, monthDay, todayISO, weekOfDate } from './lib/date.js'
import { sampleCourses } from './data/sample.js'

const DAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const MODE_KEY = 'class-schedule:mode'

const state = reactive(loadState())
const week = ref(1)
const view = ref('grid')
const mode = ref('browse')
const activeKey = ref(EXAMPLE_UUID)
const isPrivate = ref(false)
// 标题随数据源变化：解密成功显示“我的课表”，否则是“示例数据”
const title = computed(() => (isPrivate.value ? '我的课表' : '示例数据'))
const now = ref(new Date())
const toastText = ref('')
const settingsOpen = ref(false)
const settingsDraft = ref(null)
const editor = reactive({ open: false, draft: null, isNew: false })

let clockTimer = 0
let saveTimer = 0
let toastTimer = 0

const totalWeeks = computed(() => state.settings.totalWeeks)
// 浏览模式只读
const editMode = computed(() => mode.value === 'edit')
const periods = computed(() => state.settings.periods.map((p, i) => ({ n: i + 1, start: p.start, end: p.end })))
// 上午/下午/晚上的分界节次与标签
const groupStarts = computed(() => groupStartPeriods(state.settings.periods))
const groupLabels = computed(() => periodGroupLabels(state.settings.periods))
const weekOptions = computed(() => Array.from({ length: totalWeeks.value }, (_, i) => i + 1))
const todayStr = computed(() => {
  now.value
  return todayISO()
})

function clampWeek(value) {
  return Math.min(Math.max(value, 1), totalWeeks.value)
}

const currentWeek = computed(() => clampWeek(weekOfDate(state.settings.startDate, todayStr.value)))
const isCurrentWeek = computed(() => week.value === currentWeek.value)

const hasWeekendSession = computed(() =>
  state.courses.some((course) => course.sessions.some((s) => s.day >= 6))
)

const showWeekend = computed(() => {
  if (state.settings.showWeekend === 'always') return true
  if (state.settings.showWeekend === 'never') return false
  return hasWeekendSession.value
})

const days = computed(() => {
  const count = showWeekend.value ? 7 : 5
  return Array.from({ length: count }, (_, i) => {
    const iso = addDays(state.settings.startDate, (week.value - 1) * 7 + i)
    return {
      n: i + 1,
      label: DAY_LABELS[i],
      date: monthDay(iso),
      iso,
      isToday: iso === todayStr.value
    }
  })
})

const blocks = computed(() => buildBlocks(state.courses, week.value, totalWeeks.value))

// 底部无课程的行不渲染，最少保留 8 行
const rows = computed(() => {
  if (state.settings.hideEmptyRows === false) return periods.value
  let last = 0
  for (const block of blocks.value) last = Math.max(last, block.period + block.span - 1)
  const count = Math.min(periods.value.length, Math.max(8, last))
  return periods.value.slice(0, count)
})

// 无固定时段的课程按 category 分组，渲染在网格下方
const unscheduledGroups = computed(() => {
  const groups = new Map()
  for (const course of state.courses) {
    if (course.sessions.length) continue
    const key = course.category || '其他课程'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(course)
  }
  return [...groups.entries()].map(([category, items]) => ({ category, items }))
})

const todayBlocks = computed(() => {
  if (!isCurrentWeek.value) return []
  const today = days.value.find((d) => d.isToday)
  if (!today) return []
  return blocks.value.filter((b) => b.day === today.n).sort((a, b) => a.period - b.period)
})

// 当前节次：仅在本周且今天在显示列内时计算
const currentPeriod = computed(() => {
  if (!isCurrentWeek.value) return 0
  const today = days.value.find((d) => d.isToday)
  if (!today) return 0
  const minutes = now.value.getHours() * 60 + now.value.getMinutes()
  const toMin = (t) => {
    const [h, m] = String(t).split(':').map(Number)
    return h * 60 + (m || 0)
  }
  const hit = periods.value.find((p) => minutes >= toMin(p.start) && minutes <= toMin(p.end))
  return hit ? hit.n : 0
})

// 地址栏带 ?uuid=<密钥> 时解密密文课表，解密失败保持示例数据
async function initSecureSeed() {
  const key = readUuidParam()
  if (!key) return
  if (!ENCRYPTED_SEED) {
    toast('没有打包加密课表')
    return
  }
  try {
    const payload = await decryptSchedule(ENCRYPTED_SEED, key)
    const id = await keyIdOf(key)
    // 与上次用的密钥（存的是其 SHA-256 前缀）不同则立即用解密结果覆盖本地存档
    const force = lastKeyUsed() !== id
    const next = loadDecryptedState(payload, id, { force })
    state.settings = next.settings
    state.courses = next.courses
    state.settingsKey = next.settingsKey
    activeKey.value = key
    isPrivate.value = true
    markKeyUsed(id)
    applyTheme()
    week.value = clampWeek(weekOfDate(next.settings.startDate, todayISO()))
    toast(force ? `已按新密钥刷新课表（${next.courses.length} 门）` : `已解密课表（${next.courses.length} 门）`)
  } catch (err) {
    console.warn(err)
    toast('密钥不正确，已显示示例课表')
  }
}

function applyTheme() {
  const mode = state.settings.theme
  const dark =
    mode === 'dark' ||
    (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}

function toggleTheme() {
  const isDark = document.documentElement.dataset.theme === 'dark'
  state.settings.theme = isDark ? 'light' : 'dark'
}

function toast(text) {
  toastText.value = text
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastText.value = ''
  }, 2000)
}

function stepWeek(delta) {
  week.value = clampWeek(week.value + delta)
}

function toggleMode() {
  mode.value = editMode.value ? 'browse' : 'edit'
  try {
    localStorage.setItem(MODE_KEY, mode.value)
  } catch (err) {
    // localStorage 不可用时仅保留内存状态
  }
}

function goThisWeek() {
  week.value = currentWeek.value
}

function nextColor() {
  const used = new Map(PALETTE.map((c) => [c, 0]))
  for (const course of state.courses) used.set(course.color, (used.get(course.color) || 0) + 1)
  return [...used.entries()].sort((a, b) => a[1] - b[1])[0][0]
}

function openCreate(day, period) {
  if (!editMode.value) return
  const defaultDay = day || days.value.find((d) => d.isToday)?.n || 1
  editor.draft = {
    id: uid(),
    name: '',
    teacher: '',
    room: '',
    color: nextColor(),
    sessions: [{ day: defaultDay, period: period || 1, span: 2, weeks: `1-${totalWeeks.value}` }]
  }
  editor.isNew = true
  editor.open = true
}

function openEditByBlock(block) {
  const course = state.courses.find((c) => c.id === block.courseId)
  if (course) openEdit(course)
}

function openEdit(course) {
  if (!editMode.value) return
  editor.draft = clone(course)
  editor.isNew = false
  editor.open = true
}

function closeEditor() {
  editor.open = false
  editor.draft = null
}

function saveDraft() {
  const draft = editor.draft
  if (!draft) return
  draft.name = draft.name.trim()
  if (!draft.name) {
    toast('请填写课程名称')
    return
  }
  const count = periods.value.length
  draft.sessions = draft.sessions
    .filter((s) => s.day >= 1 && s.day <= 7)
    .map((s) => {
      const period = Math.min(Math.max(1, s.period), count)
      return {
        day: s.day,
        period,
        span: Math.max(1, Math.min(s.span || 1, Math.min(6, count - period + 1))),
        weeks: s.weeks || ''
      }
    })

  const index = state.courses.findIndex((c) => c.id === draft.id)
  if (index >= 0) state.courses.splice(index, 1, draft)
  else state.courses.push(draft)

  toast(editor.isNew ? '已添加课程' : '已保存修改')
  closeEditor()
}

function deleteDraft() {
  const draft = editor.draft
  if (!draft) return
  if (!window.confirm(`确定删除「${draft.name}」吗？`)) return
  const index = state.courses.findIndex((c) => c.id === draft.id)
  if (index >= 0) state.courses.splice(index, 1)
  toast('已删除')
  closeEditor()
}

function openSettings() {
  settingsDraft.value = clone(state.settings)
  settingsOpen.value = true
}

function closeSettings() {
  settingsOpen.value = false
  settingsDraft.value = null
}

function saveSettings() {
  const draft = settingsDraft.value
  if (!draft) return
  state.settings.totalWeeks = Math.min(30, Math.max(1, Number(draft.totalWeeks) || 20))
  state.settings.startDate = mondayOf(draft.startDate || state.settings.startDate)
  state.settings.periods = draft.periods.map((p) => ({ start: p.start, end: p.end }))
  state.settings.showWeekend = draft.showWeekend
  state.settings.theme = draft.theme
  state.settings.hideEmptyRows = draft.hideEmptyRows !== false
  clampCourses()
  week.value = clampWeek(week.value)
  toast('设置已保存')
  closeSettings()
}

// 节数减少时收敛超出范围的时段
function clampCourses() {
  const count = state.settings.periods.length
  for (const course of state.courses) {
    course.sessions = course.sessions.map((s) => {
      const period = Math.min(Math.max(1, s.period), count)
      return {
        ...s,
        period,
        span: Math.max(1, Math.min(s.span, Math.min(6, count - period + 1)))
      }
    })
  }
}

function exportData() {
  downloadJSON(state, 'class-schedule.json')
  toast('已导出 class-schedule.json')
}

async function importData(file) {
  try {
    const next = await readJSONFile(file)
    state.settings = next.settings
    state.courses = next.courses
    applyTheme()
    week.value = currentWeek.value
    toast(`已导入 ${next.courses.length} 门课程`)
    closeSettings()
  } catch (err) {
    console.warn(err)
    toast('导入失败：不是有效的课表 JSON')
  }
}

function loadSample() {
  if (state.courses.length && !window.confirm('载入示例会覆盖当前课表，继续吗？')) return
  state.courses = sampleCourses()
  toast('已载入示例课表')
  closeSettings()
}

function clearAll() {
  if (!window.confirm('确定清空所有课程？此操作不可撤销（可先导出备份）')) return
  state.courses = []
  toast('课表已清空')
}

// 丢弃本机存档并重新加载页面，数据重新从数据源（解密或示例）取
function refreshLocalData() {
  if (!window.confirm('将丢弃本机对课表的改动，从数据源重新加载。继续？')) return
  resetLocalState()
  location.reload()
}

function handleSettingsAction(action) {
  if (action === 'export') exportData()
  if (action === 'refresh') refreshLocalData()
  if (action === 'sample') loadSample()
  if (action === 'clear') clearAll()
}

function sessionText(session) {
  const end = session.period + session.span - 1
  const span = end > session.period ? `${session.period}-${end}` : `${session.period}`
  return `${DAY_LABELS[session.day - 1]} 第 ${span} 节 · ${session.weeks || '每周'}`
}

// 节次区间文本，如 第 1-2 节
function periodText(block) {
  const end = block.period + block.span - 1
  return end > block.period ? `第 ${block.period}-${end} 节` : `第 ${block.period} 节`
}

let systemThemeQuery = null
function onSystemThemeChange() {
  if (state.settings.theme === 'auto') applyTheme()
}

// 左右方向键切周，N 新建（输入框里不拦截）
function onKeydown(event) {
  if (editor.open || settingsOpen.value) return
  const tag = (event.target?.tagName || '').toLowerCase()
  if (tag === 'input' || tag === 'select' || tag === 'textarea') return
  if (event.key === 'ArrowLeft') stepWeek(-1)
  else if (event.key === 'ArrowRight') stepWeek(1)
  else if (event.key.toLowerCase() === 'n' && editMode.value) openCreate()
}

onMounted(() => {
  week.value = currentWeek.value
  applyTheme()
  try {
    const stored = localStorage.getItem(MODE_KEY)
    if (stored === 'edit' || stored === 'browse') mode.value = stored
  } catch (err) {
    // 读取失败则保持默认的浏览模式
  }
  clockTimer = setInterval(() => {
    now.value = new Date()
  }, 30000)
  systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)')
  systemThemeQuery.addEventListener('change', onSystemThemeChange)
  window.addEventListener('keydown', onKeydown)
  initSecureSeed()
})

onBeforeUnmount(() => {
  clearInterval(clockTimer)
  clearTimeout(saveTimer)
  clearTimeout(toastTimer)
  systemThemeQuery?.removeEventListener('change', onSystemThemeChange)
  window.removeEventListener('keydown', onKeydown)
})

watch(
  state,
  () => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => saveState(state), 300)
  },
  { deep: true }
)

watch(
  () => state.settings.theme,
  () => applyTheme()
)

watch(
  () => state.settings.startDate,
  () => {
    week.value = clampWeek(week.value)
  }
)

watch(
  title,
  (value) => {
    document.title = value
  },
  { immediate: true }
)
</script>

<template>
  <div class="app" :class="{ browse: !editMode }">
    <header class="topbar">
      <div class="brand">
        <div class="logo">课</div>
        <div>
          <h1>{{ title }}</h1>
          <p class="sub">{{ totalWeeks }} 周学期 · {{ state.settings.startDate }} 起</p>
        </div>
      </div>

      <div class="weekbar">
        <button class="icon-btn" :disabled="week <= 1" title="上一周" @click="stepWeek(-1)">‹</button>
        <div class="week-pick">
          <select v-model.number="week" class="week-select">
            <option v-for="w in weekOptions" :key="w" :value="w">第 {{ w }} 周</option>
          </select>
          <span v-if="isCurrentWeek" class="week-tag">本周</span>
          <button v-else class="link-btn" @click="goThisWeek">回到本周</button>
        </div>
        <button
          class="icon-btn"
          :disabled="week >= totalWeeks"
          title="下一周"
          @click="stepWeek(1)"
        >
          ›
        </button>
      </div>

      <div class="tools">
        <div class="tabs">
          <button class="tab" :class="{ on: view === 'grid' }" @click="view = 'grid'">课表</button>
          <button class="tab" :class="{ on: view === 'list' }" @click="view = 'list'">课程</button>
        </div>
        <button class="icon-btn" :title="'切换主题'" @click="toggleTheme">
          {{ state.settings.theme === 'dark' ? '☀' : '☾' }}
        </button>
        <button
          class="ghost-btn mode-btn"
          :class="{ on: editMode }"
          :title="editMode ? '当前编辑模式，点击切回浏览' : '当前浏览模式，点击进入编辑'"
          @click="toggleMode"
        >
          {{ editMode ? '编辑' : '浏览' }}
        </button>
        <button class="ghost-btn" @click="openSettings">设置</button>
      </div>
    </header>

    <div v-if="todayBlocks.length" class="today-strip">
      <span class="ts-label">今天</span>
      <button
        v-for="b in todayBlocks"
        :key="b.key"
        class="ts-chip"
        :style="{ '--c': b.color }"
        @click="openEditByBlock(b)"
      >
        {{ b.name }} · {{ periodText(b) }}
      </button>
    </div>

    <main>
      <template v-if="view === 'grid'">
        <TimetableGrid
          :days="days"
          :periods="rows"
          :group-starts="groupStarts"
          :group-labels="groupLabels"
          :blocks="blocks"
          :current-period="currentPeriod"
          :editable="editMode"
          :show-hint="!state.courses.length"
          @create="openCreate"
          @select="openEditByBlock"
          @sample="loadSample"
        />

        <section v-if="unscheduledGroups.length" class="unscheduled">
          <div v-for="group in unscheduledGroups" :key="group.category" class="us-row">
            <span class="us-label">{{ group.category }}</span>
            <div class="us-items">
              <button
                v-for="course in group.items"
                :key="course.id"
                class="us-chip"
                :style="{ '--c': course.color }"
                @click="openEdit(course)"
              >
                <span class="us-name">{{ course.name }}</span>
                <em v-if="course.teacher">{{ course.teacher }}</em>
                <span v-if="course.note" class="us-note">{{ course.note }}</span>
              </button>
            </div>
          </div>
        </section>
      </template>

      <section v-else class="course-list">
        <div class="cl-head">
          <h2>课程清单<small>{{ state.courses.length }} 门</small></h2>
          <button v-if="editMode" class="primary-btn" @click="openCreate()">+ 新建课程</button>
        </div>

        <div v-if="state.courses.length" class="cl-grid">
          <article
            v-for="course in state.courses"
            :key="course.id"
            class="cl-card"
            :style="{ '--c': course.color }"
            @click="openEdit(course)"
          >
            <div class="cl-name">{{ course.name }}</div>
            <div class="cl-meta">
              {{ [course.teacher, course.room].filter(Boolean).join(' · ') || '未填写教师 / 地点' }}
            </div>
            <div v-if="course.note" class="cl-note">{{ course.note }}</div>
            <ul class="cl-sess">
              <li v-for="(s, i) in course.sessions" :key="i">{{ sessionText(s) }}</li>
              <li v-if="!course.sessions.length" class="cl-none">无固定时间，只在清单里显示</li>
            </ul>
          </article>
        </div>

        <div v-else class="empty">
          <p>还没有课程，先添加一门或看看示例</p>
          <button class="primary-btn" @click="loadSample">载入示例课表</button>
        </div>
      </section>
    </main>

    <button v-if="editMode" class="fab" title="新建课程" @click="openCreate()">+</button>

    <CourseDialog
      :open="editor.open"
      :draft="editor.draft"
      :is-new="editor.isNew"
      :courses="state.courses"
      :periods-count="periods.length"
      :total-weeks="totalWeeks"
      :palette="PALETTE"
      @close="closeEditor"
      @save="saveDraft"
      @delete="deleteDraft"
    />

    <SettingsDialog
      :open="settingsOpen"
      :draft="settingsDraft"
      :courses-count="state.courses.length"
      :uuid="activeKey"
      @close="closeSettings"
      @save="saveSettings"
      @action="handleSettingsAction"
      @import-file="importData"
    />

    <transition name="toast">
      <div v-if="toastText" class="toast">{{ toastText }}</div>
    </transition>
  </div>
</template>
