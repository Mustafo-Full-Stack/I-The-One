import * as THREE from 'three'
import { getSelectedCharacterId, getCharacterById, formatBalance } from './data/Characters.js'
import { getWallet } from './data/Economy.js'
import { getEquippedWeapon } from './data/Weapons.js'
import { createPreviewGroup } from './game/CharacterFactory.js'

export class MenuManager {
  constructor() {
    this.menuContainer = document.getElementById('main-menu')
    this.modal = document.getElementById('modal')
    this.modalText = document.getElementById('modal-text')
    this.modalCloseBtn = document.getElementById('modal-close')
    this.heroCanvas = document.getElementById('menu-hero-canvas')
    this.heroName = document.getElementById('menu-hero-name')
    this.heroStats = document.getElementById('menu-hero-stats')

    // Живое 3D-превью выбранного персонажа (как в реальных играх).
    // Рендер один на всё меню, переживает hide/show — только стоп RAF.
    this._hero = null
    this._heroCharId = null
    this._heroRaf = null

    this.setupModalClose()
    this.refreshMainBalance()
    // Меню видно сразу при загрузке — запускаем героя
    this._setHeroCharacter(getSelectedCharacterId())
    if (!this._heroRaf) this._heroRaf = requestAnimationFrame(this._heroTick)
  }

  // Основной баланс на главном экране: выбранный персонаж + его деньги.
  // Обновляется при каждом показе меню (после побед тоже).
  refreshMainBalance() {
    const el = document.getElementById('menu-balance')
    if (!el) return
    const id = getSelectedCharacterId()
    const info = getCharacterById(id)
    el.textContent = ''
    const name = document.createElement('span')
    name.textContent = '\u2605 ' + info.name + '  '
    const money = document.createElement('span')
    money.className = 'menu-money'
    money.textContent = '\uD83D\uDCB0 ' + formatBalance(getWallet())
    el.append(name, money)
    this._refreshHeroInfo(info)
  }

  _refreshHeroInfo(info) {
    if (!info) return
    if (this.heroName) this.heroName.textContent = info.name
    if (this.heroStats) {
      const gun = getEquippedWeapon()
      this.heroStats.textContent =
        '\uD83D\uDEE1×' + (info.shields || 0) +
        '  ⚔ ' + info.attackRange.toFixed(1) + ' м' +
        '  💥 ' + info.damage +
        (gun ? '  ' + gun.icon + ' ' + gun.name : '')
    }
  }

  _ensureHero() {
    if (this._hero || !this.heroCanvas) return
    try {
      const renderer = new THREE.WebGLRenderer({ canvas: this.heroCanvas, antialias: true, alpha: true })
      renderer.setClearColor(0x000000, 0)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      const scene = new THREE.Scene()
      scene.add(new THREE.AmbientLight(0xffffff, 0.8))
      const key = new THREE.DirectionalLight(0xffffff, 1.2)
      key.position.set(4, 7, 3)
      const rim = new THREE.DirectionalLight(0x9fd0ff, 0.6)
      rim.position.set(-4, 2, -4)
      scene.add(key, rim)
      // Пьедестал под персонажем
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(1.7, 40),
        new THREE.MeshBasicMaterial({ color: 0x2a6a9a, transparent: true, opacity: 0.35 })
      )
      disc.rotation.x = -Math.PI / 2
      disc.position.y = 0.02
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.7, 1.85, 48),
        new THREE.MeshBasicMaterial({ color: 0x6ad0ff, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
      )
      ring.rotation.x = -Math.PI / 2
      ring.position.y = 0.02
      scene.add(disc, ring)
      this._hero = { renderer, scene, group: null, camera: null, w: -1, h: -1, center: null, maxDim: 3.2 }
    } catch (e) {
      this._hero = null
    }
  }

  _setHeroCharacter(id) {
    this._ensureHero()
    if (!this._hero || this._heroCharId === id) return
    const info = getCharacterById(id)
    // Сносим старую модель (чистим геометрию/материалы)
    if (this._hero.group) {
      this._hero.scene.remove(this._hero.group)
      this._hero.group.traverse(o => {
        if (o.geometry && !o.userData.shared) o.geometry.dispose()
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material]
          mats.forEach(m => { if (m.dispose) m.dispose() })
        }
      })
    }
    const { group } = createPreviewGroup(info.type)
    this._hero.scene.add(group)
    const bbox = new THREE.Box3().setFromObject(group)
    this._hero.center = bbox.getCenter(new THREE.Vector3())
    this._hero.maxDim = Math.max(bbox.getSize(new THREE.Vector3()).x, 3.2, 0.001)
    this._hero.group = group
    this._heroCharId = id
    this._refreshHeroInfo(info)
  }

  _fitHeroCamera() {
    const h = this._hero
    const w = Math.max(this.heroCanvas.clientWidth, 1)
    const hh = Math.max(this.heroCanvas.clientHeight, 1)
    if (w === h.w && hh === h.h && h.camera) return
    h.renderer.setSize(w, hh, false)
    if (!h.camera) {
      h.camera = new THREE.PerspectiveCamera(36, w / hh, 0.1, 100)
      h.scene.add(h.camera)
    } else {
      h.camera.aspect = w / hh
    }
    const fov = (h.camera.fov * Math.PI) / 180
    const dist = Math.max(3.4, (h.maxDim / (2 * Math.tan(fov / 2))) * 1.35)
    const c = h.center || new THREE.Vector3(0, 1.6, 0)
    h.camera.position.set(c.x + dist * 0.4, c.y + dist * 0.3, c.z + dist * 0.92)
    h.camera.lookAt(c.x, c.y, c.z)
    h.camera.updateProjectionMatrix()
    h.w = w
    h.h = hh
  }

  _heroTick = () => {
    if (!this.menuContainer.classList.contains('hidden') && this._hero && this._hero.group) {
      try {
        this._hero.group.rotation.y += 0.01
        this._fitHeroCamera()
        this._hero.renderer.render(this._hero.scene, this._hero.camera)
      } catch (e) { /* один битый кадр — пропускаем */ }
    }
    if (!this.menuContainer.classList.contains('hidden')) {
      this._heroRaf = requestAnimationFrame(this._heroTick)
    } else {
      this._heroRaf = null
    }
  }

  showMenu() {
    this.refreshMainBalance()
    this.menuContainer.classList.remove('hidden')
    this._setHeroCharacter(getSelectedCharacterId())
    if (!this._heroRaf) this._heroRaf = requestAnimationFrame(this._heroTick)
  }

  hideMenu() {
    this.menuContainer.classList.add('hidden')
    if (this._heroRaf) cancelAnimationFrame(this._heroRaf)
    this._heroRaf = null
  }

  showModal(text) {
    this.modalText.textContent = text
    this.modal.classList.add('active')
  }

  hideModal() {
    this.modal.classList.remove('active')
  }

  setupModalClose() {
    this.modalCloseBtn.addEventListener('click', (e) => {
      e.currentTarget.blur()
      this.hideModal()
    })

    // Закрытие модального окна при клике вне его
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hideModal()
      }
    })
  }
}
