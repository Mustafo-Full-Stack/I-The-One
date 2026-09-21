import { GameManager } from './js/GameManager.js'
import { MenuManager } from './js/MenuManager.js'
import { CharactersManager } from './js/CharactersManager.js'
import { ProfileManager } from './js/ProfileManager.js'
import { getSelectedCharacterId, getCharacterById, formatBalance } from './js/data/Characters.js'
import { getWallet, ensureValidSelection, redeemPromo } from './js/data/Economy.js'
import { WEAPONS, isWeaponOwned, buyWeapon, equipWeapon, unequipWeapon, getEquippedWeaponId, buyAmmo, getAmmo, AMMO_DEFS } from './js/data/Weapons.js'
import { DIFFICULTIES, getDifficulty } from './js/data/Difficulty.js'
import { ARENAS, getArena } from './js/data/Arenas.js'
import { loadProfile, saveProfile, resizeAvatar } from './js/data/Profile.js'
import { settings } from './js/Settings.js'
// import { SUPERPOWERS, getOwnedPowerIds, isPowerOwned, buyPower } from './js/data/Superpowers.js' // СКРЫТО: супер-силы пока не нужны

// Инициализация приложения
const menuManager = new MenuManager()
const gameManager = new GameManager()
const charactersManager = new CharactersManager(menuManager)
const profileManager = new ProfileManager(menuManager)

// Режим: 'menu' | 'game' | 'test' — куда возвращаться по «← В меню»
let gameMode = 'menu'
let victorySeq = 0

function startGame(characterId, testMode, opts = {}) {
  gameMode = testMode ? 'test' : 'game'
  if (testMode) {
    charactersManager.hideForTest()
    menuManager.hideMenu()
  } else {
    menuManager.hideMenu()
  }
  document.getElementById('mode-screen').classList.remove('active')
  document.getElementById('diff-screen').classList.remove('active')
  document.getElementById('arena-screen').classList.remove('active')
  gameManager.init(characterId, { testMode, bots: !!opts.bots, difficulty: opts.difficulty, arena: opts.arena })
  const backBtn = document.getElementById('btn-back-menu')
  // Не трогаем внутренности кнопки (там может быть svg-иконка) — меняем только подпись
  if (backBtn) {
    const lbl = backBtn.querySelector('span') || backBtn
    lbl.textContent = testMode ? '← К персонажам' : '← В меню'
  }
  // Тест не выдаёт награды: прячем кнопку победы
  const victoryBtn = document.getElementById('btn-victory')
  if (victoryBtn) victoryBtn.style.display = testMode ? 'none' : ''
}

// Тест персонажа из карточки: реальный GameManager, тот же Overview-камера,
// без изменения selectedCharacter и баланса.
charactersManager.setOnTest((id) => {
  startGame(id, true)
})

// Баланс выбранного персонажа на экране режима (по умолчанию Человек — $1,000)
function refreshModeBalance() {
  const el = document.getElementById('mode-balance')
  if (!el) return
  const id = getSelectedCharacterId()
  const info = getCharacterById(id)
  el.textContent = ''
  const name = document.createElement('span')
  name.textContent = '\u2605 ' + info.name + '  '
  const money = document.createElement('span')
  money.className = 'mode-money'
  money.textContent = '\uD83D\uDCB0 ' + formatBalance(getWallet())
  el.append(name, money)
}

// Кнопка "Старт" — экран выбора режима: с ботами / онлайн
document.getElementById('btn-start').addEventListener('click', (e) => {
  e.currentTarget.blur()
  menuManager.hideMenu()
  refreshModeBalance()
  document.getElementById('mode-screen').classList.add('active')
})

document.getElementById('btn-mode-back').addEventListener('click', (e) => {
  e.currentTarget.blur()
  document.getElementById('mode-screen').classList.remove('active')
  menuManager.showMenu()
})

