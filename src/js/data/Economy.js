// Economy — единственный источник правды по деньгам и владениям.
// Один общий кошелёк (стартует с 0) + список купленных персонажей.
// Цены — в Characters.js (price). Человек бесплатен и owned по умолчанию.
// UI никогда не трогает деньги напрямую:
//   победа -> addVictoryReward() (+$250 в кошелёк)
//   покупка -> buyCharacter() (проверка + списание) или 'insufficient'
const WALLET_KEY = 'player_wallet_v1'
const OWNED_KEY = 'owned_characters_v1'
export const VICTORY_REWARD = 250

import { CHARACTERS, PLAYABLE_IDS, setSelectedCharacterId } from './Characters.js'

function readNum(key) {
  try {
    const v = Number(localStorage.getItem(key))
    return Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0
  } catch (e) {
    return 0
  }
}

function writeNum(key, value) {
  try {
    localStorage.setItem(key, String(Math.max(0, Math.floor(value))))
  } catch (e) { /* ignore */ }
}

// --- Кошелёк (стартовый баланс 0) ---
export function getWallet() {
  return readNum(WALLET_KEY)
}

// --- Владения ---
export function getOwnedIds() {
  try {
    const raw = localStorage.getItem(OWNED_KEY)
    if (!raw) return ['human']
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return ['human']
    const valid = arr.filter(id => CHARACTERS.some(c => c.id === id))
    if (!valid.includes('human')) valid.unshift('human')
    return valid
  } catch (e) {
    return ['human']
  }
}

function saveOwnedIds(ids) {
  try {
    localStorage.setItem(OWNED_KEY, JSON.stringify(ids))
  } catch (e) { /* ignore */ }
}

export function isOwned(characterId) {
  return PLAYABLE_IDS.includes(characterId) && getOwnedIds().includes(characterId)
}

export function isLocked(characterId) {
  return !PLAYABLE_IDS.includes(characterId)
}

export function getPrice(characterId) {
  const c = CHARACTERS.find(x => x.id === characterId)
  return c ? c.price : 0
}

// Если выбран персонаж, которого не купили (старый сейв) — откат на Человека
export function ensureValidSelection(selectedId) {
  if (!selectedId || !isOwned(selectedId)) {
    setSelectedCharacterId('human')
    return 'human'
  }
  return selectedId
}

// Покупка: хватает денег (balance >= amount) -> списание + true,
// иначе false и ничего не списывается (UI показывает «НЕДОСТАТОЧНО ДЕНЕГ»).
// Заблокированных (не из PLAYABLE) купить нельзя.
// Возвращает { ok, reason }: 'ok' | 'owned' | 'insufficient' | 'locked' | 'unknown'
export function buyCharacter(characterId) {
  const c = CHARACTERS.find(x => x.id === characterId)
  if (!c) return { ok: false, reason: 'unknown' }
  if (isLocked(characterId)) return { ok: false, reason: 'locked' }
  if (isOwned(characterId)) return { ok: true, reason: 'owned' }
  const wallet = getWallet()
  if (wallet < c.price) return { ok: false, reason: 'insufficient' }
  writeNum(WALLET_KEY, wallet - c.price)
  const owned = getOwnedIds()
  owned.push(characterId)
  saveOwnedIds(owned)
  return { ok: true, reason: 'ok' }
}

// Списание из кошелька: хватает -> списание + { ok: true },
// иначе { ok: false, reason: 'insufficient' } без списания.
export function spendFromWallet(amount) {
  const wallet = getWallet()
  if (wallet < amount) return { ok: false, reason: 'insufficient' }
  writeNum(WALLET_KEY, wallet - amount)
  return { ok: true, reason: 'ok' }
}

// Начисление произвольной суммы в кошелёк с защитой от дубля по токену.
// Возвращает новый баланс или null (дубль).
export function addCoins(amount, victoryToken = null) {
  amount = Math.max(0, Math.floor(Number(amount) || 0))
  if (victoryToken !== null && victoryToken === _lastVictoryToken) return null
  if (victoryToken !== null) _lastVictoryToken = victoryToken

  const next = getWallet() + amount
  writeNum(WALLET_KEY, next)
  return next
}

