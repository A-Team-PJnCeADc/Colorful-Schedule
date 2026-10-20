# 大学生彩色课程表

纯前端静态课表，没有后端、没有数据库、没有账号。数据存在浏览器 localStorage，随时可导出 JSON 备份或换设备导入。

## 技术选型

Vue 3 + Vite，手写 CSS（CSS 变量 + `color-mix` 上色），不引 UI 库、不引 Tailwind。

理由：课表的核心交互是「点格子加课、切周、改颜色、拖出弹窗」，用响应式框架写状态最省事；构建产物就是一个 HTML，静态托管零配置。手写 CSS 让彩色块的颜色只由一个十六进制值驱动，浅色/深色主题共用一套颜色。

## 快速开始

```bash
npm install
npm run dev        # 开发，默认 http://localhost:5173
npm run build      # 产物 dist/index.html（单文件，样式脚本全内联）
```

`npm run build` 后直接双击 `dist/index.html` 就能用（用 `vite-plugin-singlefile` 把 JS 和 CSS 全内联），也可以丢到任意静态空间。

## 部署（无后端）

- GitHub Pages：把 `dist/index.html` 推到 `gh-pages` 分支根目录，或仓库 Settings → Pages 选 main/root（把 build 产物提交上去）。
- Vercel / Netlify / Cloudflare Pages：Build command `npm run build`，Output directory `dist`。
- 学校内网 / 个人服务器：只上传 `dist/index.html` 一个文件即可。

注意：`base: './'` 已配置，放在子目录（如 `https://xxx.github.io/schedule/`）不会白屏。

## 功能

- 周次网格：节次 × 星期，当前周自动定位（按「第一周周一」推算），可前后翻周、点选任意周
- 课程块按颜色区分，支持一门课多个时段（如周二 1-2 节 + 周四 3-4 节）
- 周次表达式：`1-16` / `1-16单` / `1-16双` / `1-8,10-16` / 空=全学期
- 同一天同一节撞课时并排分栏显示，不会互相遮挡
- 今天一栏高亮、正在上的节次高亮、顶部"今天"课程速览（含节次区间，如 第 1-2 节）
- 浏览 / 编辑模式：右上角切换，浏览模式只读（点课程不弹框、无新建按钮），编辑模式可增删改；选择记在 localStorage `class-schedule:mode`
- 节次按上午/下午/晚上分组：时间列显示每节起止时间与时段名，网格上画分隔线（按相邻节次时间间隔自动划分）
- 空节次自动收起（至少保留 8 行，可在设置里关掉）
- 无固定时间的课程（实践课/线上课）保留在课程清单，不占网格
- 浅色 / 深色 / 跟随系统
- 导出/导入 JSON、载入示例、清空
- 手机端 7 天按屏宽铺满（列宽下限 42px，360~430px 宽内无需横向滚动）；地点拆成「楼名 / 房号前缀 / 房号」三行显示，省略 `@` 前缀，仍放不下时点块展开全文。
- X5 / QQ 内置浏览器自动切 lite：关闭吸顶、毛玻璃、阴影与过渡，减少滚动重绘；不支持 `color-mix` 的内核用「底色 + 半透明白/黑蒙层」兜底，保证色块仍有底色。
- 快捷键：`←` `→` 切周，`N` 新建课程

## 数据保存与迁移（无后端）

- 运行时数据只存浏览器 localStorage：键 `class-schedule:v1`（整份 settings + courses 序列化），另有一个 `class-schedule:mode` 存浏览/编辑模式。没有服务端，不会写回任何文件。
- 按 origin 隔离：`localhost:5173`、`localhost:4173`、`file://`、`https://<user>.github.io` 各是一份独立存储，换地址打开看到的是另一份数据。
- 同一浏览器不清站点数据时长期有效（localStorage 无过期时间），清理浏览器数据/无痕模式会丢。
- 跨设备搬运用 设置 → 导出 JSON / 导入 JSON：文件级备份，也可直接改这个文件。
- 标题随数据源变化：解密成功显示「我的课表」，示例数据时显示「示例数据」（页面标题同步）。
- 设置 → 刷新本地数据：清掉当前数据源的本地存档并重新加载页面（带 `?uuid=` 时重新解密，否则回到示例），用于丢弃本机改动、拉取最新数据。
- 真正的多端自动同步需要服务端（Supabase / Gist / 自建 API 等），本项目按“无后端”约束不实现。

## 私有课表：构建期加密，dist 里只有密文