// Локальная игра с ботами: сначала выбор сложности (награда за килл своя)
document.getElementById('btn-mode-bots').addEventListener('click', (e) => {
  e.currentTarget.blur()
  document.getElementById('mode-screen').classList.remove('active')
  document.getElementById('diff-screen').classList.add('active')
})
document.getElementById('btn-diff-back').addEventListener('click', (e) => {
  e.currentTarget.blur()
  document.getElementById('diff-screen').classList.remove('active')
  document.getElementById('mode-screen').classList.add('active')
})

// Запомненные сложность и карта — для кнопки «Ещё раз» на экранах конца игры
let lastDifficulty = getDifficulty('medium')
let lastArena = getArena('roof60')

document.getElementById('diff-body').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-diff]')
  if (!btn) return
  btn.blur()
  lastDifficulty = getDifficulty(btn.dataset.diff)
  document.getElementById('diff-screen').classList.remove('active')
  document.getElementById('arena-screen').classList.add('active')
})
document.getElementById('btn-arena-back').addEventListener('click', (e) => {
  e.currentTarget.blur()
  document.getElementById('arena-screen').classList.remove('active')
  document.getElementById('diff-screen').classList.add('active')
})
document.getElementById('arena-body').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-arena]')
  if (!btn) return
  btn.blur()
  lastArena = getArena(btn.dataset.arena)
  const id = ensureValidSelection(getSelectedCharacterId())
  document.getElementById('arena-screen').classList.remove('active')
  // Лоадинг СНАЧАЛА, тяжёлый старт — ПОД ним: даём оверлею отрисоваться
  // (2 кадра), потом строим арену и ботов — лага не видно
  const loading = showLoading('Загрузка арены…', 5000)
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
  startGame(id, false, { bots: true, difficulty: lastDifficulty, arena: lastArena })
  await loading
})

// Онлайн: сервера пока нет — честный экран-заглушка
document.getElementById('btn-mode-online').addEventListener('click', (e) => {
  e.currentTarget.blur()
  document.getElementById('mode-screen').classList.remove('active')
  document.getElementById('online-screen').classList.add('active')
})
document.getElementById('btn-online-back').addEventListener('click', (e) => {
  e.currentTarget.blur()
  document.getElementById('online-screen').classList.remove('active')
  document.getElementById('mode-screen').classList.add('active')
})

document.getElementById('btn-back-menu').addEventListener('click', (e) => {
  e.currentTarget.blur()
  gameManager.dispose()
  if (gameMode === 'test') {
    gameMode = 'menu'
    charactersManager.returnFromTest()
  } else {
    gameMode = 'menu'
    menuManager.showMenu()
  }
})

// Экран победы: ещё раз — та же сложность, в меню — выход
document.getElementById('btn-win-retry').addEventListener('click', (e) => {
  e.currentTarget.blur()
  startGame(gameManager.getCurrentCharacterId(), false, { bots: true, difficulty: lastDifficulty, arena: lastArena })
})
document.getElementById('btn-win-menu').addEventListener('click', (e) => {
  e.currentTarget.blur()
  gameManager.dispose()
  gameMode = 'menu'
  menuManager.showMenu()
})
// Экран смерти: ещё раз — та же сложность, в меню — выход
document.getElementById('btn-lose-retry').addEventListener('click', (e) => {
  e.currentTarget.blur()
  startGame(gameManager.getCurrentCharacterId(), false, { bots: true, difficulty: lastDifficulty, arena: lastArena })
})
document.getElementById('btn-lose-menu').addEventListener('click', (e) => {
  e.currentTarget.blur()
  gameManager.dispose()
  gameMode = 'menu'
  menuManager.showMenu()
})
// Единственный слушатель ручной победы: один клик — одна награда +$250.
document.getElementById('btn-victory').addEventListener('click', (e) => {
  e.currentTarget.blur()
  victorySeq += 1
  const token = 'manual-' + Date.now() + '-' + victorySeq
  gameManager.onVictory(token)
})

// --- Панель настроек ---
const settingsPanel = document.getElementById('settings-panel')
const fpsSlider = document.getElementById('fps-slider')
const fpsValue = document.getElementById('fps-value')
const qualityButtons = document.getElementById('quality-buttons')
const autoRotateToggle = document.getElementById('autorotate-toggle')
const controlsButtons = document.getElementById('controls-buttons')