// --- Промокоды: в коде лежит только SHA-256 хеш (не сам код).
// Один код — одно использование в браузере, подбор душится блокировкой.
// Клиентскую защиту честно считаем базовой: от любопытных — да,
// от взлома localStorage — нет (это невозможно на чистом клиенте).
const PROMO_AMOUNTS = {
  '641a7d1c95c704307d482b2ddf2b29f135c18d3d196e406a7e2177efd698f933': 10000, // akayi_Mustafo
  'cf300fcf92e799f18c25b31f8057d7c0c9e92b5ad6f52099a3fc4f08b7840f2b': 10000 // mister_bist
}
const USED_PROMOS_KEY = 'used_promos_v1'
const PROMO_FAIL_KEY = 'promo_fails_v1'
const PROMO_LOCK_KEY = 'promo_lock_until_v1'
const PROMO_MAX_FAILS = 5
const PROMO_LOCK_MS = 60000

async function sha256hex(s) {
  const data = new TextEncoder().encode(s)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function getUsedPromos() {
  try {
    const arr = JSON.parse(localStorage.getItem(USED_PROMOS_KEY) || '[]')
    return Array.isArray(arr) ? arr : []
  } catch (e) {
    return []
  }
}

// Возвращает { ok, reason, amount?, balance? }.
// reason: 'ok' | 'empty' | 'locked' | 'used' | 'invalid' | 'nossl'
export async function redeemPromo(code) {
  code = String(code || '').trim() // регистр важен, пробелы по краям режем
  if (!code) return { ok: false, reason: 'empty' }
  let fails = 0, lockUntil = 0
  try {
    fails = Number(localStorage.getItem(PROMO_FAIL_KEY)) || 0
    lockUntil = Number(localStorage.getItem(PROMO_LOCK_KEY)) || 0
  } catch (e) { /* ignore */ }
  if (Date.now() < lockUntil) return { ok: false, reason: 'locked' }
  let h
  try {
    h = await sha256hex('promo:' + code)
  } catch (e) {
    return { ok: false, reason: 'nossl' } // нужен HTTPS/localhost для WebCrypto
  }
  const used = getUsedPromos()
  if (used.includes(h)) return { ok: false, reason: 'used' }
  const amount = PROMO_AMOUNTS[h]
  if (!amount) {
    fails += 1
    try {
      localStorage.setItem(PROMO_FAIL_KEY, String(fails))
      if (fails >= PROMO_MAX_FAILS) {
        localStorage.setItem(PROMO_LOCK_KEY, String(Date.now() + PROMO_LOCK_MS))
        localStorage.setItem(PROMO_FAIL_KEY, '0')
      }
    } catch (e) { /* ignore */ }
    return { ok: false, reason: 'invalid' }
  }
  used.push(h)
  try {
    localStorage.setItem(USED_PROMOS_KEY, JSON.stringify(used))
    localStorage.setItem(PROMO_FAIL_KEY, '0')
  } catch (e) { /* ignore */ }
  const next = addCoins(amount, 'promo-' + h)
  return { ok: true, reason: 'ok', amount, balance: next }
}

// Защита от двойной награды за одно событие победы:
// один victoryToken — одна награда. Повторный вызов с тем же
// токеном игнорируется. Без токена — обычное начисление (один вызов = +250).
// Награда всегда идёт в общий кошелёк (не в тест-режиме — решает GameManager).
let _lastVictoryToken = null

export function addVictoryReward(characterId, victoryToken = null) {
  if (!characterId || !CHARACTERS.some(c => c.id === characterId)) return null
  return addCoins(VICTORY_REWARD, victoryToken)
}

// Концептуальная обёртка из ТЗ
export function rewardVictory(characterId, victoryToken = null) {
  return addVictoryReward(characterId, victoryToken)
}
