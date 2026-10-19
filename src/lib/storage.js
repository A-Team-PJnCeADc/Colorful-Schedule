import { mondayOf, todayISO } from './date.js'
import exampleSeed from '../data/examplemyschedule.json'

// 公开示例数据直接打包；私有课表只打包密文，运行时用 ?uuid= 里的密钥解密
const encryptedModules = import.meta.glob('../data/*.enc.json', { eager: true })
export const ENCRYPTED_SEED = Object.values(encryptedModules)[0]?.default || null

export const EXAMPLE_UUID = exampleSeed.uuid

const KEY_PREFIX = 'class-schedule:v1'
let activeStorageKey = `${KEY_PREFIX}:${exampleSeed.uuid}`
let activeSettingsKey = ''

export function useStorageKey(id) {
  activeStorageKey = `${KEY_PREFIX}:${id || exampleSeed.uuid}`
}

export function readUuidParam() {
  try {
    return new URLSearchParams(location.search).get('uuid') || ''
  } catch (err) {
    return ''
  }
}

// 12 节作息时间
export const DEFAULT_PERIODS = [
  { start: '08:00', end: '08:45' },
  { start: '08:50', end: '09:35' },
  { start: '09:50', end: '10:35' },
  { start: '10:40', end: '11:25' },
  { start: '11:30', end: '12:15' },
  { start: '13:30', end: '14:15' },
  { start: '14:20', end: '15:05' },
  { start: '15:20', end: '16:05' },
  { start: '16:10', end: '16:55' },
  { start: '17:00', end: '17:45' },
  { start: '19:00', end: '19:45' },
  { start: '19:50', end: '20:35' }
]

export const PALETTE = [
  '#4C6EF5',
  '#F2994A',
  '#27AE60',
  '#BB6BD9',
  '#EB5757',
  '#2D9CDB',
  '#E2B93B',
  '#00A3A3',
  '#9B51E0',
  '#EF6FA8',
  '#3FA87A',
  '#7A869A'
]

export function defaultSettings() {
  return {
    totalWeeks: 20,
    startDate: mondayOf(todayISO()),
    periods: DEFAULT_PERIODS.map((p) => ({ ...p })),
    showWeekend: 'auto',
    theme: 'auto',
    hideEmptyRows: true
  }
}

export function emptyState() {
  return { version: 1, settingsKey: '', settings: defaultSettings(), courses: [] }
}

function normalize(raw) {
  const base = emptyState()
  if (!raw || typeof raw !== 'object') return base

  const settings = { ...base.settings, ...(raw.settings || {}) }
  settings.totalWeeks = Math.min(30, Math.max(1, Number(settings.totalWeeks) || 20))
  settings.startDate = /^\d{4}-\d{2}-\d{2}$/.test(settings.startDate || '') ? settings.startDate : base.settings.startDate
  // 第一周一律对齐到周一，避免导入的日期是周中导致周号与表头错位
  settings.startDate = mondayOf(settings.startDate)
  if (!Array.isArray(settings.periods) || !settings.periods.length) settings.periods = base.settings.periods
  settings.hideEmptyRows = settings.hideEmptyRows !== false
  settings.showWeekend = ['auto', 'always', 'never'].includes(settings.showWeekend) ? settings.showWeekend : 'auto'
  settings.theme = ['auto', 'light', 'dark'].includes(settings.theme) ? settings.theme : 'auto'
  settings.periods = settings.periods
    .slice(0, 16)
    .map((p) => ({ start: String(p?.start || '08:00').slice(0, 5), end: String(p?.end || '08:45').slice(0, 5) }))

  const courses = Array.isArray(raw.courses) ? raw.courses : []
  return {
    version: 1,
    settingsKey: String(raw.settingsKey || ''),
    settings,
    courses: courses
      .filter((c) => c && typeof c.name === 'string' && c.name.trim())
      .map((c) => ({
        id: String(c.id || uid()),
        name: String(c.name).slice(0, 20),
        teacher: String(c.teacher || '').slice(0, 20),
        room: String(c.room || '').slice(0, 20),
        note: String(c.note || '').slice(0, 40),
        category: String(c.category || '').slice(0, 10),
        color: /^#[0-9a-f]{6}$/i.test(c.color || '') ? c.color : PALETTE[0],
        sessions: (Array.isArray(c.sessions) ? c.sessions : [])
          .filter((s) => s && s.day >= 1 && s.day <= 7)
          .map((s) => ({
            day: Math.min(7, Math.max(1, Number(s.day) || 1)),
            period: Math.min(16, Math.max(1, Number(s.period) || 1)),
            span: Math.min(8, Math.max(1, Number(s.span) || 1)),
            weeks: String(s.weeks || '')
          }))
      }))
  }
}