let selectedQuality = settings.graphics
let selectedAutoRotate = settings.autoRotate
let selectedControls = settings.controls
// Если настройки открыли из игры — после закрытия возвращаемся в игру, а не в меню
let settingsFromGame = false

// Джойстик или крестовина: переключаем видимость прямо в тач-панели
function applyControlsVisibility() {
  const controls = document.getElementById('touch-controls')
  if (!controls) return
  controls.classList.toggle('show-dpad', settings.controls === 'buttons')
}

function openSettings(fromGame) {
  settingsFromGame = !!fromGame
  selectedQuality = settings.graphics
  selectedAutoRotate = settings.autoRotate
  selectedControls = settings.controls
  fpsSlider.value = settings.fps
  fpsValue.textContent = settings.fps
  if (autoRotateToggle) autoRotateToggle.checked = selectedAutoRotate
  updateQualitySelection()
  updateControlsSelection()
  // Прячем меню только если шли из меню; в игре меню и так скрыто
  if (!fromGame) menuManager.hideMenu()
  settingsPanel.classList.add('active')
}

// Открытие панели из главного меню
document.getElementById('btn-settings').addEventListener('click', (e) => {
  e.currentTarget.blur()
  openSettings(false)
})
// Открытие панели из игры (шестерёнка) — игра не уничтожается, настройки применяются на лету
document.getElementById('btn-game-settings').addEventListener('click', (e) => {
  e.currentTarget.blur()
  openSettings(true)
})

function closeSettings() {
  settingsPanel.classList.remove('active')
  if (!settingsFromGame) menuManager.showMenu()
  settingsFromGame = false
}

function updateQualitySelection() {
  qualityButtons.querySelectorAll('.quality-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.quality === selectedQuality)
  })
}

function updateControlsSelection() {
  if (!controlsButtons) return
  controlsButtons.querySelectorAll('.quality-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.controls === selectedControls)
  })
}

// Живое значение FPS
fpsSlider.addEventListener('input', () => {
  fpsValue.textContent = fpsSlider.value
})

// Выбор качества
qualityButtons.addEventListener('click', (e) => {
  const btn = e.target.closest('.quality-btn')
  if (!btn) return
  btn.blur()
  selectedQuality = btn.dataset.quality
  updateQualitySelection()
})

// Переключатель автовращения
if (autoRotateToggle) {
  autoRotateToggle.addEventListener('change', () => {
    selectedAutoRotate = autoRotateToggle.checked
  })
}

// Выбор управления
if (controlsButtons) {
  controlsButtons.addEventListener('click', (e) => {
    const btn = e.target.closest('.quality-btn')
    if (!btn) return
    btn.blur()
    selectedControls = btn.dataset.controls
    updateControlsSelection()
  })
}

// Применить
document.getElementById('settings-apply').addEventListener('click', (e) => {
  e.currentTarget.blur()
  settings.fps = Number(fpsSlider.value)
  settings.graphics = selectedQuality
  settings.autoRotate = selectedAutoRotate
  settings.controls = selectedControls
  settings.save()
  applyControlsVisibility()
  // Применяем к запущенной игре (если игра идёт) — камера переставится мгновенно
  gameManager.applySettings()
  closeSettings()
})

// Управление при старте — сразу как в настройках
applyControlsVisibility()

// Закрыть
document.getElementById('settings-close').addEventListener('click', (e) => {
  e.currentTarget.blur()
  closeSettings()
})

// Открытие экрана персонажей
document.getElementById('btn-characters').addEventListener('click', (e) => {
  e.currentTarget.blur()
  charactersManager.open()
})

// Тост-подтверждение на экране оружия (видно, что нажатие сработало)
let _weaponsToastTimer = null
function weaponsToast(text) {
  const el = document.getElementById('weapons-toast')
  if (!el) return
  el.textContent = text
  el.classList.remove('hidden')
  if (_weaponsToastTimer) clearTimeout(_weaponsToastTimer)
  _weaponsToastTimer = setTimeout(() => el.classList.add('hidden'), 2200)
}

