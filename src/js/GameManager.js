import * as THREE from 'three'
import { Scene } from './game/Scene.js'
import { Camera } from './game/Camera.js'
import { Lighting } from './game/Lighting.js'
import { Player, buildBusMesh } from './game/Player.js'
import { CharacterController } from './game/CharacterController.js'
import { settings } from './Settings.js'
import { getCharacterById, getSelectedCharacterId, formatBalance, CHARACTERS } from './data/Characters.js'
import { getWallet, addCoins, VICTORY_REWARD } from './data/Economy.js'
import { WEAPONS, isWeaponOwned, getEquippedWeapon, getEquippedWeaponId, equipWeapon, unequipWeapon, getAmmo, setAmmo, AMMO_DEFS, FIRE_CD } from './data/Weapons.js'
import { getArena } from './data/Arenas.js'
// import { getPowerFor, isPowerOwned, SUPER_CD } from './data/Superpowers.js' // СКРЫТО: супер-силы пока не нужны
import { loadProfile } from './data/Profile.js'

export class GameManager {
  constructor() {
    this.canvas = document.getElementById('game-canvas')
    this.gameContainer = document.getElementById('game-container')

    this.renderer = null
    this.scene = null
    this.camera = null
    this.lighting = null
    this.player = null
    this.controller = null
    this.clock = null

    this.isInitialized = false
    this.targetFps = 60
    this._fpsAcc = 0
    // Угол сырого ввода в момент заморозки опоры движения (для пере-якоря
    // при резкой смене направления, см. animate).
    this._autoDirAng = null

    // Активный персонаж и режим. Test-mode не трогает баланс/selectedCharacter.
    this.activeCharacterId = null
    this.isTestMode = false
    // Режим игры: 'solo' | 'bots'. Боты — локальные Player с простым AI.
    this.playMode = 'solo'
    this.bots = []
    // Полёты выбитых с крыши + броски ножей
    this.flyers = []
    this.projectiles = []
    this.effects = []
    this.rangeRing = null
    // Сессия: фраги и заработок игрока (экран победы)
    this.sessionKills = 0
    this.sessionEarned = 0
    this._won = false
    // Жизни в «Играть с ботами»: 3 сердечка. Кончились — смерть без респауна.
    this.lives = 2
    this._doomed = false
  }

  getCurrentCharacterId() {
    return this.activeCharacterId || getSelectedCharacterId()
  }

  _initHud(characterId) {
    // Слева: имя + жизни + оружие. Справа вверху (как в GTA): деньги + щиты + урон.
    const hud = document.getElementById('player-hud')
    if (hud) {
      const info = getCharacterById(characterId)
      hud.textContent = ''
      const nameSpan = document.createElement('span')
      nameSpan.className = 'hud-name'
      nameSpan.textContent = '\u2605 ' + info.name
      hud.append(nameSpan)
      // Жизни-«сердечки» (только в игре с ботами)
      const livesSpan = document.createElement('span')
      livesSpan.className = 'hud-lives'
      livesSpan.id = 'hud-lives'
      hud.append(livesSpan)
      this.refreshHudLives()
      // Надетое оружие видно сразу — понятно, чем дерёшься
      const gun = getEquippedWeapon()
      if (gun) {
        const gunSpan = document.createElement('span')
        gunSpan.className = 'hud-gun'
        gunSpan.textContent = gun.icon + ' ' + gun.name
        hud.append(gunSpan)
      }
    }
    const money = document.getElementById('money-hud')
    if (money) {
      money.textContent = ''
      // Верхний кластер как в GTA: деньги + щиты + урон + патроны (патроны отдельно)
      const balanceSpan = document.createElement('span')
      balanceSpan.className = 'hud-balance'
      balanceSpan.id = 'hud-balance'
      balanceSpan.textContent = '\uD83D\uDCB0 ' + formatBalance(getWallet())
      const shieldsSpan = document.createElement('span')
      shieldsSpan.className = 'hud-shields'
      shieldsSpan.id = 'hud-shields'
      const dmgSpan = document.createElement('span')
      dmgSpan.className = 'hud-damage'
      dmgSpan.id = 'hud-damage'
      money.append(balanceSpan, shieldsSpan, dmgSpan)
    }
    this.refreshHudShields()
    this.refreshHudDamage()
    this.refreshHudAmmo()

    if (this.playMode === 'bots' && this.bots.length) {
      const hudEl = document.getElementById('player-hud')
      if (hudEl) {
        const botsSpan = document.createElement('span')
        botsSpan.className = 'hud-bots'
        botsSpan.textContent = '\uD83E\uDD16\u00D7' + this.bots.length
        hudEl.append(botsSpan)
      }
    }
  }

  refreshHudShields() {
    const el = document.getElementById('hud-shields')
    if (el && this.player) {
      el.textContent = this.player.shields > 0
        ? '\uD83D\uDEE1\u00D7' + this.player.shields
        : '\uD83D\uDCA5'
    }
  }

  // Сердечки по уровню: сложно/невозможно — 1 жизнь, легко/средне — 2
  _livesMax() {
    const id = this.diff && this.diff.id
    return (id === 'hard' || id === 'impossible') ? 1 : 2
  }

  refreshHudLives() {
    const el = document.getElementById('hud-lives')
    if (!el) return
    if (this.playMode !== 'bots') {
      el.textContent = ''
      el.classList.add('hidden')
      return
    }
    el.classList.remove('hidden')
    const total = this._livesMax()
    el.textContent = '❤️'.repeat(Math.max(0, Math.min(total, this.lives))) +
      '🖤'.repeat(Math.max(0, total - this.lives))
  }

  // Потеря жизни: сердечек меньше; 0 — смерть (this._doomed), респауна не будет
  _loseLife() {
    if (this.playMode !== 'bots') return
    this.lives = Math.max(0, this.lives - 1)
    this.refreshHudLives()
    if (this.lives <= 0) this._doomed = true
  }

  refreshHudBalance() {
    const el = document.getElementById('hud-balance')
    if (el && this.activeCharacterId) {
      el.textContent = '\uD83D\uDCB0 ' + formatBalance(getWallet())
    }
  }

  // Единственная точка начисления награды.
  // Сумма = награда уровня сложности (100/250/500/1500), в тест-режиме — no-op.
  // Повторный вызов с тем же токеном игнорируется.
  onVictory(victoryToken = null) {
    if (!this.isInitialized || this.isTestMode || !this.activeCharacterId) return null
    const next = addCoins(this.killReward || VICTORY_REWARD, victoryToken)
    // addCoins сам защищён от дубля по токену; null — дубль, HUD не трогаем.
    if (next === null) return null
    this.refreshHudBalance()
    return next
  }

