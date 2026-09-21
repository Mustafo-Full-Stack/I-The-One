import * as THREE from 'three'
import { CHARACTERS, getSelectedCharacterId, setSelectedCharacterId, formatBalance } from './data/Characters.js'
import { getWallet, isOwned, isLocked, buyCharacter, ensureValidSelection } from './data/Economy.js'
import { getEquippedWeapon } from './data/Weapons.js'
import { createPreviewGroup } from './game/CharacterFactory.js'

// Экран выбора персонажа: responsive CSS Grid (4/3/2/1), вертикальный скролл.
// МАГАЗИН: чужого персонажа бесплатно использовать нельзя — только КУПИТЬ
// за деньги кошелька (награда за килл — по уровню сложности).
// Тест-кнопка делегируется в main.js через onTest callback —
// CharactersManager сам игру не создаёт.
export class CharactersManager {
  constructor(menuManager, opts = {}) {
    this.menuManager = menuManager
    this.onTest = opts.onTest || null
    this.screen = document.getElementById('characters-screen')
    this.grid = document.getElementById('characters-grid')
    this.backBtn = document.getElementById('btn-characters-back')

    this.cards = []
    this.previews = []
    this._raf = null

    this._buildCards()
    this.backBtn.addEventListener('click', (e) => {
      e.currentTarget.blur()
      this.close()
    })
    // Закрытие по Escape (не мешает игре — слушатель активен только на экране)
    this._onKeyDown = (e) => {
      if (!this.screen.classList.contains('active')) return
      if (e.key === 'Escape') this.close()
    }
    document.addEventListener('keydown', this._onKeyDown)
  }

  setOnTest(fn) {
    this.onTest = fn
  }