// Экран оружия: карточки как у персонажей (иконка, владелец, дальность, цена)
function renderWeapons() {
  const grid = document.getElementById('weapons-grid')
  const pill = document.getElementById('weapons-wallet')
  if (pill) pill.textContent = '\uD83D\uDCB0 ' + formatBalance(getWallet())
  if (!grid) return
  grid.textContent = ''
  WEAPONS.forEach(w => {
    const owner = getCharacterById(w.ownerId)
    const owned = isWeaponOwned(w.id)
    const card = document.createElement('article')
    card.className = 'weapon-card' + (owned ? ' owned' : '')
    const icon = document.createElement('div')
    icon.className = 'weapon-icon'
    icon.textContent = w.icon
    const name = document.createElement('div')
    name.className = 'weapon-name'
    name.textContent = w.name
    const forLine = document.createElement('div')
    forLine.className = 'weapon-for'
    forLine.textContent = 'Для: ' + (owner ? owner.name : '—')
    const range = document.createElement('div')
    range.className = 'weapon-range'
    range.textContent = '⚔ Дальность ' + w.range.toFixed(1) + ' м'
    const desc = document.createElement('div')
    desc.className = 'weapon-desc'
    desc.textContent = w.desc
    card.append(icon, name, forLine, range, desc)
    const equippedId = getEquippedWeaponId()
    if (owned && equippedId === w.id) {
      const badge = document.createElement('div')
      badge.className = 'weapon-owned'
      badge.textContent = '✅ НАДЕТО'
      const off = document.createElement('button')
      off.className = 'weapon-wear'
      off.type = 'button'
      off.textContent = 'СНЯТЬ'
      off.addEventListener('click', (e) => {
        e.currentTarget.blur()
        unequipWeapon()
        weaponsToast('🥋 Оружие снято — бой врукопашную')
        renderWeapons()
      })
      card.append(badge, off)
    } else if (owned) {
      const badge = document.createElement('div')
      badge.className = 'weapon-owned'
      badge.textContent = w.price === 0 ? '✅ БЕСПЛАТНО · ВАШЕ' : '✅ ВАШЕ'
      const wear = document.createElement('button')
      wear.className = 'weapon-wear'
      wear.type = 'button'
      wear.textContent = 'НАДЕТЬ'
      wear.addEventListener('click', (e) => {
        e.currentTarget.blur()
        const ok = equipWeapon(w.id)
        weaponsToast(ok ? '✅ ' + w.name + ' надет!' : '⚠️ Сначала купите это оружие.')
        renderWeapons()
      })
      card.append(badge, wear)
      // Патроны для всех стрелковых
      const def = AMMO_DEFS[w.id]
      if (def) {
        const a = getAmmo(w.id)
        const ammoLine = document.createElement('div')
        ammoLine.className = 'weapon-ammo'
        ammoLine.textContent = w.icon + ' Патроны: ' + a.mag + '/' + a.reserve
        const ammoBtn = document.createElement('button')
        ammoBtn.className = 'weapon-wear'
        ammoBtn.type = 'button'
        ammoBtn.textContent = '+' + def.pack + ' патронов · ' + formatBalance(def.price)
        ammoBtn.addEventListener('click', (ev) => {
          ev.currentTarget.blur()
          const res = buyAmmo(w.id)
          weaponsToast(res.ok
            ? '✅ +' + def.pack + ' патронов!'
            : '💰 НЕДОСТАТОЧНО ДЕНЕГ — нужно ' + formatBalance(def.price) + '.')
          renderWeapons()
        })
        card.append(ammoLine, ammoBtn)
      }
    } else {
      const buy = document.createElement('button')
      buy.className = 'weapon-buy'
      buy.type = 'button'
      buy.textContent = 'КУПИТЬ · ' + formatBalance(w.price)
      buy.addEventListener('click', (e) => {
        e.currentTarget.blur()
        const res = buyWeapon(w.id)
        if (res.ok) {
          weaponsToast('✅ ' + w.name + ' куплен! Теперь нажмите НАДЕТЬ.')
          renderWeapons()
          return
        }
        menuManager.showModal(
          '\uD83D\uDCB0 НЕДОСТАТОЧНО ДЕНЕГ — нужно ' + formatBalance(w.price) +
          ', у вас ' + formatBalance(getWallet()) + '.'
        )
      })
      card.append(buy)
    }
    grid.appendChild(card)
  })
  // Заглушка будущих пушек
  const more = document.createElement('div')
  more.className = 'weapon-card locked'
  const li = document.createElement('div')
  li.className = 'weapon-icon'
  li.textContent = '🔒'
  const lt = document.createElement('div')
  lt.className = 'weapon-name'
  lt.textContent = 'ДРУГИЕ ОРУЖИЯ В РАЗРАБОТКЕ!'
  const ld = document.createElement('div')
  ld.className = 'weapon-desc'
  ld.textContent = 'Новые пушки придумаем позже.'
  more.append(li, lt, ld)
  grid.appendChild(more)
}

