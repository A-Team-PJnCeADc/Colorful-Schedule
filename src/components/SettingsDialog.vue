<script setup>
import { computed } from 'vue'
import { DEFAULT_PERIODS } from '../lib/storage.js'
import { groupPeriods } from '../lib/periods.js'

const props = defineProps({
  open: { type: Boolean, default: false },
  draft: { type: Object, default: null },
  coursesCount: { type: Number, default: 0 },
  uuid: { type: String, default: '' }
})

const emit = defineEmits(['close', 'save', 'action', 'import-file'])

const themeOptions = [
  { v: 'auto', t: '跟随系统' },
  { v: 'light', t: '浅色' },
  { v: 'dark', t: '深色' }
]

const weekendOptions = [
  { v: 'auto', t: '自动' },
  { v: 'always', t: '显示' },
  { v: 'never', t: '隐藏' }
]

const periodCount = computed({
  get: () => props.draft?.periods?.length || 0,
  set: (n) => {
    if (!props.draft) return
    const count = Math.min(16, Math.max(4, Number(n) || 12))
    const list = props.draft.periods
    while (list.length < count) {
      const fallback = DEFAULT_PERIODS[list.length] || DEFAULT_PERIODS[DEFAULT_PERIODS.length - 1]
      list.push({ ...fallback })
    }
    while (list.length > count) list.pop()
  }
})

const periodGroups = computed(() => groupPeriods(props.draft?.periods || []))

function pickFile(event) {
  const file = event.target.files?.[0]
  if (file) emit('import-file', file)
  event.target.value = ''
}
</script>

<template>
  <transition name="fade">
    <div v-if="open && draft" class="overlay" @click.self="emit('close')">
      <div class="modal wide">
        <header class="modal-head">
          <h2>课表设置</h2>
          <button class="icon-btn" @click="emit('close')">✕</button>
        </header>

        <div class="modal-body">
          <section class="settings-group">
            <h3>学期</h3>
            <div class="row-2">
              <label class="field">
                <span>第一周周一</span>
                <input v-model="draft.startDate" type="date" />
              </label>
              <label class="field">
                <span>总周数</span>
                <input v-model.number="draft.totalWeeks" type="number" min="1" max="30" />
              </label>
              <label class="field">
                <span>每天节数</span>
                <input v-model.number="periodCount" type="number" min="4" max="16" />
              </label>
            </div>
          </section>

          <section class="settings-group">
            <h3>显示</h3>
            <div class="row-2">
              <div class="field">
                <span>周末</span>
                <div class="seg">
                  <button
                    v-for="opt in weekendOptions"
                    :key="opt.v"
                    :class="{ on: draft.showWeekend === opt.v }"
                    @click="draft.showWeekend = opt.v"
                  >
                    {{ opt.t }}
                  </button>
                </div>
              </div>
              <div class="field">
                <span>主题</span>
                <div class="seg">
                  <button
                    v-for="opt in themeOptions"
                    :key="opt.v"
                    :class="{ on: draft.theme === opt.v }"
                    @click="draft.theme = opt.v"
                  >
                    {{ opt.t }}
                  </button>
                </div>
              </div>
            </div>
            <div class="field">
              <span>底部空节次</span>
              <div class="seg">
                <button
                  :class="{ on: draft.hideEmptyRows !== false }"
                  @click="draft.hideEmptyRows = true"
                >
                  自动收起
                </button>
                <button
                  :class="{ on: draft.hideEmptyRows === false }"
                  @click="draft.hideEmptyRows = false"
                >
                  全部显示
                </button>
              </div>
            </div>
          </section>

          <section class="settings-group">
            <h3>上下课时间</h3>
            <div class="period-table">
              <template v-for="group in periodGroups" :key="group.label + group.from">
                <div class="pgroup">
                  <span>{{ group.label }}</span>
                  <span>{{ group.start }} – {{ group.end }}</span>
                </div>
                <template
                  v-for="(p, i) in draft.periods.slice(group.from, group.to + 1)"
                  :key="group.from + i"
                >
                  <span class="pno">{{ group.from + i + 1 }}</span>
                  <input v-model="p.start" type="time" />
                  <input v-model="p.end" type="time" />
                </template>
              </template>
            </div>
          </section>

          <section class="settings-group">
            <h3>数据（当前 {{ coursesCount }} 门课，保存在本机浏览器）</h3>
            <div class="data-row">
              <button class="ghost-btn" @click="emit('action', 'export')">导出 JSON</button>
              <label class="ghost-btn" style="display: inline-flex; align-items: center">
                导入 JSON
                <input type="file" accept="application/json,.json" hidden @change="pickFile" />
              </label>
              <button class="ghost-btn" @click="emit('action', 'refresh')">刷新本地数据</button>
              <button class="ghost-btn" @click="emit('action', 'sample')">载入示例</button>
              <button class="danger-btn" @click="emit('action', 'clear')">清空课表</button>
            </div>
            <div class="s-hint">链接标识：?uuid={{ uuid }}</div>
          </section>
        </div>

        <footer class="modal-foot">
          <div class="spacer"></div>
          <button class="ghost-btn" @click="emit('close')">取消</button>
          <button class="primary-btn" @click="emit('save')">保存设置</button>
        </footer>
      </div>
    </div>
  </transition>
</template>