- `scripts/encrypt-schedule.mjs` 在 `npm run dev` / `npm run build` 前执行：读 `src/data/mySchedule.json`，用它的 `uuid` 作口令，PBKDF2-SHA256(150k) 派生密钥 + AES-256-GCM 加密 `{settings, courses}`，输出 `src/data/mySchedule.enc.json`（只含 base64 密文、salt、iv）。构建产物里不会出现任何课程明文。
- 打开 `?uuid=<密钥>` 时，浏览器取密文 → 同样的 PBKDF2 → AES-GCM 解密 → 成功则用解出的数据，失败（或没带密钥）静默使用 `examplemyschedule.json`，不弹任何提示。
- 密钥刷新规则：与上次使用的密钥不同（首次访问也算）→ 立即丢弃该密钥的本地存档、以解密结果为准；密钥未变 → 沿用本机改动。上次使用的标识存在 `class-schedule:lastkey`，只存密钥的 SHA-256 前 12 位，不存密钥本身。
- 解密成功后存档键切换为 `class-schedule:v1:<sha256(密钥) 前 12 位>`，密钥本身不写进 localStorage；不带 `?uuid=` 时只读示例数据自己的存档（旧版本遗留的 `class-schedule:v1` 不再回落，避免无密钥时读到私有课表）。
- 没有 `mySchedule.json` 的机器（公开仓库/CI）构建时沿用已有 `mySchedule.enc.json`；仓库默认两样都不含（都在 `.gitignore` 里），因此公开部署只有示例数据。
- 想让公开部署也能用密钥访问，需要自行把 `mySchedule.enc.json` 加进仓库，风险见下一节。
- 只改了 `mySchedule.json` 时记得重新构建（`dev`/`build` 会自动重新加密）；`scripts/check.mjs` 依赖本地 `mySchedule.json`，缺失时自动跳过。

### 这不是数据保护，只是不公开显示

- 密文、salt、iv 和解密逻辑都在发给浏览器的静态文件里。任何人拿到 dist 就能离线跑 PBKDF2 + AES-GCM 尝试解密，只是需要猜密钥。
- 密钥出现在 URL 查询串里：浏览器历史、分享链接、Referer、托管平台的访问日志都可能记录它。链接一旦外传，等同于把课表交出去。
- 客户端代码可被任意修改，任何前端校验都不构成访问控制。
- 真要保护数据，只有两条路：不把密文放进公开构建（本机 localStorage / 手动导入），或加服务端鉴权后下发数据。当前实现属于“防误看”，不承诺任何安全性。

| 地址 | 行为 |
| --- | --- |
| 不带 `?uuid=` | 示例课表 |
| `?uuid=<正确密钥>` | 解密并显示私有课表 |
| `?uuid=<错误密钥>` | 示例课表 + 提示“密钥不正确” |

## 数据格式

localStorage key：`class-schedule:v1`

```json
{
  "version": 1,
  "settings": {
    "totalWeeks": 20,
    "startDate": "2026-09-07",
    "periods": [{ "start": "08:00", "end": "08:45" }],
    "showWeekend": "auto",
    "theme": "auto",
    "hideEmptyRows": true
  },
  "courses": [
    {
      "id": "a1b2c3d4",
      "name": "高等数学 A",
      "teacher": "王建国",
      "room": "教1-301",
      "color": "#4C6EF5",
      "sessions": [
        { "day": 1, "period": 1, "span": 2, "weeks": "1-16" },
        { "day": 3, "period": 1, "span": 2, "weeks": "1-16" }
      ]
    }
  ]
}
```

`day` 1=周一 … 7=周日；`period` 起始节次；`span` 连上几节；`weeks` 即周次表达式。

## 目录

```
src/
  App.vue                    页面骨架：周次切换、视图切换、增删改入口
  components/TimetableGrid.vue   课表网格（纯展示，点空格 emit create）
  components/CourseDialog.vue    课程增改弹窗（含冲突提示）
  components/SettingsDialog.vue  学期/显示/节次时间/数据导入导出
  lib/weeks.js               周次表达式解析与格式化
  lib/layout.js              按周展开课程、重叠分栏、冲突检测
  lib/date.js                周次/日期换算
  lib/storage.js             默认值、localStorage 读写、导入导出、settings 指纹同步
  lib/crypto.js              PBKDF2 + AES-GCM 解密
  data/sample.js             示例课表（读 examplemyschedule.json）
  data/examplemyschedule.json 公开示例数据
  data/mySchedule.json       本地私有课表（.gitignore，仅构建时使用）
  data/mySchedule.enc.json   构建生成的密文（可发布）
scripts/check.mjs            无头验收脚本（截图 + 交互 + 存储校验）
```

## 验收脚本

```bash
npm run dev                     # 另开一个终端（默认 5173）
node scripts/check.mjs          # 截图输出到 shots/，并打印课程数/行数/新增结果
```

脚本用本机 Chrome（`puppeteer-core`，不加下载浏览器）跑一遍：空状态 → 载入示例 → 打开编辑 → 设置 → 课程清单 → 深色 → 第 9 周 → 新建课程，同时校验 localStorage 落盘。