function hashOf(text) {
  let hash = 5381
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0
  return (hash >>> 0).toString(36)
}

// settings 指纹：periods / startDate / totalWeeks / showWeekend 任一变化即重新同步
export function settingsKeyOf(settings) {
  return hashOf(
    JSON.stringify([
      (settings?.periods || []).map((p) => ({ start: p.start, end: p.end })),
      settings?.startDate,
      settings?.totalWeeks,
      settings?.showWeekend
    ])
  )
}

function applySeedSettings(state, settings) {
  if (!settings) return state
  const key = settingsKeyOf(settings)
  activeSettingsKey = key
  if (state.settingsKey === key) return state

  const periods = (settings.periods || []).map((p) => ({ start: p.start, end: p.end }))
  if (periods.length) state.settings.periods = periods
  if (settings.startDate) state.settings.startDate = mondayOf(settings.startDate)
  if (settings.totalWeeks) state.settings.totalWeeks = Math.min(30, Math.max(1, Number(settings.totalWeeks)))
  if (['auto', 'always', 'never'].includes(settings.showWeekend)) state.settings.showWeekend = settings.showWeekend
  state.settingsKey = key
  return state
}

export function loadState() {
  try {
    // 只读当前数据源自己的存档；不带 ?uuid= 时不回落到任何私有数据
    const raw = localStorage.getItem(activeStorageKey)
    const state = raw ? normalize(JSON.parse(raw)) : normalize(exampleSeed)
    return applySeedSettings(state, exampleSeed.settings)
  } catch (err) {
    console.warn('本地数据解析失败，已回退到内置课表', err)
    return applySeedSettings(normalize(exampleSeed), exampleSeed.settings)
  }
}

// 解密成功后调用：切换存储键；force=true 时丢弃该键的旧存档，直接用解密出来的数据
export function loadDecryptedState(payload, keyId, { force = false } = {}) {
  useStorageKey(keyId)
  let raw = null
  try {
    if (force) localStorage.removeItem(activeStorageKey)
    else raw = localStorage.getItem(activeStorageKey)
  } catch (err) {
    raw = null
  }
  const state = normalize(raw ? JSON.parse(raw) : payload)
  return applySeedSettings(state, payload.settings)
}

const LAST_KEY_STORE = 'class-schedule:lastkey'

export function lastKeyUsed() {
  try {
    return localStorage.getItem(LAST_KEY_STORE) || ''
  } catch (err) {
    return ''
  }
}

export function markKeyUsed(id) {
  try {
    localStorage.setItem(LAST_KEY_STORE, id)
  } catch (err) {
    // 存不了就下次仍然按“密钥变化”处理
  }
}

// 清掉当前数据源的本地存档（含旧版单 key），用于从数据源重新加载
export function resetLocalState() {
  try {
    localStorage.removeItem(activeStorageKey)
    localStorage.removeItem('class-schedule:v1')
  } catch (err) {
    console.warn('清空本地存档失败', err)
  }
}

export function saveState(state) {
  try {
    // 写入即标记为已同步，避免下次加载覆盖界面里的改动
    if (activeSettingsKey) state.settingsKey = activeSettingsKey
    localStorage.setItem(activeStorageKey, JSON.stringify(state))
  } catch (err) {
    console.warn('本地保存失败', err)
  }
}

export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID().slice(0, 8)
  return Math.random().toString(36).slice(2, 10)
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

export function downloadJSON(state, filename = 'class-schedule.json') {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function readJSONFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        resolve(normalize(JSON.parse(String(reader.result))))
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}
