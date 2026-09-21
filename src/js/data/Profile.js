// Profile — данные ИГРОКА (не персонажа!). Отдельная система.
// { name, avatar (dataURL resized), about, email, codeHash }
// Всё optional кроме name-наличия; хранится в localStorage, переживает F5.
const PROFILE_KEY = 'gameProfile_v1'

export function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (!raw) return { name: '', avatar: '', about: '', email: '', codeHash: '' }
    const p = JSON.parse(raw)
    return {
      name: String(p.name || ''),
      avatar: String(p.avatar || ''),
      about: String(p.about || ''),
      email: String(p.email || ''),
      codeHash: String(p.codeHash || '')
    }
  } catch (e) {
    return { name: '', avatar: '', about: '', email: '', codeHash: '' }
  }
}

export function saveProfile(profile) {
  const clean = {
    name: String(profile.name || '').slice(0, 60),
    avatar: String(profile.avatar || ''),
    about: String(profile.about || '').slice(0, 500),
    email: String(profile.email || '').slice(0, 120),
    codeHash: String(profile.codeHash || '')
  }
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(clean))
  } catch (e) { /* quota / недоступен */ }
  return clean
}

export function clearProfile() {
  try { localStorage.removeItem(PROFILE_KEY) } catch (e) {}
}

// Локальный PIN/код: храним только hash (SHA-256 через Web Crypto).
// Это НЕ настоящая авторизация — только локальная защита в этом браузере.
export async function hashCode(code) {
  const s = String(code || '')
  if (!s) return ''
  try {
    if (crypto && crypto.subtle) {
      const data = new TextEncoder().encode('gameProfile:' + s)
      const digest = await crypto.subtle.digest('SHA-256', data)
      return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
    }
  } catch (e) { /* fallback ниже */ }
  // Fallback (не-HTTPS/file): простой не-крипто hash, честно локальный
  let h1 = 0x811c9dc5, h2 = 0x01000193
  const str = 'gameProfile:' + s
  for (let i = 0; i < str.length; i++) {
    h1 = Math.imul(h1 ^ str.charCodeAt(i), 16777619) >>> 0
    h2 = Math.imul(h2 + str.charCodeAt(i), 31) >>> 0
  }
  return 'fb-' + h1.toString(16) + h2.toString(16)
}

export async function verifyCode(code, codeHash) {
  if (!codeHash) return true // код не установлен — профиль открыт
  const h = await hashCode(code)
  return h === codeHash
}

// Уменьшить изображение аватара до разумного размера (max 256px),
// вернуть dataURL (jpeg). Не храним огромный оригинал, никуда не отправляем.
export function resizeAvatar(file, maxSize = 256, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      reject(new Error('not-image'))
      return
    }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        let { width, height } = img
        const k = Math.min(1, maxSize / Math.max(width, height))
        width = Math.max(1, Math.round(width * k))
        height = Math.max(1, Math.round(height * k))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        URL.revokeObjectURL(url)
        resolve(canvas.toDataURL('image/jpeg', quality))
      } catch (err) {
        URL.revokeObjectURL(url)
        reject(err)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('bad-image'))
    }
    img.src = url
  })
}
