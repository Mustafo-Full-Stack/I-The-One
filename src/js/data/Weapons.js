// Оружие персонажей — карточки как у персонажей (см. экран Оружия).
// Нож — Человек, БЕСПЛАТНО. Катана — MAGA (+дальность). Пистолет — Человек (макс. дальность).
// Остальное придумаем позже. Оружие покупается отдельно, владения — в localStorage.
import { spendFromWallet } from './Economy.js'

const OWNED_WEAPONS_KEY = 'owned_weapons_v1'
const EQUIPPED_KEY = 'equipped_weapon_v1'

export const WEAPONS = [
  { id: 'knife',   name: 'Нож',        icon: '🔪', ownerId: 'human', price: 0,    range: 3.0,  desc: 'Бросок в голову. БЕСПЛАТНО, без патронов.' },
  { id: 'katana',  name: 'Катана',     icon: '🗡️', ownerId: 'maga',  price: 1500, range: 5.5,  desc: 'Длинный клинок: +дальность удара. Без патронов.' },
  { id: 'pistol',  name: 'Пистолет',   icon: '🔫', ownerId: 'human', price: 2500, range: 8.0,  desc: 'Самая большая дальность. 1 патрон = $5.' },
  { id: 'ak',      name: 'AK47',       icon: '🎯', ownerId: 'maga',  price: 4500, range: 9.5,  desc: 'Автомат: далеко и точно. 1 патрон = $3.' },
  { id: 'grenade', name: 'Гранатомёт', icon: '💣', ownerId: 'maga',  price: 5000, range: 12.0, desc: 'Выстрел до 12 м и взрыв по площади. 1 граната = $10.' },
  { id: 'mg',      name: 'Пулемёт',    icon: '🔥', ownerId: 'human', price: 7000, range: 10.0, desc: 'Поливай очередями! Скорострельный. 1 патрон = $2.' },
  { id: 'bus',     name: 'Автобус',    icon: '🚌', ownerId: 'human', price: 15000, range: 15.0, desc: 'Огромная дубина: достаёт через полкрыши. Без патронов.' }
]

// Скорострельность (кулдаун выстрела, сек)
export const FIRE_CD = { knife: 0.4, katana: 0.4, pistol: 0.4, ak: 0.32, grenade: 0.8, mg: 0.22, bus: 1.2 }

export function getWeaponFor(characterId) {
  return WEAPONS.find(w => w.ownerId === characterId) || null
}

export function getWeaponsFor(characterId) {
  return WEAPONS.filter(w => w.ownerId === characterId)
}

export function getOwnedWeaponIds() {
  try {
    const raw = localStorage.getItem(OWNED_WEAPONS_KEY)
    if (!raw) return ['knife']
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return ['knife']
    const valid = arr.filter(id => WEAPONS.some(w => w.id === id))
    if (!valid.includes('knife')) valid.unshift('knife')
    return valid
  } catch (e) {
    return ['knife']
  }
}

export function isWeaponOwned(weaponId) {
  return getOwnedWeaponIds().includes(weaponId)
}

// Надетое оружие (одно на всех — любой персонаж может надеть любое
// купленное оружие). По умолчанию Нож. Явные кулаки — метка '__none__'.
// Нет надетого — бой врукопашную.
const EQUIPPED_NONE = '__none__'

export function getEquippedWeaponId() {
  try {
    const id = localStorage.getItem(EQUIPPED_KEY)
    if (id === EQUIPPED_NONE) return null // кулаки выбраны явно
    if (id && WEAPONS.some(w => w.id === id) && isWeaponOwned(id)) return id
  } catch (e) { /* ignore */ }
  return isWeaponOwned('knife') ? 'knife' : null
}

export function getEquippedWeapon() {
  const id = getEquippedWeaponId()
  return (id && WEAPONS.find(w => w.id === id)) || null
}

// Надеть можно только купленное. Возвращает true/false.
export function equipWeapon(weaponId) {
  if (!weaponId || !WEAPONS.some(w => w.id === weaponId)) return false
  if (!isWeaponOwned(weaponId)) return false
  try {
    localStorage.setItem(EQUIPPED_KEY, weaponId)
  } catch (e) { /* ignore */ }
  return true
}

