// 无头验收：截图 + 课表逐周断言
// 用法：先 npm run dev（默认 5173），再 node scripts/check.mjs
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const SEED_PATH = 'src/data/mySchedule.json'
if (!fs.existsSync(SEED_PATH)) {
  console.log('未找到 src/data/mySchedule.json（本地私有课表），验收脚本跳过')
  process.exit(0)
}
const SEED = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'))
// 解密后存档键用密钥的 SHA-256 前缀
const KEY_ID = createHash('sha256').update(SEED.uuid).digest('hex').slice(0, 12)
const KEY = `class-schedule:v1:${KEY_ID}`
const URL = (process.env.APP_URL || 'http://localhost:5173/') + '?uuid=' + SEED.uuid
const OUT = 'shots'

fs.mkdirSync(OUT, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--hide-scrollbars', '--force-device-scale-factor=1']
})

const errors = []
const page = await browser.newPage()
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text())
})
page.on('dialog', (d) => d.accept())
await page.evaluateOnNewDocument((k) => { window.__SCHEDULE_KEY = k }, KEY)

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

await page.setViewport({ width: 1280, height: 1000 })
await page.goto(URL, { waitUntil: 'networkidle0' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle0' })
await wait(900)
await page.screenshot({ path: `${OUT}/01-my-schedule.png`, fullPage: true })

// 无固定时段课程分组
const footer = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.us-row')]
  return rows.map((r) => ({
    label: r.querySelector('.us-label').textContent.trim(),
    items: [...r.querySelectorAll('.us-chip')].map((c) => c.textContent.replace(/\s+/g, ' ').trim())
  }))
})

const dayHeads = await page.evaluate(() =>
  [...document.querySelectorAll('.day-head')].map((e) => e.querySelector('.dname').textContent.trim())
)

// 今日课程条文本
const todayChips = await page.evaluate(() =>
  [...document.querySelectorAll('.ts-chip')].map((e) => e.textContent.replace(/\s+/g, ' ').trim())
)

// 浏览模式点击课程：断言不出现 .modal
await page.click('.block .bcard')
await wait(300)
const browseOpensDialog = await page.evaluate(() => !!document.querySelector('.modal'))
if (browseOpensDialog) throw new Error('浏览模式下点击课程弹出了编辑框')
const fabInBrowse = await page.evaluate(() => !!document.querySelector('.fab'))

// 切到编辑模式
await page.click('.mode-btn')
await wait(300)
const modeLabel = await page.evaluate(() => document.querySelector('.mode-btn').textContent.trim())

const clickText = async (text) => {
  const ok = await page.evaluate((t) => {
    const el = [...document.querySelectorAll('button, label')].find((b) => b.textContent.trim() === t)
    if (!el) return false
    el.click()
    return true
  }, text)
  if (!ok) throw new Error('找不到按钮: ' + text)
  await wait(350)
}

// 读渲染结果：列=星期，行=节次（绝对行号）
const readBlocks = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('.block')].map((b) => {
      const cs = getComputedStyle(b)
      const period = parseInt(cs.gridRowStart, 10) - 1
      const day = parseInt(cs.gridColumnStart, 10) - 1
      const name = b.querySelector('.bname').textContent.trim()
      return `${day}-${period}-${name}`
    })
  )

const goWeek = async (w) => {
  await page.select('.week-select', String(w))
  await wait(350)
  return (await readBlocks()).sort()
}

// 期望集合：星期-节次-课程
const EXPECT = {
  1: [
    '1-1-机械设计',
    '2-1-机械工程测试技术',
    '3-1-机械设计',
    '3-3-工程伦理与工程项目管理',
    '4-1-机械工程测试技术',
    '5-1-写作与表达',
    '5-3-工程伦理与工程项目管理'
  ],
  2: [
    '1-1-机械设计',
    '2-1-机械工程测试技术',
    '2-11-AIGC创想与实践（初级）',
    '3-1-机械设计',
    '3-3-工程伦理与工程项目管理',
    '4-1-机械工程测试技术',
    '4-3-流体力学-液压与气压传动',
    '5-1-写作与表达',
    '5-3-工程伦理与工程项目管理'
  ],
  5: [
    '1-1-机械设计',
    '1-8-形势与政策',
    '2-1-机械工程测试技术',
    '2-11-AIGC创想与实践（初级）',
    '3-1-机械设计',
    '3-3-工程伦理与工程项目管理',
    '4-1-机械工程测试技术',
    '4-3-流体力学-液压与气压传动',
    '5-1-写作与表达',
    '5-3-工程伦理与工程项目管理'
  ],
  7: [
    '1-1-机械设计',
    '1-8-形势与政策',
    '2-1-机械工程测试技术',
    '2-11-AIGC创想与实践（初级）',
    '3-1-机械设计',
    '3-3-工程伦理与工程项目管理',
    '4-1-机械工程测试技术',
    '4-3-流体力学-液压与气压传动',
    '5-1-写作与表达',
    '5-3-工程伦理与工程项目管理'
  ],
  8: [
    '1-1-机械设计',
    '1-8-国家安全教育',
    '2-1-机械工程测试技术',
    '2-11-AIGC创想与实践（初级）',
    '3-1-机械设计',
    '3-3-工程伦理与工程项目管理',
    '4-1-机械工程测试技术',
    '4-3-流体力学-液压与气压传动',
    '5-1-写作与表达',
    '5-3-工程伦理与工程项目管理'
  ],
  9: [
    '1-1-机械设计',
    '2-11-AIGC创想与实践（初级）',
    '3-1-机械设计',
    '3-3-机械设计与制造专业英语',
    '4-3-流体力学-液压与气压传动',
    '5-1-写作与表达',
    '5-3-机械设计与制造专业英语'
  ],
  13: [
    '2-11-AIGC创想与实践（初级）',
    '3-3-机械设计与制造专业英语',
    '4-3-流体力学-液压与气压传动',
    '5-1-写作与表达',
    '5-3-机械设计与制造专业英语'
  ],
  17: []
}

