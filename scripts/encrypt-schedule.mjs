// 构建前把私有课表加密成密文：dist 里只出现 mySchedule.enc.json
// 密钥取自 mySchedule.json 的 uuid（URL 上用 ?uuid=<密钥>）
import fs from 'node:fs'
import { webcrypto as crypto } from 'node:crypto'

const SRC = 'src/data/mySchedule.json'
const OUT = 'src/data/mySchedule.enc.json'
const ITERATIONS = 150000

if (!fs.existsSync(SRC)) {
  console.log('未找到 src/data/mySchedule.json，沿用现有密文')
  process.exit(0)
}

const data = JSON.parse(fs.readFileSync(SRC, 'utf8'))
const passphrase = data.uuid
if (!passphrase) throw new Error('mySchedule.json 缺少 uuid，无法作为解密密钥')

const payload = JSON.stringify({ settings: data.settings, courses: data.courses })
const salt = crypto.getRandomValues(new Uint8Array(16))
const iv = crypto.getRandomValues(new Uint8Array(12))
const encoder = new TextEncoder()

const baseKey = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey'])
const key = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
  baseKey,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt']
)
const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(payload))

const out = {
  v: 1,
  alg: 'AES-GCM',
  kdf: 'PBKDF2-SHA256',
  iter: ITERATIONS,
  salt: Buffer.from(salt).toString('base64'),
  iv: Buffer.from(iv).toString('base64'),
  data: Buffer.from(new Uint8Array(cipher)).toString('base64')
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')
console.log(`已生成 ${OUT}：${data.courses.length} 门课，密文 ${out.data.length} 字节`)