// Экран оружия
document.getElementById('btn-weapons').addEventListener('click', (e) => {
  e.currentTarget.blur()
  menuManager.hideMenu()
  renderWeapons()
  document.getElementById('weapons-screen').classList.add('active')
})
document.getElementById('btn-weapons-back').addEventListener('click', (e) => {
  e.currentTarget.blur()
  document.getElementById('weapons-screen').classList.remove('active')
  menuManager.showMenu()
})

// Экран профиля
document.getElementById('btn-profile').addEventListener('click', (e) => {
  e.currentTarget.blur()
  profileManager.open()
})

// // --- СКРЫТО: Каталог Супер-силы (пока НЕ НУЖЕН, не удалено) ---
// function renderPowers() {
//   const grid = document.getElementById('superpowers-grid')
//   const pill = document.getElementById('superpowers-wallet')
//   if (pill) pill.textContent = '\uD83D\uDCB0 ' + formatBalance(getWallet())
//   if (!grid) return
//   grid.textContent = ''
//   SUPERPOWERS.forEach(p => {
//     const owned = isPowerOwned(p.id)
//     const card = document.createElement('article')
//     card.className = 'weapon-card' + (owned ? ' owned' : '')
//     const icon = document.createElement('div')
//     icon.className = 'weapon-icon'
//     icon.textContent = p.icon
//     const name = document.createElement('div')
//     name.className = 'weapon-name'
//     name.textContent = p.name + ' · ' + p.charName
//     const desc = document.createElement('div')
//     desc.className = 'weapon-desc'
//     desc.textContent = p.desc
//     card.append(icon, name, desc)
//     if (owned) {
//       const badge = document.createElement('div')
//       badge.className = 'weapon-owned'
//       badge.textContent = '✅ ВАША СИЛА'
//       card.append(badge)
//     } else {
//       const buy = document.createElement('button')
//       buy.className = 'weapon-buy'
//       buy.type = 'button'
//       buy.textContent = 'КУПИТЬ · ' + formatBalance(p.price)
//       buy.addEventListener('click', (e) => {
//         e.currentTarget.blur()
//         const res = buyPower(p.id)
//         if (res.ok) {
//           weaponsToast('✅ ' + p.icon + ' ' + p.name + ' куплена!')
//           renderPowers()
//           return
//         }
//         menuManager.showModal(
//           '\uD83D\uDCB0 НЕДОСТАТОЧНО ДЕНЕГ — нужно ' + formatBalance(p.price) +
//           ', у вас ' + formatBalance(getWallet()) + '.'
//         )
//       })
//       card.append(buy)
//     }
//     grid.appendChild(card)
//   })
// }
// const spBtn = document.getElementById('btn-superpowers')
// if (spBtn) spBtn.addEventListener('click', (e) => {
//   e.currentTarget.blur()
//   menuManager.hideMenu()
//   renderPowers()
//   document.getElementById('superpowers-screen').classList.add('active')
// })
// const spBack = document.getElementById('btn-superpowers-back')
// if (spBack) spBack.addEventListener('click', (e) => {
//   e.currentTarget.blur()
//   document.getElementById('superpowers-screen').classList.remove('active')
//   menuManager.showMenu()
// })



