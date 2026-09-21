// ============================================================================
// СКРЫТО (закомментировано //): раздел СУПЕР-СИЛЫ пока НЕ НУЖЕН.
// Не удалено — лежит здесь до востребования. Чтобы вернуть:
//   1) раскомментировать этот файл,
//   2) раскомментировать import + useSuper + G/⚡ в GameManager.js,
//   3) раскомментировать каталог + кнопку в main.js,
//   4) раскомментировать кнопку меню, экран и touch-кнопку в index.html.
// ============================================================================
// // Супер-силы: по одной у каждого персонажа, покупаются в каталоге «Супер-силы».
// // --- ПОЛНОЕ ОПИСАНИЕ МЕХАНИКИ (пригодится при доработке) ---
// // Что делает СУПЕР-УДАР: голубая ударная волна вокруг игрока.
// // Радиус: дальность персонажа + 4 м (кольцо дальности + ещё чуть).
// // Эффект: КАЖДОМУ живому боту в радиусе сносит 2 щита (два вызова receiveHit).
// //   - был 1 щит -> остаётся 0 (следующий удар выбивает);
// //   - было 0 щитов -> сразу вылет с крыши + награда за килл;
// //   - было 2+ щитов -> просто минус 2.
// // Как использовать: клавиша G на ПК / кнопка ⚡ на телефоне.
// // Условие: супер-сила персонажа куплена + ты играешь ЭТИМ персонажем.
// // Кулдаун: 5 сек (SUPER_CD). Во время кулдауна — подсказка «ещё X c».
// // Тест-режим: супер-удар не работает (там нет ботов).
// // Награда за выбитых супер-ударом — обычная, по уровню сложности.
// import { CHARACTERS } from './Characters.js'
// import { spendFromWallet } from './Economy.js'
//
// const OWNED_POWERS_KEY = 'owned_powers_v1'
// export const SUPER_CD = 5
//
// const FLAVOR = {
//   human:  ['🌊', 'Ударная волна'],
//   maga:   ['😡', 'Ярость MAGA'],
//   warrior:['🛡️', 'Клич воина'],
//   ninja:  ['🌀', 'Вихрь тени'],
//   monkey: ['🍌', 'Бешенство'],
//   robot:  ['⚡', 'Перегрузка'],
//   dino:   ['🦖', 'Топот'],
//   giant:  ['⛰️', 'Сейсмика'],
//   kong:   ['🍌', 'Гнев Kong'],
//   boss:   ['🔥', 'Инферно'],
//   king:   ['👑', 'Воля короля']
// }
//
// function priceFor(c) {
//   if (c.id === 'human') return 1000
//   if (c.id === 'maga') return 1500
//   return Math.max(500, Math.round(c.price * 0.3 / 100) * 100)
// }
//
// export const SUPERPOWERS = CHARACTERS.map(c => {
//   const [icon, name] = FLAVOR[c.id] || ['✨', 'Супер-удар']
//   return {
//     id: 'sp-' + c.id,
//     charId: c.id,
//     charName: c.name,
//     icon,
//     name,
//     price: priceFor(c),
//     // Полное описание для карточки: что делает, радиус, как жать, кулдаун
//     desc: 'Голубая волна: −2 щита ВСЕМ ботам в радиусе ' +
//       (c.attackRange + 4).toFixed(1) + ' м (дальность ' + c.attackRange.toFixed(1) +
//       ' м + 4 м). Без щитов — вылет с крыши. Работает, только когда играешь ' +
//       'этим персонажем. Жми G на ПК или ⚡ на телефоне. Перезарядка 5 сек.'
//   }
// })
//
// export function getPowerFor(charId) {
//   return SUPERPOWERS.find(p => p.charId === charId) || null
// }
//
// export function getOwnedPowerIds() {
//   try {
//     const raw = localStorage.getItem(OWNED_POWERS_KEY)
//     if (!raw) return []
//     const arr = JSON.parse(raw)
//     return Array.isArray(arr) ? arr.filter(id => SUPERPOWERS.some(p => p.id === id)) : []
//   } catch (e) {
//     return []
//   }
// }
//
// export function isPowerOwned(powerId) {
//   return getOwnedPowerIds().includes(powerId)
// }
//
// // Покупка силы: { ok, reason }: 'ok' | 'owned' | 'insufficient' | 'unknown'
// export function buyPower(powerId) {
//   const p = SUPERPOWERS.find(x => x.id === powerId)
//   if (!p) return { ok: false, reason: 'unknown' }
//   if (isPowerOwned(powerId)) return { ok: true, reason: 'owned' }
//   const res = spendFromWallet(p.price)
//   if (!res.ok) return res
//   try {
//     const owned = getOwnedPowerIds()
//     owned.push(powerId)
//     localStorage.setItem(OWNED_POWERS_KEY, JSON.stringify(owned))
//   } catch (e) { /* ignore */ }
//   return { ok: true, reason: 'ok' }
// }
