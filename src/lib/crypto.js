// 浏览器端解密：PBKDF2(SHA-256) 派生密钥 + AES-256-GCM
const ITERATIONS = 150000

function fromBase64(text) {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export async function decryptSchedule(encrypted, passphrase) {
  if (!encrypted?.data || !encrypted?.salt || !encrypted?.iv) throw new Error('密文格式不正确')
  const salt = fromBase64(encrypted.salt)
  const iv = fromBase64(encrypted.iv)
  const data = fromBase64(encrypted.data)

  const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, [
    'deriveKey'
  ])
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: encrypted.iter || ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  )
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  return JSON.parse(new TextDecoder().decode(plain))
}

// 用密钥的 SHA-256 前缀当存档标识，避免把密钥写进 localStorage
export async function keyIdOf(passphrase) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(passphrase))
  return Array.from(new Uint8Array(digest))
    .slice(0, 6)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