export function unequipWeapon() {
  try {
    localStorage.setItem(EQUIPPED_KEY, EQUIPPED_NONE)
  } catch (e) { /* ignore */ }
}

// Патроны у всего стрелкового (нож/катана бесконечные).
// Формат: магазин/запас. Докупка пачкой за деньги.
// пистолет +20=$100 · AK +30=$90 · пулемёт +50=$100 · гранаты +5=$50.
const AMMO_KEY = 'weapon_ammo_v2'
const AMMO_LEGACY_KEY = 'pistol_ammo_v1'
export const AMMO_DEFS = {
  pistol:  { magSize: 20, startReserve: 40,  pack: 20, price: 100 },
  ak:      { magSize: 30, startReserve: 60,  pack: 30, price: 90 },
  mg:      { magSize: 50, startReserve: 100, pack: 50, price: 100 },
  grenade: { magSize: 5,  startReserve: 10,  pack: 5,  price: 50 }
}

export function needsAmmo(gunId) {
  return !!AMMO_DEFS[gunId]
}

function defaultAmmo() {
  const out = {}
  for (const id of Object.keys(AMMO_DEFS)) {
    out[id] = { mag: AMMO_DEFS[id].magSize, reserve: AMMO_DEFS[id].startReserve }
  }
  // Разовый переезд со старого ключа пистолета
  try {
    const legacy = localStorage.getItem(AMMO_LEGACY_KEY)
    if (legacy) {
      const p = JSON.parse(legacy)
      if (p && Number.isFinite(+p.mag)) {
        out.pistol = { mag: Math.max(0, Math.floor(+p.mag)), reserve: Math.max(0, Math.floor(+p.reserve)) }
      }
      localStorage.removeItem(AMMO_LEGACY_KEY)
    }
  } catch (e) { /* ignore */ }
  return out
}

function readAmmo() {
  try {
    const raw = localStorage.getItem(AMMO_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        const out = defaultAmmo()
        for (const id of Object.keys(AMMO_DEFS)) {
          const a = parsed[id]
          if (a && Number.isFinite(+a.mag)) {
            out[id] = { mag: Math.max(0, Math.floor(+a.mag)), reserve: Math.max(0, Math.floor(+a.reserve)) }
          }
        }
        return out
      }
    }
  } catch (e) { /* ignore */ }
  return defaultAmmo()
}

function writeAmmo(all) {
  try {
    localStorage.setItem(AMMO_KEY, JSON.stringify(all))
  } catch (e) { /* ignore */ }
}

export function getAmmo(gunId) {
  const all = readAmmo()
  return all[gunId] || { mag: 0, reserve: 0 }
}

export function setAmmo(gunId, mag, reserve) {
  const all = readAmmo()
  if (!all[gunId]) return
  all[gunId] = { mag: Math.max(0, Math.floor(mag)), reserve: Math.max(0, Math.floor(reserve)) }
  writeAmmo(all)
}

// Докупить пачку патронов: { ok, reason }
export function buyAmmo(gunId) {
  const def = AMMO_DEFS[gunId]
  if (!def) return { ok: false, reason: 'unknown' }
  const res = spendFromWallet(def.price)
  if (!res.ok) return res
  const a = getAmmo(gunId)
  setAmmo(gunId, a.mag, Math.min(999, a.reserve + def.pack))
  return { ok: true, reason: 'ok' }
}

// Покупка оружия: { ok, reason }: 'ok' | 'owned' | 'insufficient' | 'unknown'
export function buyWeapon(weaponId) {
  const w = WEAPONS.find(x => x.id === weaponId)
  if (!w) return { ok: false, reason: 'unknown' }
  if (isWeaponOwned(weaponId)) return { ok: true, reason: 'owned' }
  const res = spendFromWallet(w.price)
  if (!res.ok) return res
  try {
    const owned = getOwnedWeaponIds()
    owned.push(weaponId)
    localStorage.setItem(OWNED_WEAPONS_KEY, JSON.stringify(owned))
  } catch (e) { /* ignore */ }
  return { ok: true, reason: 'ok' }
}