// --- PWA: установка игры "I the one : MAGA" ---
// ?nosw в адресе — снести Service Worker и кэш (лечит «старую версию»)
try {
  if (window.location.search.indexOf('nosw') !== -1 && 'serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(r => { try { r.unregister() } catch (e) {} })
    }).catch(() => {})
    if (window.caches) {
      caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {})
    }
  }
} catch (e) { /* ignore */ }
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    try {
      navigator.serviceWorker.register('sw.js').then((reg) => {
        // Сразу проверяем новую версию, чтобы не сидеть на старом кэше
        try { reg.update().catch(() => {}) } catch (e) { /* ignore */ }
      }).catch(() => {})
      // Новая версия SW взяла управление — один раз перезагружаемся на свежее
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        try {
          if (!sessionStorage.getItem('sw-reloaded')) {
            sessionStorage.setItem('sw-reloaded', '1')
            window.location.reload()
          }
        } catch (e) { /* ignore */ }
      })
    } catch (e) { /* ignore */ }
  })
}

let _deferredInstall = null
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  _deferredInstall = e
})

// --- Установка игры: отдельный раздел под каждое устройство ---
const INSTALL_STEPS = {
  android: ['Android · Chrome', 'Открой игру в Chrome → нажми ⋮ (три точки) → «Установить приложение» (или «Добавить на главный экран»). Иконка «I the one : MAGA» появится рядом с приложениями.'],
  ios: ['iPhone · Safari', 'Открой игру в Safari → кнопка «Поделиться» → «На экран Домой» → «Добавить». Системной установки Apple не даёт — это официальный способ.'],
  windows: ['Windows · Edge / Chrome', 'Edge: … → «Приложения» → «Установить этот сайт как приложение». Chrome: ⋮ → «Сохранить и поделиться» → «Установить страницу как приложение» (или «Дополнительные инструменты» → «Создать ярлык» с галочкой «Открывать в окне»).'],
  linux: ['Linux · Firefox', 'Firefox не ставит сайты как приложения: 1) Ctrl+D — закладка, 2) перетащи её из панели на рабочий стол — будет ярлык «I the one : MAGA». Либо ☰ → «Сохранить страницу». Игра полностью работает в браузере!']
}

document.getElementById('btn-install').addEventListener('click', (e) => {
  e.currentTarget.blur()
  menuManager.hideMenu()
  const autoCard = document.getElementById('install-auto-card')
  if (autoCard) autoCard.style.display = _deferredInstall ? '' : 'none'
  document.getElementById('install-screen').classList.add('active')
})
document.getElementById('btn-install-back').addEventListener('click', (e) => {
  e.currentTarget.blur()
  document.getElementById('install-screen').classList.remove('active')
  menuManager.showMenu()
})
document.getElementById('btn-install-auto').addEventListener('click', async (e) => {
  e.currentTarget.blur()
  if (!_deferredInstall) return
  try {
    _deferredInstall.prompt()
    await _deferredInstall.userChoice
  } catch (err) { /* ignore */ }
  _deferredInstall = null
  document.getElementById('install-auto-card').style.display = 'none'
})
document.getElementById('install-grid').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-install]')
  if (!btn) return
  btn.blur()
  const [title, text] = INSTALL_STEPS[btn.dataset.install] || ['?', '?']
  // Инструкция — всплывающей карточкой, а не текстом внизу
  document.getElementById('install-card-icon').textContent =
    { android: '🤖', ios: '🍏', windows: '🪟', linux: '🐧' }[btn.dataset.install] || '📲'
  document.getElementById('install-card-title').textContent = title
  document.getElementById('install-card-text').textContent = text
  document.getElementById('install-card').classList.remove('hidden')
})
document.getElementById('btn-install-card-ok').addEventListener('click', (e) => {
  e.currentTarget.blur()
  document.getElementById('install-card').classList.add('hidden')
})