  _buildCards() {
    this.grid.innerHTML = ''
    this.cards = []
    CHARACTERS.forEach(c => {
      const card = document.createElement('article')
      card.className = 'char-card'
      card.dataset.id = c.id

      const previewWrap = document.createElement('div')
      previewWrap.className = 'char-preview-wrap'
      const canvas = document.createElement('canvas')
      canvas.className = 'char-preview'
      previewWrap.appendChild(canvas)

      // MAGA: большое фото вместо превью, 3D-персонаж — маленьким в углу, без вращения фото
      if (c.id === 'maga') {
        card.classList.add('maga-card')
        canvas.classList.add('maga-mini')
        const photo = document.createElement('img')
        photo.className = 'maga-main'
        photo.src = 'sigma.jpg'
        photo.alt = 'MAGA'
        previewWrap.appendChild(photo)
        const fresh = document.createElement('div')
        fresh.className = 'maga-new'
        fresh.textContent = 'NEW'
        previewWrap.appendChild(fresh)
      }

      const body = document.createElement('div')
      body.className = 'char-card-body'

      const name = document.createElement('div')
      name.className = 'char-name'
      name.textContent = c.name

      const ownLine = document.createElement('div')
      ownLine.className = 'char-own'

      const stats = document.createElement('div')
      stats.className = 'char-stats'
      const stat = (icon, val, label) => {
        const s = document.createElement('div')
        s.className = 'char-stat'
        const i = document.createElement('span')
        i.className = 'char-stat-icon'
        i.textContent = icon
        const v = document.createElement('span')
        v.className = 'char-stat-val'
        v.textContent = val
        const t = document.createElement('span')
        t.className = 'char-stat-label'
        t.textContent = label
        s.append(i, v, t)
        return s
      }
      stats.append(
        stat('🛡', '×' + (c.shields || 0), 'SHD'),
        stat('⚔', c.attackRange.toFixed(1) + ' m', 'RNG'),
        stat('💥', String(c.damage), 'DMG'),
        stat('📏', c.height.toFixed(1) + ' m', 'HGT')
      )

      // Оружие: надето одно на всех (любой персонаж носит любое купленное).
      // Нет надетого — врукопашную. Остальное оружие — в разработке.
      const gun = getEquippedWeapon()
      const weaponLine = document.createElement('div')
      weaponLine.className = 'char-weapon' + (gun ? '' : ' locked')
      weaponLine.textContent = gun
        ? gun.icon + ' ' + gun.name + ' · ' + gun.range.toFixed(1) + ' м · НАДЕТО'
        : '🥋 ВРУКОПАШНУЮ'

      const actions = document.createElement('div')
      actions.className = 'char-actions'

      const badge = document.createElement('div')
      badge.className = 'char-badge'
      badge.textContent = 'ВЫБРАН'

      const selectBtn = document.createElement('button')
      selectBtn.className = 'char-select'
      selectBtn.type = 'button'
      selectBtn.textContent = 'ВЫБРАТЬ'

      const testBtn = document.createElement('button')
      testBtn.className = 'char-test'
      testBtn.type = 'button'
      testBtn.textContent = 'ТЕСТИРОВАТЬ'

      const buyBtn = document.createElement('button')
      buyBtn.className = 'char-buy'
      buyBtn.type = 'button'

      actions.append(selectBtn, testBtn, buyBtn)
      body.append(name, ownLine, stats, weaponLine, actions, badge)
      card.append(previewWrap, body)
      this.grid.appendChild(card)

      selectBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        e.currentTarget.blur()
        this._select(c.id)
      })
      testBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        e.currentTarget.blur()
        this._test(c.id)
      })
      buyBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        e.currentTarget.blur()
        this._buy(c.id)
      })
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return
        this._select(c.id)
      })

      this.cards.push({ data: c, card, canvas, ownLine, selectBtn, testBtn, buyBtn })
    })

    this.refreshShop()
    this._refreshSelection()
  }

  // Кошелёк в шапке + состояние карточек.
  // Играбельны только Человек и MAGA. Остальные 🔒 ЗАБЛОКИРОВАНЫ:
  // нет покупки, нет выбора, нет теста.
  refreshShop() {
    const pill = document.getElementById('chars-wallet')
    if (pill) pill.textContent = '\uD83D\uDCB0 ' + formatBalance(getWallet())
    this.cards.forEach(({ data, card, ownLine, selectBtn, testBtn, buyBtn }) => {
      const locked = isLocked(data.id)
      const owned = !locked && isOwned(data.id)
      const buyable = !locked && !owned
      card.classList.toggle('locked', locked || buyable)
      ownLine.textContent = locked
        ? '🔒 ЗАБЛОКИРОВАН'
        : (owned
          ? (data.price === 0 ? '✅ БЕСПЛАТНО · ВАШ' : '✅ ВАШ')
          : '💰 Цена: ' + formatBalance(data.price))
      ownLine.classList.toggle('owned', owned)
      selectBtn.classList.toggle('hidden', !owned)
      testBtn.classList.toggle('hidden', !owned)
      buyBtn.classList.toggle('hidden', !buyable)
      if (buyable) buyBtn.textContent = 'КУПИТЬ · ' + formatBalance(data.price)
    })
  }

  _lockedModal() {
    this.menuManager.showModal('🔒 Персонаж заблокирован. Доступны: Человек (бесплатно) и MAGA ($2,000).')
  }

  // Покупка: хватает (balance >= amount) -> списание, выбор, обновление;
  // иначе модалка «НЕДОСТАТОЧНО ДЕНЕГ» и ничего не списывается.
  _buy(id) {
    if (isLocked(id)) {
      this._lockedModal()
      return
    }
    const c = CHARACTERS.find(x => x.id === id)
    if (!c) return
    const res = buyCharacter(id)
    if (res.ok) {
      this.refreshShop()
      this._select(id)
      return
    }
    if (res.reason === 'insufficient') {
      this.menuManager.showModal(
        '\uD83D\uDCB0 НЕДОСТАТОЧНО ДЕНЕГ — нужно ' + formatBalance(c.price) +
        ', у вас ' + formatBalance(getWallet()) +
        '. Побеждайте ботов и возвращайтесь!'
      )
    }
  }

  _select(id) {
    // Заблокированного и некупленного выбрать нельзя
    if (isLocked(id)) {
      this._lockedModal()
      return
    }
    if (!isOwned(id)) {
      this._buy(id)
      return
    }
    setSelectedCharacterId(id)
    this._refreshSelection()
  }

  _refreshSelection() {
    const selected = getSelectedCharacterId()
    this.cards.forEach(({ data, card }) => {
      card.classList.toggle('selected', data.id === selected)
    })
  }

  _test(id) {
    // Тест заблокированного/некупленного закрыт — иначе это бесплатное использование
    if (isLocked(id)) {
      this._lockedModal()
      return
    }
    if (!isOwned(id)) {
      this._buy(id)
      return
    }
    if (typeof this.onTest === 'function') {
      this.onTest(id)
    }
  }

  open() {
    this.menuManager.hideMenu()
    ensureValidSelection(getSelectedCharacterId())
    this.refreshShop()
    this._refreshSelection()
    this.screen.classList.add('active')
    this.screen.scrollTop = 0
    // Стоп старого цикла, если open вызвали повторно без close
    if (this._raf) cancelAnimationFrame(this._raf)
    this._raf = requestAnimationFrame(this._tick)
  }

  close() {
    this.screen.classList.remove('active')
    if (this._raf) cancelAnimationFrame(this._raf)
    this._raf = null
    this._disposePreviews()
    this.menuManager.showMenu()
  }

  // Вызывается из test-mode: скрыть экран без возврата в меню
  hideForTest() {
    this.screen.classList.remove('active')
    if (this._raf) cancelAnimationFrame(this._raf)
    this._raf = null
    this._disposePreviews()
  }

  // Возврат из test-mode обратно в список персонажей
  returnFromTest() {
    this.refreshShop()
    this._refreshSelection()
    this.screen.classList.add('active')
    this.screen.scrollTop = 0
    if (this._raf) cancelAnimationFrame(this._raf)
    this._raf = requestAnimationFrame(this._tick)
  }

  _ensurePreview(card, index) {
    const pr = this.previews[index]
    if (pr) return pr

    const canvas = card.canvas
    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true })
    } catch (e) {
      return null
    }
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))

    const scene = new THREE.Scene()
    const { group } = createPreviewGroup(card.data.type)
    scene.add(group)

    const ambient = new THREE.AmbientLight(0xffffff, 0.75)
    const key = new THREE.DirectionalLight(0xffffff, 1.15)
    key.position.set(4, 7, 3)
    const rim = new THREE.DirectionalLight(0x9fd0ff, 0.5)
    rim.position.set(-4, 2, -4)
    scene.add(ambient, key, rim)

    // Bounding box ПОСЛЕ нормализации масштаба — центр и размер
    // для точного кадрирования любого роста (Giant/Kong/Dino/Boss).
    const bbox = new THREE.Box3().setFromObject(group)
    const size = bbox.getSize(new THREE.Vector3())
    const center = bbox.getCenter(new THREE.Vector3())

    const preview = { renderer, scene, group, canvas, w: -1, h: -1, bboxSize: size, bboxCenter: center, camera: null }
    this.previews[index] = preview
    return preview
  }

  _disposePreviews() {
    this.previews.forEach(p => {
      if (p && p.renderer) {
        try {
          p.scene.traverse(o => {
            if (o.geometry) o.geometry.dispose()
            if (o.material) {
              const mats = Array.isArray(o.material) ? o.material : [o.material]
              mats.forEach(m => { if (m.dispose) m.dispose() })
            }
          })
          p.renderer.dispose()
          // БЕЗ forceContextLoss: он навсегда убивает контекст canvas,
          // и повторное открытие экрана получало бы мёртвый canvas.
        } catch (e) { /* ignore */ }
      }
    })
    this.previews = []
    // Свежий canvas для каждой карточки — повторное открытие экрана
    // гарантированно получает чистый WebGL-контекст (классы сохраняем).
    this.cards.forEach(entry => {
      try {
        const fresh = document.createElement('canvas')
        fresh.className = entry.canvas.className
        entry.canvas.replaceWith(fresh)
        entry.canvas = fresh
      } catch (e) { /* ignore */ }
    })
  }

  _tick = () => {
    // Экран закрыт — цикл не перезапускаем (защита от утечки RAF)
    if (!this.screen.classList.contains('active')) {
      this._raf = null
      return
    }
    this.cards.forEach((card, i) => {
      try {
        if (!this._isVisible(card.canvas)) return
        const p = this._ensurePreview(card, i)
        if (!p) return
        p.group.rotation.y += 0.008
        this._syncSize(p)
        if (p.camera) p.renderer.render(p.scene, p.camera)
      } catch (e) { /* одна битая карточка не должна ронять весь цикл */ }
    })
    this._raf = requestAnimationFrame(this._tick)
  }

  _syncSize(p) {
    const w = Math.max(p.canvas.clientWidth, 1)
    const h = Math.max(p.canvas.clientHeight, 1)
    if (w === p.w && h === p.h && p.camera) return
    p.renderer.setSize(w, h, false)
    this._fitCamera(p, w, h)
    p.w = w
    p.h = h
  }

  _fitCamera(p, w, h) {
    const scene = p.scene
    let cam = p.camera
    if (!cam) {
      cam = new THREE.PerspectiveCamera(38, w / Math.max(h, 1), 0.1, 100)
      p.camera = cam
      scene.add(cam)
    } else {
      cam.aspect = w / Math.max(h, 1)
      cam.updateProjectionMatrix()
    }
    // Полный рост в кадре: дистанция от макс. размера + fov,
    // смотрим в центр bounding box, небольшой запас 1.25.
    const size = p.bboxSize || new THREE.Vector3(1, 3, 1)
    const center = p.bboxCenter || new THREE.Vector3(0, 1.5, 0)
    const maxDim = Math.max(size.x, size.y, size.z, 0.001)
    const fov = (cam.fov * Math.PI) / 180
    let dist = (maxDim / (2 * Math.tan(fov / 2))) * 1.28
    dist = Math.max(dist, 3.2)
    // Лёгкий диагональный ракурс, как раньше
    cam.position.set(center.x + dist * 0.42, center.y + dist * 0.28, center.z + dist * 0.9)
    cam.lookAt(center.x, center.y, center.z)
    cam.updateProjectionMatrix()
  }

  _isVisible(canvas) {
    const r = canvas.getBoundingClientRect()
    return r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth
  }
}