const weekReport = {}
for (const [w, expected] of Object.entries(EXPECT)) {
  const actual = await goWeek(Number(w))
  const missing = expected.filter((x) => !actual.includes(x))
  const extra = actual.filter((x) => !expected.includes(x))
  weekReport[w] = { blocks: actual.length, missing, extra }
  await page.screenshot({ path: `${OUT}/week-${w}.png` })
}

// 课程清单：11 门有课时 + 3 门无固定时间
await goWeek(5)
await clickText('课程')
await wait(300)
const listInfo = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.cl-card')]
  return {
    total: cards.length,
    noTime: cards.filter((c) => c.querySelector('.cl-none')).map((c) => c.querySelector('.cl-name').textContent.trim())
  }
})
await page.screenshot({ path: `${OUT}/02-course-list.png` })
await clickText('课表')

// 编辑弹窗 / 设置弹窗
await page.click('.block .bcard')
await wait(400)
const editTitle = await page.evaluate(() => document.querySelector('.modal-body input')?.value)
await page.screenshot({ path: `${OUT}/03-edit.png` })
await clickText('取消')

await clickText('设置')
await page.screenshot({ path: `${OUT}/04-settings.png` })
await clickText('取消')

// 深色
await page.click('.tools .icon-btn')
await wait(700)
await page.screenshot({ path: `${OUT}/05-dark.png` })
await page.click('.tools .icon-btn')
await wait(700)

// 手机视图
const mobile = await browser.newPage()
mobile.on('pageerror', (e) => errors.push('mobile pageerror: ' + e.message))
await mobile.setViewport({ width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 })
await mobile.goto(URL, { waitUntil: 'networkidle0' })
await wait(400)
await mobile.screenshot({ path: `${OUT}/06-mobile.png`, fullPage: true })
await mobile.close()

// 存档同步：settingsKey 不匹配时用内置 settings 覆盖
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem(window.__SCHEDULE_KEY))
  s.settings.periods = [
    { start: '08:00', end: '08:45' },
    { start: '08:55', end: '09:40' }
  ]
  s.settings.startDate = '2020-01-06'
  s.settings.showWeekend = 'never'
  delete s.settingsKey
  localStorage.setItem(window.__SCHEDULE_KEY, JSON.stringify(s))
})
await page.reload({ waitUntil: 'networkidle0' })
await wait(500)
const timeLabels = await page.evaluate(() =>
  [...document.querySelectorAll('.time-cell .ptime')].map((e) => e.textContent.trim())
)
await page.click('.tools .icon-btn')
await wait(400)
await page.click('.tools .icon-btn')
await wait(700)
const upgraded = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem(window.__SCHEDULE_KEY))
  return {
    settingsKey: s.settingsKey,
    periods: s.settings.periods.length,
    second: s.settings.periods[1],
    startDate: s.settings.startDate,
    showWeekend: s.settings.showWeekend
  }
})

// 界面改动的作息刷新后仍保留
await clickText('设置')
await page.evaluate(() => {
  const input = document.querySelectorAll('.period-table input')[2]
  input.value = '08:52'
  input.dispatchEvent(new Event('input', { bubbles: true }))
})
await clickText('保存设置')
await wait(700)
await page.reload({ waitUntil: 'networkidle0' })
await wait(500)
const edited = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem(window.__SCHEDULE_KEY))
  return { second: s.settings.periods[1], label: document.querySelectorAll('.time-cell .ptime')[1]?.textContent.trim() }
})

const stored = await page.evaluate(() => JSON.parse(localStorage.getItem(window.__SCHEDULE_KEY) || '{}'))

console.log(
  JSON.stringify(
    {
      courses: stored.courses?.length,
      gridCourses: stored.courses?.filter((c) => c.sessions.length).length,
      sessions: stored.courses?.reduce((n, c) => n + c.sessions.length, 0),
      totalWeeks: stored.settings?.totalWeeks,
      startDate: stored.settings?.startDate,
      theme: stored.settings?.theme,
      list: listInfo,
      footer,
      editDialogFirstField: editTitle,
      timeLabels,
      dayHeads,
      todayChips,
      browseOpensDialog,
      fabInBrowse,
      modeLabel,
      upgraded,
      edited,
      weeks: weekReport,
      errors
    },
    null,
    2
  )
)

await browser.close()