// --- Лоадинг на весь экран: первый вход + старт с ботами (5 сек) ---
function showLoading(text, ms) {
  return new Promise((resolve) => {
    const screen = document.getElementById('loading-screen')
    const label = document.getElementById('loading-text')
    const fill = document.getElementById('loading-fill')
    if (label) label.textContent = text || 'Загрузка…'
    if (screen) screen.classList.add('active')
    if (fill) {
      fill.style.transition = 'none'
      fill.style.width = '0%'
      // Перезапуск анимации полосы
      void fill.offsetWidth
      fill.style.transition = 'width ' + ms + 'ms linear'
      fill.style.width = '100%'
    }
    setTimeout(() => {
      if (screen) screen.classList.remove('active')
      resolve()
    }, ms)
  })
}

// Предзагрузка ВСЕГО пакета заранее, чтобы потом не лагало:
// картинки, иконки, манифест + готовность шрифтов движка.
// Вызывается параллельно с лоадингом — тяжёлое грузится, пока видна полоса.
function preloadAssets() {
  const jobs = [
    '/loading.jpg',
    '/sigma.jpg',
    '/icon-192.png',
    '/icon-512.png',
    '/manifest.webmanifest'
  ].map(src => new Promise(res => {
    // Картинки — через Image, остальное — через fetch, ошибки игнорируем
    if (/\.(png|jpe?g|webp|gif)$/i.test(src)) {
      const im = new Image()
      im.onload = () => res()
      im.onerror = () => res()
      im.src = src
      // Страховка: битый кэш не должен висеть вечно
      setTimeout(res, 8000)
    } else {
      fetch(src).then(() => res()).catch(() => res())
      setTimeout(res, 8000)
    }
  }))
  try {
    if (document.fonts && document.fonts.ready) {
      jobs.push(document.fonts.ready.catch(() => {}))
    }
  } catch (e) { /* ignore */ }
  return Promise.allSettled(jobs)
}

// Промокод: одно использование, хеш-сравнение, антиподбор
document.getElementById('btn-promo-apply').addEventListener('click', async (e) => {
  e.currentTarget.blur()
  const input = document.getElementById('promo-input')
  const note = document.getElementById('promo-note')
  const say = (text, cls) => {
    if (note) {
      note.textContent = text
      note.className = 'promo-note' + (cls ? ' ' + cls : '')
    }
  }
  const res = await redeemPromo(input.value)
  if (res.ok) {
    input.value = ''
    say('✅ Промокод принят! +$' + res.amount.toLocaleString('en-US') + ' в кошельке.', 'ok')
    refreshModeBalance()
    return
  }
  say({
    empty: 'Вставь код сначала.',
    locked: '⛔ Слишком много попыток — подожди минуту.',
    used: 'Этот промокод уже был активирован.',
    invalid: '💰 Неверный промокод.',
    nossl: 'Нужен HTTPS или localhost для проверки кода.'
  }[res.reason] || 'Неверный промокод.', 'err')
})

// Кнопка "Выйти" — пока недоступна (без дублей обработчиков)
document.getElementById('btn-exit').addEventListener('click', (e) => {
  e.currentTarget.blur()
  menuManager.hideMenu()
  document.getElementById('exit-screen').classList.add('active')
})
document.getElementById('btn-exit-back').addEventListener('click', (e) => {
  e.currentTarget.blur()
  document.getElementById('exit-screen').classList.remove('active')
  menuManager.showMenu()
})
document.getElementById('btn-exit-close').addEventListener('click', (e) => {
  e.currentTarget.blur()
  // Вкладку разрешают закрывать только скриптом открытой вкладке —
  // пробуем, иначе подсказываем Ctrl+W
  window.close()
  setTimeout(() => {
    menuManager.showModal('Вкладку закрыть нельзя автоматически — нажми Ctrl+W (или ✕ браузера). Прогресс сохранён!')
    document.getElementById('exit-screen').classList.remove('active')
    menuManager.showMenu()
  }, 400)
})

// --- Welcome: обязательная регистрация при первом запуске ---
let _welcomeAvatar = null
const welcomeScreen = document.getElementById('welcome-screen')
const welcomeName = document.getElementById('welcome-name')
const welcomeAvatarInput = document.getElementById('welcome-avatar')
const welcomeAvatarImg = document.getElementById('welcome-avatar-img')