  init(characterIdOverride = null, opts = {}) {
    // Перезапуск с другим персонажем (СТАРТ / ТЕСТИРОВАТЬ): чистим прошлое.
    if (this.isInitialized) this.dispose()

    // Отображаем игровой контейнер
    this.gameContainer.classList.remove('hidden')

    this.isTestMode = !!opts.testMode
    this.activeCharacterId = characterIdOverride || getSelectedCharacterId()
    // Валидация id
    this.activeCharacterId = getCharacterById(this.activeCharacterId).id
    // Боты только в обычной игре (не в тест-режиме персонажа).
    // Сложность задаёт пул ботов, награду за килл, скорость и каденс.
    this.playMode = (opts.bots && !this.isTestMode) ? 'bots' : 'solo'
    this.diff = (this.playMode === 'bots' && opts.difficulty) ? opts.difficulty : null
    this.killReward = (this.playMode === 'bots' && this.diff) ? this.diff.reward : VICTORY_REWARD

    // Применяем настройки графики при создании рендера
    const preset = settings.preset
    this.targetFps = settings.fps

    // Инициализируем Three.js renderer (дискретное GPU, если есть — плавнее)
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: preset.antialias,
      alpha: true,
      powerPreference: 'high-performance'
    })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.pixelRatio))
    this.renderer.shadowMap.enabled = preset.shadows
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    // Киношный свет: дешёвое ACES-тонирование кадра
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.1

    // Инициализируем сцену и компоненты
    this.arena = opts.arena && opts.arena.size ? opts.arena : getArena('roof60')
    this.arenaHalf = this.arena.size / 2
    this.world = new Scene(this.arena.size, this.arena.style)
    this.scene = this.world.getScene()
    this.camera = new Camera()
    this.scene.add(this.camera.getCamera())
    this.lighting = new Lighting(this.scene)
    this.lighting.applyPreset(preset)
    // Выбранный/тестовый персонаж; баланс — из Economy (единый источник)
    this.player = new Player(this.scene, this.activeCharacterId)
    if (this.playMode === 'bots') this._spawnBots(this.diff)
    this._createRangeRing()
    this._initHud(this.activeCharacterId)
    // Сессия с нуля + чистый киллфид
    this.sessionKills = 0
    this.sessionEarned = 0
    this._won = false
    this.lives = this._livesMax()
    this._doomed = false
    const feed = document.getElementById('killfeed')
    if (feed) feed.textContent = ''
    // Стартовое табло уровня: кто вышел против тебя (и с чем)
    if (this.playMode === 'bots' && this.bots.length) {
      const foes = this.bots.map(b => {
        const w = WEAPONS.find(x => x.id === b.gunId)
        return b.player.characterInfo.name + '🛡×' + (b.player.characterInfo.shields || 0) +
          (w ? w.icon : '')
      }).join(', ')
      const dName = this.diff ? this.diff.name : ''
      const dIcon = this.diff ? (this.diff.icon || '⚔️') : '⚔️'
      this._feed(dIcon + ' ' + dName + ' · враги: ' + foes + ' · +$' +
        (this.killReward || VICTORY_REWARD).toLocaleString('en-US') + '/килл')
    }
    const win = document.getElementById('win-screen')
    if (win) win.classList.remove('active')
    const lose0 = document.getElementById('lose-screen')
    if (lose0) lose0.classList.remove('active')
    this.controller = new CharacterController(this.player.group)
    this.controller.arenaLimit = this.arenaHalf + 1
    this.controller.setCameraYaw(this.camera.getControlYaw())
    this.controller.setCameraRelative(true)
    // Орбит-камера: вращение мышью (ПК) и пальцем (телефон)
    this.camera.attachOrbit(this.canvas)
    this.clock = new THREE.Clock()

    // Получаем камеру
    const camera = this.camera.getCamera()

    // Обработка изменения размера окна
    this.handleResize = () => this.onWindowResize(camera)
    window.addEventListener('resize', this.handleResize)

    // Удар: F на любом языке (e.code — физическая клавиша, русская «А» тоже работает).
    // R — перезарядка. Игнорируем, когда фокус в поле ввода.
    // (G — супер-удар СКРЫТ: см. useSuper ниже.)
    this._attackCd = 0
    this._reloading = 0
    // this._superCd = 0 // СКРЫТО: супер-силы пока не нужны
    this._shake = 0
    this._onAttackKey = (e) => {
      const tag = e.target && e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      // R — смена оружия прямо в бою (перезарядка теперь только авто)
      if (e.code === 'KeyR' && !e.repeat) {
        this.cycleWeapon()
        return
      }
      // if (e.code === 'KeyG' && !e.repeat) { // СКРЫТО: супер-силы пока не нужны
      //   this.useSuper()
      //   return
      // }
      if (e.code !== 'KeyF' || e.repeat) return
      this.attack()
      if (document.activeElement && document.activeElement.blur) {
        try { document.activeElement.blur() } catch (err) { /* ignore */ }
      }
    }
    window.addEventListener('keydown', this._onAttackKey)

    // Кнопка УДАР на телефоне (рядом с прыжком)
    this._attackDomHandlers = []
    const attackBtn = document.getElementById('touch-attack')
    if (attackBtn) {
      const press = (e) => { e.preventDefault(); this.attack() }
      attackBtn.addEventListener('pointerdown', press)
      this._attackDomHandlers.push({ el: attackBtn, type: 'pointerdown', h: press })
    }
    // Кнопка смены оружия на телефоне
    const swapBtn = document.getElementById('touch-swap')
    if (swapBtn) {
      const pressW = (e) => { e.preventDefault(); this.cycleWeapon() }
      swapBtn.addEventListener('pointerdown', pressW)
      this._attackDomHandlers.push({ el: swapBtn, type: 'pointerdown', h: pressW })
    }

    // Прогрев шейдеров до первого кадра — иначе компиляция дёргает старт
    try {
      this.renderer.compile(this.scene, camera)
    } catch (e) { /* ignore */ }

    // Запускаем игровой цикл
    this.animate(camera)

    this.isInitialized = true
  }

  animate(camera) {
    this.animationId = requestAnimationFrame(() => this.animate(camera))

    const dt = this.clock.getDelta()

    // Ограничение FPS: накапливаем время и рендерим только по достижении интервала
    this._fpsAcc += dt
    const interval = 1 / this.targetFps
    if (this._fpsAcc < interval) return
    // Защита от больших скачков (фоновая вкладка) — не больше 50 мс за кадр
    const frameDt = Math.min(this._fpsAcc, 0.05)
    this._fpsAcc = 0

    // Кулдаун удара + таймер перезарядки
    if (this._attackCd > 0) this._attackCd = Math.max(0, this._attackCd - frameDt)
    if (this._reloading) {
      this._reloading.t -= frameDt
      if (this._reloading.t <= 0) {
        const gid = this._reloading.gunId
        const def = AMMO_DEFS[gid]
        const a = getAmmo(gid)
        const take = Math.min(def ? def.magSize : 0, a.reserve)
        setAmmo(gid, take, a.reserve - take)
        this._reloading = 0
        this.refreshHudAmmo()
      }
    }
    // Кулдаун супер-удара — СКРЫТ: супер-силы пока не нужны
    // if (this._superCd > 0) this._superCd = Math.max(0, this._superCd - frameDt)

    // Автовращение «Обзора · сверху» (любое направление движения — джойстик,
    // WASD, диагонали, назад). Рвём петлю обратной связи
    // «камера→движение→камера»: движение считается от стабильной ОПОРЫ
    // (controlYaw), доворачивается только сам взгляд (yaw). Пока доворот
    // активен — опора заморожена; когда неактивен (покой / пауза 2 сек после
    // ручного обзора / выкл. в настройках) — опора следует за взглядом:
    // нажал W — бежишь туда, куда смотришь.
    // Решаем по состоянию ПРОШЛОГО кадра (isMoving), чтобы контроллер успел
    // использовать опору до доворота камеры в этом кадре.
    const rawX = this.controller.lateralInput
    const rawZ = -this.controller.forwardInput
    const autoActive =
      settings.autoRotate &&
      this.controller.isMoving &&
      this.camera.secondsSinceManualOrbit() > 2.0

    if (!autoActive) {
      this.camera.syncControlToYaw()
      this._autoDirAng = null
    } else {
      // Резкая смена направления движения (S→W, W→A, джойстик в другой угол
      // более чем на ~40°): пере-якорим опору на текущий взгляд. Иначе после
      // разворота W/S повели бы персонажа от старой замороженной опоры —
      // «в неожиданную» сторону. Мелкие дребезги джойстика порог не переходят.
      const ang = Math.atan2(rawX, rawZ)
      if (this._autoDirAng !== null && Math.abs(this._wrapAngle(ang - this._autoDirAng)) > 0.7) {
        this.camera.syncControlToYaw()
      }
      this._autoDirAng = ang
    }

    // Обновляем контроллер (позиция/прыжок/разворот персонажа).
    // Базис движения — от ОПОРЫ (взгляд мог уже довернуться, его не используем).
    this.controller.setCameraYaw(this.camera.getControlYaw())
    this.controller.update(frameDt)

    // Доворот взгляда за персонажем. Разворот — только сам yaw: базис движения
    // в него НЕ переписывается (иначе снова вырастет петля обратной связи).
    if (autoActive) {
      this.camera.softFollowHeading(this.player.group.rotation.y, frameDt, 1.4)
    }

    // Обновляем анимацию персонажа (ходьба/idle)
    this.player.update(frameDt, this.controller.isMoving)

    // Сошёл с крыши сам (неправильно пошёл) — падение без награды
    this._checkWalkedOff()

    // Локальные боты (режим «Играть с ботами»)
    if (this.playMode === 'bots' && this.bots.length) this._updateBots(frameDt)

    // Полёты выбитых с крыши + снаряды + взрывы + облака
    if (this.flyers.length) this._updateFlyers(frameDt)
    if (this.projectiles.length) this._updateProjectiles(frameDt)
    if (this.effects.length) this._updateEffects(frameDt)
    if (this.world) this.world.update(frameDt)

    // Кольцо дальности следует за игроком (свой диапазон видит только он)
    if (this.rangeRing) {
      this.rangeRing.position.set(
        this.player.group.position.x, 0.07, this.player.group.position.z
      )
    }

    // Камера плавно следует за игроком
    this.camera.follow(this.player.group)

    // Тряска камеры от взрывов (затухает)
    if (this._shake > 0) {
      const c = this.camera.getCamera()
      c.position.x += (Math.random() - 0.5) * this._shake
      c.position.y += (Math.random() - 0.5) * this._shake
      c.position.z += (Math.random() - 0.5) * this._shake
      this._shake = Math.max(0, this._shake - frameDt * 3)
    }

    // Рендеруем сцену
    this.renderer.render(this.scene, camera)
  }

  // Удар (F / кнопка УДАР).
  // Логика простая, в рот целиться НЕ надо:
  // - катана/кулаки: враг внутри твоего кольца (голубое) — удар попадёт
  //   с любой стороны;
  // - нож/пистолет/гранатомёт: персонаж САМ доворачивается на ближайшего
  //   врага в диапазоне и стреляет (мимо — снаряд летит до конца диапазона).
  // 1 щит = гасит 1 удар (видно вспышку). Без щитов — вылет с крыши + награда.
  attack() {
    if (!this.isInitialized || !this.player) return
    if (this._attackCd > 0 || !this.player.alive) return
    const gun0 = getEquippedWeapon()
    this._attackCd = (gun0 && FIRE_CD[gun0.id]) || 0.4
    this.player.punch()
    if (this.playMode !== 'bots' || !this.bots.length) return

    const att = this.player.characterInfo
    const px = this.player.group.position.x
    const pz = this.player.group.position.z
    const gun = gun0
    const ranged = gun && (gun.id === 'knife' || gun.id === 'pistol' || gun.id === 'ak' || gun.id === 'mg' || gun.id === 'grenade' || gun.id === 'bus')
    const reach = Math.max(att.attackRange || 2, gun ? gun.range : 0) + 0.6
    const aimLimit = ranged ? gun.range : reach

    // Автодоворот на ближайшего врага в диапазоне — целиться движением не надо
    let aim = null, aimDist = Infinity
    this.bots.forEach((bot) => {
      if (!bot.player.alive) return
      const bp = bot.player.group.position
      const dist = Math.hypot(bp.x - px, bp.z - pz)
      if (dist <= aimLimit && dist < aimDist) { aim = bot; aimDist = dist }
    })
    if (aim) {
      const bp = aim.player.group.position
      this.player.group.rotation.y = Math.atan2(bp.x - px, bp.z - pz)
    }

    if (ranged) {
      if (gun.id !== 'knife' && gun.id !== 'bus' && !this._consumeAmmo(gun.id)) return
      if (gun.id === 'grenade') {
        this._fireGrenade(gun)
        return
      }
      if (gun.id === 'bus') {
        this._throwBus(gun) // автобус бесконечный: улетел — новый уже в руке
        return
      }
      this._throwKnife(gun)
      return
    }

    if (!aim) return
    this._resolvePlayerHit(aim)
  }

  // // --- СКРЫТО: Супер-удар (G / ⚡), пока НЕ НУЖЕН, не удалено ---
  // // Волна −2 щита всем ботам рядом. Кулдаун 5 сек.
  // useSuper() {
  //   if (!this.isInitialized || !this.player || !this.player.alive) return
  //   if (this.playMode !== 'bots' || !this.bots.length) return
  //   const pow = getPowerFor(this.activeCharacterId)
  //   if (!pow || !isPowerOwned(pow.id)) {
  //     this._feed('⚡ Нет супер-силы — купи в каталоге «Супер-силы»')
  //     return
  //   }
  //   if (this._superCd > 0) {
  //     this._feed('⚡ Супер-удар через ' + Math.ceil(this._superCd) + ' c')
  //     return
  //   }
  //   this._superCd = SUPER_CD
  //   this.player.punch()
  //   const pp = this.player.group.position
  //   const radius = (this.player.characterInfo.attackRange || 2) + 4
  //   // Голубая волна
  //   const mat = new THREE.MeshBasicMaterial({
  //     color: 0x35e0ff, transparent: true, opacity: 0.9, side: THREE.DoubleSide
  //   })
  //   const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.85, 48), mat)
  //   ring.rotation.x = -Math.PI / 2
  //   ring.position.set(pp.x, 0.12, pp.z)
  //   this.scene.add(ring)
  //   this.effects.push({ mesh: ring, mat, ttl: 0.6, max: 0.6, grow: 12 })
  //   this._feed(pow.icon + ' ' + pow.name + '!')
  //   for (const bot of this.bots) {
  //     if (!bot.player.alive) continue
  //     const bp = bot.player.group.position
  //     const dx = bp.x - pp.x, dz = bp.z - pp.z
  //     if (dx * dx + dz * dz > radius * radius) continue
  //     let res = bot.player.receiveHit() // −1 щит
  //     if (res !== 'ko') res = bot.player.receiveHit() // −2 щит
  //     if (res === 'ko') {
  //       const dir = new THREE.Vector3(dx, 0, dz)
  //       if (dir.lengthSq() < 0.001) dir.set(0, 0, 1)
  //       dir.normalize()
  //       this._launchBot(bot, dir, true)
  //     } else {
  //       this._flashAt(bp)
  //     }
  //   }
  // }

  // Патрон: магазин -> выстрел; пусто -> автоперезарядка из запаса;
  // запас пуст -> подсказка докупить. Возвращает можно ли стрелять.
  _consumeAmmo(gunId) {
    if (this._reloading > 0) return false
    const def = AMMO_DEFS[gunId]
    if (!def) return true // нож/катана бесконечные
    const a = getAmmo(gunId)
    if (a.mag > 0) {
      setAmmo(gunId, a.mag - 1, a.reserve)
      this.refreshHudAmmo()
      return true
    }
    if (a.reserve > 0) {
      this._reloading = { gunId, t: 1.2 }
      this._feed('🔫 Перезарядка…')
    } else {
      this._feed('🔫 Нет патронов — докупи в Оружии')
    }
    return false
  }

  refreshHudAmmo() {
    const el = document.getElementById('ammo-hud')
    if (!el) return
    const gun = getEquippedWeapon()
    if (gun && AMMO_DEFS[gun.id]) {
      const a = getAmmo(gun.id)
      el.textContent = gun.icon + ' ' + a.mag + '/' + a.reserve
      el.classList.remove('hidden')
    } else {
      el.textContent = ''
      el.classList.add('hidden')
    }
  }

  refreshHudWeapon() {
    const hud = document.getElementById('player-hud')
    if (!hud) return
    let el = document.getElementById('hud-gun')
    const gun = getEquippedWeapon()
    if (!gun) {
      if (el) el.remove()
      return
    }
    if (!el) {
      el = document.createElement('span')
      el.className = 'hud-gun'
      el.id = 'hud-gun'
      hud.append(el)
    }
    el.textContent = gun.icon + ' ' + gun.name
  }

  refreshHudDamage() {
    const el = document.getElementById('hud-damage')
    if (el && this.player) {
      el.textContent = '\uD83D\uDCA5' + this.player.characterInfo.damage
    }
  }

  // Смена оружия прямо в бою (R / 🔄): по кругу свои купленные + кулаки.
  // После смены обновляются модель в руке, кольцо, HUD и патроны.
  cycleWeapon() {
    if (!this.isInitialized || !this.player || !this.player.alive) return
    const owned = WEAPONS.filter(w => isWeaponOwned(w.id)).map(w => w.id)
    const order = [...owned, null] // null в конце = кулаки
    if (!order.length) return
    const cur = getEquippedWeaponId()
    const next = order[(order.indexOf(cur) + 1) % order.length]
    if (next) {
      equipWeapon(next)
    } else {
      unequipWeapon()
    }
    this.player.setWeapon(next)
    this._createRangeRing()
    this.refreshHudWeapon()
    this.refreshHudAmmo()
    const gun = getEquippedWeapon()
    this._feed(gun ? (gun.icon + ' ' + gun.name + ' — к бою!') : '🥋 Кулаки — к бою!')
  }

  _resolvePlayerHit(bot) {
    const res = bot.player.receiveHit()
    const bp = bot.player.group.position
    if (res === 'ko') {
      const pp = this.player.group.position
      const dir = new THREE.Vector3(bp.x - pp.x, 0, bp.z - pp.z)
      if (dir.lengthSq() < 0.001) dir.set(0, 0, 1)
      dir.normalize()
      this._launchBot(bot, dir, true)
    } else if (res === 'blocked') {
      // Щит сгорел — показываем попадание вспышкой и строкой в киллфиде
      this._flashAt(bp)
      this._feed(this._meName() + ' ' + ((getEquippedWeapon() || {}).icon || '👊') + ' → 🛡 ' + this._botName(bot))
    }
  }

  // Белая вспышка попадания (маленькая, быстро гаснет)
  _flashAt(pos) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 })
    const flash = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), mat)
    flash.position.set(pos.x, Math.max(1.2, pos.y + 1.5), pos.z)
    this.scene.add(flash)
    this.effects.push({ mesh: flash, mat, ttl: 0.22, max: 0.22, grow: 2 })
  }

  // Бросок ножа / выстрел пистолета / AK47 / пулемёта: визуальный полёт к цели, урон по прилёту
  _throwKnife(gun) {
    const from = this.player.group.position.clone()
    from.y += 1.6
    const ry = this.player.group.rotation.y
    const dir = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry))
    // Цвет снаряда по типу оружия
    const isGun = gun.id === 'pistol' || gun.id === 'ak' || gun.id === 'mg'
    const bulletColor = gun.id === 'mg' ? 0xff4444 : gun.id === 'ak' ? 0xffe060 : 0xffb03a
    const bladeMat = new THREE.MeshStandardMaterial({
      color: isGun ? bulletColor : 0xdfe3e8,
      metalness: 0.7, roughness: 0.25,
      emissive: isGun ? bulletColor : 0x000000, emissiveIntensity: isGun ? 1.2 : 0
    })
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x4a2a1a, metalness: 0.2, roughness: 0.6 })
    const knife = new THREE.Group()
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.55), bladeMat)
    blade.position.z = 0.2
    knife.add(blade)
    if (!isGun) {
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.3), gripMat)
      grip.position.z = -0.22
      knife.add(grip)
    }
    knife.position.copy(from)
    knife.rotation.y = ry
    this.scene.add(knife)
    // Пулемёт быстрее, AK чуть быстрее пистолета
    const speed = gun.id === 'mg' ? 50 : gun.id === 'ak' ? 42 : 34
    this.projectiles.push({ mesh: knife, dir, traveled: 0, maxRange: gun.range, speed, hitR2: 1.44 })
  }

  // Бросок АВТОБУСА: летит в голову/тело до 15 м, в руке тут же новый.
  // Коридор шире (автобус большой) — 1.5 м.
  _throwBus(gun) {
    const from = this.player.group.position.clone()
    from.y += 1.8
    const ry = this.player.group.rotation.y
    const dir = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry))
    const box3 = new THREE.Box3().setFromObject(this.player.group)
    const s = Math.max(box3.getSize(new THREE.Vector3()).y, 1) / 6
    const bus = buildBusMesh(s)
    bus.position.copy(from)
    bus.rotation.y = ry
    this.scene.add(bus)
    this.projectiles.push({ mesh: bus, dir, traveled: 0, maxRange: gun.range, speed: 26, hitR2: 2.25 })
  }

  _updateProjectiles(frameDt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i]
      const stepLen = pr.speed * frameDt
      pr.mesh.position.x += pr.dir.x * stepLen
      pr.mesh.position.z += pr.dir.z * stepLen
      pr.traveled += stepLen
      if (pr.grenade) {
        // Дуга гранаты
        pr.vy -= 12 * frameDt
        pr.mesh.position.y += pr.vy * frameDt
        pr.mesh.rotation.x += frameDt * 9
        if (pr.mesh.position.y <= 0.25) {
          this.scene.remove(pr.mesh)
          this.projectiles.splice(i, 1)
          this._explode(pr.mesh.position)
          continue
        }
      } else {
        pr.mesh.rotation.y += frameDt * 25
      }
      // Первый враг в коридоре — попадание (у автобуса коридор шире)
      let hit = null
      for (const bot of this.bots) {
        if (!bot.player.alive) continue
        const bp = bot.player.group.position
        const dx = bp.x - pr.mesh.position.x
        const dz = bp.z - pr.mesh.position.z
        if (dx * dx + dz * dz < (pr.hitR2 || 1.44)) { hit = bot; break }
      }
      if (hit) {
        const pos = pr.mesh.position.clone()
        this.scene.remove(pr.mesh)
        this.projectiles.splice(i, 1)
        if (pr.grenade) {
          this._explode(pos) // граната взрывается даже при прямом попадании
        } else {
          this._resolvePlayerHit(hit)
        }
        continue
      }
      // Долетели до конца диапазона — пуля исчезает, граната взрывается
      if (pr.traveled >= pr.maxRange) {
        const pos = pr.mesh.position.clone()
        const wasGrenade = !!pr.grenade
        this.scene.remove(pr.mesh)
        this.projectiles.splice(i, 1)
        if (wasGrenade) this._explode(pos)
      }
    }
  }

  // Гранатомёт: граната летит дугой до 7 м, взрыв бьёт по площади (радиус 3.2 м).
  // Щит гасит взрыв, без щитов — вылет с крыши. Себя не задевает.
  _fireGrenade(gun) {
    const from = this.player.group.position.clone()
    from.y += 1.6
    const ry = this.player.group.rotation.y
    const dir = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry))
    const shell = new THREE.Group()
    const bodyM = new THREE.MeshStandardMaterial({ color: 0x2e4a2e, metalness: 0.5, roughness: 0.4 })
    const tipM = new THREE.MeshStandardMaterial({
      color: 0xff3b3b, emissive: 0xff2222, emissiveIntensity: 1.2
    })
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.4, 10), bodyM)
    body.rotation.x = Math.PI / 2
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), tipM)
    tip.position.z = 0.26
    shell.add(body, tip)
    shell.position.copy(from)
    shell.rotation.y = ry
    this.scene.add(shell)
    this.projectiles.push({
      mesh: shell, dir, traveled: 0, maxRange: gun.range, speed: 22,
      grenade: true, vy: 2.5
    })
  }

  // Взрыв: большая вспышка + ударное кольцо + осколки + дым + тряска камеры.
  // Урон всем ботам в радиусе 3.6 м. Щит гасит (видно вспышку и строку).
  _explode(pos) {
    const gy = Math.max(0.6, pos.y)
    // Ядро вспышки
    const mat = new THREE.MeshBasicMaterial({ color: 0xffc03a, transparent: true, opacity: 0.95 })
    const flash = new THREE.Mesh(new THREE.SphereGeometry(0.8, 18, 14), mat)
    flash.position.set(pos.x, gy, pos.z)
    this.scene.add(flash)
    this.effects.push({ mesh: flash, mat, ttl: 0.4, max: 0.4, grow: 7 })
    // Кольцо ударной волны по земле
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff8a2a, transparent: true, opacity: 0.9, side: THREE.DoubleSide
    })
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.85, 40), ringMat)
    ring.rotation.x = -Math.PI / 2
    ring.position.set(pos.x, 0.12, pos.z)
    this.scene.add(ring)
    this.effects.push({ mesh: ring, mat: ringMat, ttl: 0.5, max: 0.5, grow: 9 })
    // Осколки
    const debrisMat = new THREE.MeshBasicMaterial({ color: 0x4a2f1a, transparent: true, opacity: 1 })
    for (let d = 0; d < 12; d++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), debrisMat.clone())
      const a = Math.random() * Math.PI * 2
      const sp = 5 + Math.random() * 8
      m.position.set(pos.x, gy, pos.z)
      this.scene.add(m)
      this.effects.push({
        mesh: m, mat: m.material, ttl: 0.7, max: 0.7, grow: 0,
        vel: new THREE.Vector3(Math.cos(a) * sp, 4 + Math.random() * 7, Math.sin(a) * sp),
        grav: 18
      })
    }
    // Дым
    const smokeMat = new THREE.MeshBasicMaterial({ color: 0x555560, transparent: true, opacity: 0.55 })
    for (let sIdx = 0; sIdx < 5; sIdx++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.5 + Math.random() * 0.4, 12, 10), smokeMat.clone())
      m.position.set(pos.x + (Math.random() - 0.5) * 1.5, gy + Math.random() * 0.8, pos.z + (Math.random() - 0.5) * 1.5)
      this.scene.add(m)
      this.effects.push({
        mesh: m, mat: m.material, ttl: 1.1, max: 1.1, grow: 4, rise: 2.2
      })
    }
    // Тряска камеры: чем ближе игрок к взрыву — тем сильнее
    const pp = this.player.group.position
    const dist = Math.hypot(pp.x - pos.x, pp.z - pos.z)
    this._shake = Math.max(this._shake || 0, Math.max(0, 0.9 - dist * 0.03))
    for (const bot of this.bots) {
      if (!bot.player.alive) continue
      const bp = bot.player.group.position
      const dx = bp.x - pos.x, dz = bp.z - pos.z
      if (dx * dx + dz * dz > 3.6 * 3.6) continue
      const res = bot.player.receiveHit()
      if (res === 'ko') {
        const dir = new THREE.Vector3(dx, 0, dz)
        if (dir.lengthSq() < 0.001) dir.set(0, 0, 1)
        dir.normalize()
        this._launchBot(bot, dir, true)
      } else if (res === 'blocked') {
        this._flashAt(bp)
        this._feed(this._meName() + ' 💣 → 🛡 ' + this._botName(bot))
      }
    }
  }

  _updateEffects(frameDt) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const ef = this.effects[i]
      ef.ttl -= frameDt
      const k = Math.max(0, ef.ttl / ef.max)
      ef.mesh.scale.setScalar(Math.max(0.01, 1 + (1 - k) * (ef.grow || 5)))
      ef.mat.opacity = 0.95 * k
      if (ef.vel) {
        // Осколки: полёт + гравитация + стоп на крыше
        ef.vel.y -= (ef.grav || 18) * frameDt
        ef.mesh.position.x += ef.vel.x * frameDt
        ef.mesh.position.y += ef.vel.y * frameDt
        ef.mesh.position.z += ef.vel.z * frameDt
        if (ef.mesh.position.y < 0.08) {
          ef.mesh.position.y = 0.08
          ef.vel.set(0, 0, 0)
        }
      }
      if (ef.rise) ef.mesh.position.y += ef.rise * frameDt // дым вверх
      if (ef.ttl <= 0) {
        this.scene.remove(ef.mesh)
        if (ef.mesh.geometry) ef.mesh.geometry.dispose()
        if (ef.mat && ef.mat.dispose) ef.mat.dispose()
        this.effects.splice(i, 1)
      }
    }
  }

  // Выбивание бота игроком: вылет с крыши + падение вниз вдоль дома
  _launchBot(bot, dir, byPlayer) {
    bot.player.markKnockedOut()
    const g = bot.player.group
    this.flyers.push({
      group: g,
      vel: new THREE.Vector3(dir.x * 12, 5, dir.z * 12),
      kind: 'bot',
      ref: bot,
      byPlayer: !!byPlayer,
      attName: byPlayer ? this._meName() : (this._pendingAttName || 'Бот')
    })
    this._killSeq = (this._killSeq || 0)
  }

  // Выбивание игрока ботом: тот же полёт, без потери денег. Минус жизнь.
  _launchPlayer(dir) {
    this.player.markKnockedOut()
    this.controller.setKnockedOut(true)
    this._loseLife()
    this.flyers.push({
      group: this.player.group,
      vel: new THREE.Vector3(dir.x * 12, 5, dir.z * 12),
      kind: 'player',
      ref: null
    })
  }

  _updateFlyers(frameDt) {
    for (let i = this.flyers.length - 1; i >= 0; i--) {
      const f = this.flyers[i]
      f.vel.y -= 22 * frameDt // гравитация падения со 100 этажей
      f.group.position.x += f.vel.x * frameDt
      f.group.position.z += f.vel.z * frameDt
      f.group.position.y += f.vel.y * frameDt
      f.group.rotation.x += 5 * frameDt // кувырок в полёте
      if (f.group.position.y < -45) {
        this.flyers.splice(i, 1)
        if (f.kind === 'bot') {
          // Убитые боты НЕ возвращаются. Все убиты — конец игры.
          f.ref.player.group.visible = false
          const victim = this._botName(f.ref)
          if (f.byPlayer) {
            this._killSeq += 1
            this.sessionKills += 1
            const earned = this.onVictory('kill-' + Date.now() + '-' + this._killSeq)
            if (earned !== null) this.sessionEarned += (this.killReward || VICTORY_REWARD)
            const gun = getEquippedWeapon()
            const icon = gun ? gun.icon : '👊'
            this._feed(this._meName() + ' ' + icon + ' → 🎯 ' + victim)
          } else {
            this._feed((f.attName || 'Бот') + ' 👊 → 🎯 ' + victim)
          }
          this._checkWin()
        } else {
          // Игрок долетел: жизни остались — респаун, нет — смерть
          if (this._doomed) {
            this._playerDead()
          } else {
            this._respawnPlayer()
          }
        }
      }
    }
  }

  _respawnPlayer() {
    if (this._doomed || this.lives <= 0) return // сердечки кончились — не возвращаемся
    const g = this.player.group
    g.position.set(0, 0, 0)
    g.rotation.set(0, 0, 0)
    this.player.fullRestore()
    this.controller.setPosition(0, 0, 0)
    this.controller.setKnockedOut(false)
    this.refreshHudShields()
  }

  // Смерть: сердечки закончились. Итог: убил хоть 1 врага — награда
  // за фраги остаётся; 0 фрагов — награды нет.
  _playerDead() {
    if (this._won) return // победа уже показана — она важнее
    const el = document.getElementById('lose-stats')
    if (el) {
      el.textContent = this.sessionKills > 0
        ? 'Фраги: ' + this.sessionKills +
          ' · Заработано: +$' + this.sessionEarned.toLocaleString('en-US')
        : 'Фраги: 0 · Награды нет — ни одного врага не выбито'
    }
    const lose = document.getElementById('lose-screen')
    if (lose) lose.classList.add('active')
  }

  // Имя игрока для киллфида (из профиля, иначе «Вы»)
  _meName() {
    try {
      const p = loadProfile()
      if (p && p.name) return p.name
    } catch (e) { /* ignore */ }
    return 'Вы'
  }

  _botName(bot) {
    return 'Бот-' + bot.player.characterInfo.name
  }

  // Киллфид: «Вы 🔪 → 🎯 Бот-Робот» (исчезает через ~4.5 c)
  _feed(text) {
    const feed = document.getElementById('killfeed')
    if (!feed) return
    const item = document.createElement('div')
    item.className = 'killfeed-item'
    item.textContent = text
    feed.prepend(item)
    while (feed.children.length > 5) feed.removeChild(feed.lastChild)
    setTimeout(() => { if (item.parentNode) item.parentNode.removeChild(item) }, 4500)
  }

  // Кольцо дальности под игроком: свой диапазон видит только он (у ботов колец нет).
  // Учитывает лучшее купленное оружие — видно, как диапазон вырос.
  _createRangeRing() {
    if (this.rangeRing) {
      this.scene.remove(this.rangeRing)
      this.rangeRing = null
    }
    if (!this.player) return
    const gun = getEquippedWeapon()
    const r = Math.max(
      this.player.characterInfo.attackRange || 2,
      gun ? gun.range : 0
    )
    const geo = new THREE.RingGeometry(Math.max(0.1, r - 0.09), r + 0.09, 48)
    const mat = new THREE.MeshBasicMaterial({
      color: 0x35e0ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide
    })
    this.rangeRing = new THREE.Mesh(geo, mat)
    this.rangeRing.rotation.x = -Math.PI / 2
    this.rangeRing.position.set(
      this.player.group.position.x, 0.07, this.player.group.position.z
    )
    this.scene.add(this.rangeRing)
  }

  // Сам сошёл с крыши (неправильно пошёл): падение без награды и урона
  _checkWalkedOff() {
    if (!this.player.alive) return
    const half = this.arenaHalf || 25
    const p = this.player.group.position
    if (Math.abs(p.x) > half || Math.abs(p.z) > half) {
      const dir = new THREE.Vector3(p.x, 0, p.z)
      if (dir.lengthSq() < 0.001) dir.set(0, 0, 1)
      dir.normalize()
      this._feed(this._meName() + ' 🕳️ → 🌃 упал с крыши')
      this.player.markKnockedOut()
      this.controller.setKnockedOut(true)
      this._loseLife()
      this.flyers.push({
        group: this.player.group,
        vel: new THREE.Vector3(dir.x * 4, 1.5, dir.z * 4),
        kind: 'player',
        ref: null
      })
    }
  }

  // Все боты выбиты — победа, конец игры.
  // Если игрок уже мёртв (сердечки кончились), победу не показываем.
  // Награда только если убит хоть 1 враг, иначе «награды нет».
  _checkWin() {
    if (this._won || this.playMode !== 'bots' || !this.bots.length) return
    if (this._doomed || (this.lives <= 0 && !this.player.alive)) return
    if (!this.bots.every(b => !b.player.alive)) return
    this._won = true
    this.sessionKills = this.sessionKills || 0
    const el = document.getElementById('win-stats')
    if (el) {
      el.textContent = this.sessionKills > 0
        ? 'Фраги: ' + this.sessionKills +
          ' · Награда: +$' + this.sessionEarned.toLocaleString('en-US')
        : 'Фраги: 0 · Награды нет — ни одного врага не выбито'
    }
    const win = document.getElementById('win-screen')
    if (win) win.classList.add('active')
  }

  // Боты уровня сложности: пул по щитам, свои скорость/каденс.
  // «Невозможно» — вооружены катанами (только визуал + злость).
  _spawnBots(diff) {
    this.bots = []
    const d = diff || { pool: [], speedMul: 1, atkCd: 2.5, armed: false }
    let pool = (d.pool || []).filter(id => CHARACTERS.some(c => c.id === id))
    if (!pool.length) {
      pool = CHARACTERS.filter(c => c.id !== this.activeCharacterId).map(c => c.id)
    }
    const k = (this.arenaHalf || 25) / 25 // спавны масштабируются под карту
    // Сколько ботов: всего бойцов = players карты (ты + боты)
    const total = (this.arena && this.arena.players) || 4
    const n = Math.max(1, Math.min(total - 1, 12, pool.length * 3))
    // Точки спавна кольцом вокруг центра (хватает на любое число)
    const spots = []
    for (let sIdx = 0; sIdx < n; sIdx++) {
      const a = (sIdx / n) * Math.PI * 2 + 0.4
      const r = 9 * k
      spots.push([Math.cos(a) * r, Math.sin(a) * r])
    }
    for (let i = 0; i < n; i++) {
      const id = pool[i % pool.length]
      // Оружие бота по уровню сложности (вид + дальность):
      // легко — кулаки, средне — ножи, сложно — катаны/АК, невозможно — всё тяжёлое.
      // null = без оружия (боты НЕ копируют надетое игроком).
      const arms = d.arms && d.arms.length ? d.arms : (d.armed ? ['katana'] : [])
      const wid = arms.length ? arms[i % arms.length] : null
      const botPlayer = new Player(this.scene, id, { weaponId: wid })
      botPlayer.group.position.set(spots[i][0], 0, spots[i][1])
      this.bots.push({
        player: botPlayer,
        gunId: wid,
        angle: Math.random() * Math.PI * 2,
        timer: 1 + Math.random() * 3,
        speed: (0.10 + Math.random() * 0.08) * (d.speedMul || 1),
        phase: Math.random() * Math.PI * 2,
        atkCd: (d.atkCd || 2.5) * (0.9 + Math.random() * 0.2)
      })
    }
  }

  // Боты соревнуются: каждый идёт к ближайшему сопернику
  // (игрок или другой бот) и бьёт в своей дальности.
  _updateBots(frameDt) {
    const step = Math.min(frameDt * 60, 3)
    const pp = this.player.group.position
    for (const bot of this.bots) {
      // Выбитые боты больше не появляются
      if (!bot.player.alive) continue
      if (bot.atkCd > 0) bot.atkCd -= frameDt
      const g = bot.player.group
      // Дальность бота: своя + оружие уровня (как у игрока)
      const bw = (WEAPONS.find(w => w.id === bot.gunId) || {}).range || 0
      const botReach = Math.max(bot.player.characterInfo.attackRange || 2, bw) + 0.6

      // Ближайший живой соперник: игрок или другой бот
      let tx = null, tz = null, tDist = Infinity, tIsPlayer = false, tBot = null
      if (this.player.alive) {
        const d = Math.hypot(pp.x - g.position.x, pp.z - g.position.z)
        if (d < tDist) { tDist = d; tx = pp.x; tz = pp.z; tIsPlayer = true }
      }
      for (const other of this.bots) {
        if (other === bot || !other.player.alive) continue
        const op = other.player.group.position
        const d = Math.hypot(op.x - g.position.x, op.z - g.position.z)
        if (d < tDist) { tDist = d; tx = op.x; tz = op.z; tIsPlayer = false; tBot = other }
      }

      if (tx !== null && tDist > botReach * 0.85) {
        // Идём к сопернику
        bot.angle = Math.atan2(tz - g.position.z, tx - g.position.x)
        const moving = tDist > 0.4
        let nx = g.position.x + Math.cos(bot.angle) * bot.speed * step
        let nz = g.position.z + Math.sin(bot.angle) * bot.speed * step
        // Не слипаемся: лёгкое расталкивание от других ботов ближе 2 м
        for (const other of this.bots) {
          if (other === bot || !other.player.alive) continue
          const op = other.player.group.position
          const sx = nx - op.x, sz = nz - op.z
          const sd = Math.hypot(sx, sz)
          if (sd > 0.001 && sd < 2) {
            nx += (sx / sd) * (2 - sd) * 0.5
            nz += (sz / sd) * (2 - sd) * 0.5
          }
        }
        // У края крыши разворачиваемся к центру (сами не падают)
        const edge = (this.arenaHalf || 25) - 1.5
        if (Math.abs(nx) > edge || Math.abs(nz) > edge) {
          bot.angle = Math.atan2(-g.position.z, -g.position.x)
          nx = Math.max(-edge, Math.min(edge, nx))
          nz = Math.max(-edge, Math.min(edge, nz))
        }
        g.position.x = nx
        g.position.z = nz
        bot.phase += frameDt * 3
        g.position.y = Math.max(0, Math.sin(bot.phase)) * 0.35
        const want = Math.atan2(Math.cos(bot.angle), Math.sin(bot.angle))
        g.rotation.y = this._lerpAngle(g.rotation.y, want, 1 - Math.exp(-8 * Math.max(frameDt, 0)))
        bot.player.update(frameDt, moving)
      } else {
        // Вплотную: стоим и бьём
        bot.player.update(frameDt, false)
        if (tx !== null && tDist <= botReach && bot.atkCd <= 0 && !this.isTestMode) {
          bot.atkCd = 2.5
          bot.player.punch()
          // Смотрим на жертву
          g.rotation.y = Math.atan2(tx - g.position.x, tz - g.position.z)
          if (tIsPlayer) {
            const res = this.player.receiveHit()
            this.refreshHudShields()
            if (res === 'ko') {
              const dir = new THREE.Vector3(pp.x - g.position.x, 0, pp.z - g.position.z)
              if (dir.lengthSq() < 0.001) dir.set(0, 0, 1)
              dir.normalize()
              this._feed(this._botName(bot) + ' 👊 → 🎯 ' + this._meName())
              this._launchPlayer(dir)
            }
          } else if (tBot && tBot.player.alive) {
            const res = tBot.player.receiveHit()
            if (res === 'ko') {
              const op = tBot.player.group.position
              const dir = new THREE.Vector3(op.x - g.position.x, 0, op.z - g.position.z)
              if (dir.lengthSq() < 0.001) dir.set(0, 0, 1)
              dir.normalize()
              this._pendingAttName = this._botName(bot)
              this._launchBot(tBot, dir, false)
              this._pendingAttName = null
            }
          }
        }
      }
    }
  }

  _lerpAngle(current, target, t) {
    let diff = target - current
    while (diff > Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    return current + diff * Math.min(Math.max(t, 0), 1)
  }

  // Привести угол к [-PI, PI]
  _wrapAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2
    while (a < -Math.PI) a += Math.PI * 2
    return a
  }

  // Применение настроек к запущенной игре (вызывается из панели настроек)
  applySettings() {
    if (!this.isInitialized) return
    const preset = settings.preset
    this.targetFps = settings.fps
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.pixelRatio))
    this.renderer.shadowMap.enabled = preset.shadows
    this.renderer.shadowMap.needsUpdate = true
    if (this.lighting) this.lighting.applyPreset(preset)
  }

  onWindowResize(camera) {
    const width = window.innerWidth
    const height = window.innerHeight

    camera.aspect = width / height
    camera.updateProjectionMatrix()

    this.renderer.setSize(width, height)
  }

  dispose() {
    if (!this.isInitialized) return

    // Останавливаем анимацию
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
    }

    // Скрываем игровой контейнер
    this.gameContainer.classList.add('hidden')

    // Освобождаем контроллер
    if (this.controller) {
      this.controller.dispose()
      this.controller = null
    }

    // Очищаем сцену (игрок + боты + ножи + кольцо удаляются вместе со сценой).
    // Обходим и dispose геометрию/материалы — иначе видеопамять течёт
    // при каждой новой игре (scene.clear() буферы GPU не чистит).
    if (this.scene) {
      this.scene.traverse(o => {
        try {
          if (o.geometry) o.geometry.dispose()
          if (o.material) {
            const mats = Array.isArray(o.material) ? o.material : [o.material]
            mats.forEach(m => {
              if (m.map) m.map.dispose()
              if (m.dispose) m.dispose()
            })
          }
        } catch (e) { /* ignore */ }
      })
      this.scene.clear()
    }
    this.bots = []
    this.flyers = []
    this.projectiles = []
    this.effects = []
    this.rangeRing = null
    this.world = null
    this.playMode = 'solo'
    this.sessionKills = 0
    this.sessionEarned = 0
    this._won = false
    this.lives = 2
    this._doomed = false
    const win = document.getElementById('win-screen')
    if (win) win.classList.remove('active')
    const lose = document.getElementById('lose-screen')
    if (lose) lose.classList.remove('active')

    // Освобождаем ресурсы
    if (this.renderer) {
      this.renderer.dispose()
    }

    // Освобождаем камеру (убираем слушатели мыши/тача)
    if (this.camera) {
      this.camera.detachOrbit()
      this.camera = null
    }

    // Удаляем обработчик события
    if (this.handleResize) {
      window.removeEventListener('resize', this.handleResize)
    }
    if (this._onAttackKey) {
      window.removeEventListener('keydown', this._onAttackKey)
      this._onAttackKey = null
    }
    if (this._attackDomHandlers) {
      this._attackDomHandlers.forEach(({ el, type, h }) => el.removeEventListener(type, h))
      this._attackDomHandlers = []
    }
    this._attackCd = 0
    this._reloading = 0
    // this._superCd = 0 // СКРЫТО: супер-силы пока не нужны
    this._shake = 0

    this.activeCharacterId = null
    this.isTestMode = false
    this.isInitialized = false
  }
}