function needsWelcome() {
  try {
    return !loadProfile().name
  } catch (e) {
    return true
  }
}

if (welcomeAvatarInput) {
  welcomeAvatarInput.addEventListener('change', async () => {
    const f = welcomeAvatarInput.files && welcomeAvatarInput.files[0]
    if (!f) return
    try {
      _welcomeAvatar = await resizeAvatar(f, 256, 0.82)
      welcomeAvatarImg.src = _welcomeAvatar
      welcomeAvatarImg.classList.remove('hidden')
    } catch (e) {
      welcomeAvatarInput.value = ''
    }
  })
}

document.getElementById('btn-welcome-start').addEventListener('click', async (e) => {
  e.currentTarget.blur()
  const name = welcomeName.value.trim()
  if (!name) {
    welcomeName.focus()
    welcomeName.classList.add('input-error')
    setTimeout(() => welcomeName.classList.remove('input-error'), 1200)
    return
  }
  const prev = loadProfile()
  saveProfile({ ...prev, name, avatar: _welcomeAvatar || prev.avatar || '' })
  welcomeScreen.classList.remove('active')
  menuManager.showMenu()
})

// Сброс всех данных (кошелёк, владения, оружие, патроны, профиль, выбор) + перезапуск
document.getElementById('btn-reset-data').addEventListener('click', (e) => {
  e.currentTarget.blur()
  if (!window.confirm('Точно стереть ВСЁ: деньги, покупки, профиль?')) return
  try {
    ;[
      'player_wallet_v1', 'owned_characters_v1', 'owned_weapons_v1',
      'equipped_weapon_v1', 'pistol_ammo_v1', 'gameProfile_v1',
      'selectedCharacter', 'gameSettings', 'character_balances_v1'
    ].forEach(k => localStorage.removeItem(k))
  } catch (err) { /* ignore */ }
  window.location.reload()
})

// Первый вход: лоадинг на весь экран,
// потом телефоны спрашивают про автоповорот,
// потом welcome (без имени никак) или меню
menuManager.hideMenu()
showLoading('Загрузка…', 1800).then(() => {
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches
  let rotateChoice = null
  try { rotateChoice = localStorage.getItem('rotate_choice_v1') } catch (e) {}
  if (coarse && !rotateChoice) {
    const rs = document.getElementById('rotate-screen')
    if (rs) rs.classList.add('active')
  } else {
    proceedBoot()
  }
})

function proceedBoot() {
  if (needsWelcome()) {
    welcomeScreen.classList.add('active')
  } else {
    menuManager.showMenu()
  }
}

document.getElementById('btn-rotate-on').addEventListener('click', async (e) => {
  e.currentTarget.blur()
  // Просим альбомную: сначала фулскрин (так требует Chrome), потом лок
  try {
    const el = document.documentElement
    if (el.requestFullscreen && !document.fullscreenElement) {
      await el.requestFullscreen().catch(() => {})
    }
    if (screen.orientation && screen.orientation.lock) {
      await screen.orientation.lock('landscape').catch(() => {})
    }
  } catch (err) { /* не вышло — играем как есть */ }
  try { localStorage.setItem('rotate_choice_v1', 'on') } catch (err) {}
  document.getElementById('rotate-screen').classList.remove('active')
  proceedBoot()
})
document.getElementById('btn-rotate-off').addEventListener('click', (e) => {
  e.currentTarget.blur()
  try { localStorage.setItem('rotate_choice_v1', 'off') } catch (err) {}
  try {
    if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock()
  } catch (err) {}
  document.getElementById('rotate-screen').classList.remove('active')
  proceedBoot()
})

// Метка сборки в меню — видно, свежая ли версия (против кэша)
const BUILD = 'v2026-09-20-maga24'
const buildTag = document.getElementById('build-tag')
if (buildTag) buildTag.textContent = BUILD + ' · I the one : MAGA'
const buildTagSettings = document.getElementById('build-tag-settings')
if (buildTagSettings) buildTagSettings.textContent = BUILD
console.log('3D Game initialized', BUILD)
