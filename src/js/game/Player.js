import * as THREE from 'three'
import { getCharacterById } from '../data/Characters.js'
import { getEquippedWeapon } from '../data/Weapons.js'
import { buildCharacter } from './CharacterFactory.js'

export class Player {
  constructor(scene, characterId, opts = {}) {
    this.scene = scene
    this.group = new THREE.Group()
    this.scene.add(this.group)

    // Выбранный персонаж: статы из Characters.js, баланс из Economy.js,
    // модель из CharacterFactory. Единый источник правды — без дублей.
    this.characterInfo = getCharacterById(characterId)
    this.characterId = this.characterInfo.id
    // Деньги — общий кошелёк в Economy (у Player своего баланса нет)

    // Щиты из статов персонажа: 1 щит = блокирует 1 удар.
    // Кончились — следующий чистый удар выбивает с ринга.
    this.maxShields = this.characterInfo.shields || 0
    this.shields = this.maxShields
    this.punchT = 0

    this.parts = buildCharacter(this.group, this.characterInfo.type)
    this.createShieldBar()
    // Оружие: своё надетое (игрок) или принудительное (боты «Невозможно» с катанами).
    // ВАЖНО: undefined = взять надетое игроком, null = без оружия (боты не копируют игрока).
    this.attachWeaponMesh(opts.weaponId !== undefined ? opts.weaponId : ((getEquippedWeapon() || {}).id || null))
    this.setupAnimation()

    // Позиция персонажа на арене
    this.group.position.set(0, 0, 0)
  }

  // Видимое оружие В РУКЕ: цепляется к правой руке и двигается с ней
  // (замах, ходьба). Позиция — от нижней точки руки, работает у любого роста.
  attachWeaponMesh(gunId) {
    if (!gunId) return
    const gun = { knife: 1, pistol: 1, katana: 1, grenade: 1, ak: 1, mg: 1, bus: 1 }[gunId] ? gunId : null
    if (!gun) return
    const box3 = new THREE.Box3().setFromObject(this.group)
    const size = box3.getSize(new THREE.Vector3())
    const h = Math.max(size.y, 1)
    const s = h / 6 // человек ~1 ед., Kong ~2 ед.
    const weapon = new THREE.Group()

    const steel = new THREE.MeshStandardMaterial({ color: 0xdfe3e8, metalness: 0.7, roughness: 0.25 })
    const dark = new THREE.MeshStandardMaterial({ color: 0x23262e, metalness: 0.5, roughness: 0.4 })
    const gripM = new THREE.MeshStandardMaterial({ color: 0x4a2a1a, metalness: 0.2, roughness: 0.6 })
    const glow = new THREE.MeshStandardMaterial({
      color: 0xffb03a, emissive: 0xff7a1a, emissiveIntensity: 1.2
    })
    const add = (geo, m, x, y, z) => {
      const mesh = new THREE.Mesh(geo, m)
      mesh.position.set(x, y, z)
      mesh.castShadow = true
      weapon.add(mesh)
      return mesh
    }

    if (gun === 'pistol') {
      add(new THREE.BoxGeometry(0.14 * s, 0.2 * s, 0.42 * s), dark, 0, 0, 0) // корпус
      add(new THREE.BoxGeometry(0.09 * s, 0.09 * s, 0.3 * s), glow, 0, 0.03 * s, 0.34 * s) // ствол светится
      add(new THREE.BoxGeometry(0.12 * s, 0.26 * s, 0.14 * s), gripM, 0, -0.2 * s, -0.1 * s) // рукоять
    } else if (gun === 'grenade') {
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * s, 0.13 * s, 0.9 * s, 12), dark)
      tube.rotation.x = Math.PI / 2
      tube.castShadow = true
      weapon.add(tube) // труба гранатомёта
      add(new THREE.BoxGeometry(0.12 * s, 0.24 * s, 0.16 * s), gripM, 0, -0.2 * s, -0.15 * s)
      add(new THREE.SphereGeometry(0.07 * s, 10, 8), glow, 0, 0.14 * s, 0.3 * s) // прицел светится
    } else if (gun === 'ak') {
      add(new THREE.BoxGeometry(0.11 * s, 0.16 * s, 0.7 * s), dark, 0, 0, 0.1 * s) // ствольная коробка
      add(new THREE.BoxGeometry(0.07 * s, 0.07 * s, 0.35 * s), steel, 0, 0.02 * s, 0.6 * s) // ствол
      add(new THREE.BoxGeometry(0.09 * s, 0.3 * s, 0.12 * s), gripM, 0, -0.2 * s, 0.05 * s) // магазин рожком
      add(new THREE.BoxGeometry(0.1 * s, 0.14 * s, 0.3 * s), gripM, 0, -0.05 * s, -0.35 * s) // приклад
    } else if (gun === 'mg') {
      add(new THREE.BoxGeometry(0.16 * s, 0.2 * s, 0.8 * s), dark, 0, 0, 0.1 * s) // корпус
      add(new THREE.BoxGeometry(0.08 * s, 0.08 * s, 0.45 * s), steel, 0, 0.02 * s, 0.7 * s) // ствол
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.16 * s, 0.12 * s, 14), gripM)
      drum.rotation.z = Math.PI / 2
      drum.castShadow = true
      drum.position.set(0, -0.2 * s, 0.05 * s)
      weapon.add(drum) // барабан
      add(new THREE.BoxGeometry(0.1 * s, 0.22 * s, 0.12 * s), gripM, 0, -0.2 * s, -0.3 * s) // рукоять
    } else if (gun === 'bus') {
      // ОГРОМНЫЙ автобус в руке: 3+ м длиной, больше Человека
      weapon.add(buildBusMesh(s))
    } else if (gun === 'katana') {
      add(new THREE.BoxGeometry(0.07 * s, 0.1 * s, 1.35 * s), steel, 0, 0, 0.45 * s) // клинок
      add(new THREE.BoxGeometry(0.22 * s, 0.22 * s, 0.06 * s), dark, 0, 0, -0.25 * s) // гарда
      add(new THREE.BoxGeometry(0.09 * s, 0.11 * s, 0.4 * s), gripM, 0, 0, -0.48 * s) // рукоять
    } else {
      add(new THREE.BoxGeometry(0.08 * s, 0.08 * s, 0.55 * s), steel, 0, 0, 0.15 * s) // лезвие
      add(new THREE.BoxGeometry(0.07 * s, 0.07 * s, 0.3 * s), gripM, 0, 0, -0.27 * s) // рукоять
    }

    // В ладонь правой руки: нижняя точка руки в её локальных координатах
    this.group.updateMatrixWorld(true)
    const armBox = new THREE.Box3().setFromObject(this.parts.rightArm)
    const palm = this.parts.rightArm.worldToLocal(armBox.min.clone())
    weapon.position.set(palm.x, palm.y - 0.15 * s, palm.z + 0.25 * s)
    this.parts.rightArm.add(weapon)
    this.weaponMesh = weapon
  }

  // Смена оружия прямо в бою: снять старое, надеть новое
  setWeapon(gunId) {
    if (this.weaponMesh) {
      try {
        this.parts.rightArm.remove(this.weaponMesh)
        this.weaponMesh.traverse(o => {
          if (o.geometry) o.geometry.dispose()
          if (o.material) {
            const mats = Array.isArray(o.material) ? o.material : [o.material]
            mats.forEach(m => { if (m.dispose) m.dispose() })
          }
        })
      } catch (e) { /* ignore */ }
      this.weaponMesh = null
    }
    this.attachWeaponMesh(gunId)
  }

  // Щиты над головой (вместо здоровья/ника): «🛡×N». Нет щитов — пусто (уязвим).
  createShieldBar() {
    const canvas = document.createElement('canvas')
    canvas.width = 160
    canvas.height = 40
    this._shieldCanvas = canvas

    const texture = new THREE.CanvasTexture(canvas)
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false // всегда поверх геометрии
    })

    // Табличка — над макушкой (считаем по геометрии персонажа)
    const box = new THREE.Box3().setFromObject(this.group)
    const barY = box.max.y + 0.55

    this.shieldBar = new THREE.Sprite(material)
    this.shieldBar.scale.set(2.2, 0.55, 1)
    this.shieldBar.position.set(0, barY, 0)
    this.shieldBar.renderOrder = 999
    this.group.add(this.shieldBar)
    this._drawShieldBar()
  }

  _drawShieldBar() {
    const ctx = this._shieldCanvas.getContext('2d')
    const W = this._shieldCanvas.width, H = this._shieldCanvas.height
    ctx.clearRect(0, 0, W, H)
    if (this.shields > 0) {
      ctx.fillStyle = 'rgba(10, 14, 39, 0.8)'
      ctx.fillRect(10, 2, W - 20, H - 4)
      ctx.strokeStyle = 'rgba(106, 166, 212, 0.8)'
      ctx.lineWidth = 2
      ctx.strokeRect(10, 2, W - 20, H - 4)
      ctx.fillStyle = '#e8edf5'
      ctx.font = 'bold 24px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('\uD83D\uDEE1\u00D7' + this.shields, W / 2, H / 2 + 1)
    }
    if (this.shieldBar) this.shieldBar.material.map.needsUpdate = true
  }

  get alive() {
    return this._knockedOut !== true
  }

  fullRestore() {
    this._knockedOut = false
    this.shields = this.maxShields
    this._drawShieldBar()
  }

  markKnockedOut() {
    this._knockedOut = true
  }

  // Принять удар: щит гасит 1 удар, без щита — выбивание ('ko').
  receiveHit() {
    if (this._knockedOut) return 'down'
    if (this.shields > 0) {
      this.shields -= 1
      this._drawShieldBar()
      return 'blocked'
    }
    return 'ko'
  }

  // Удар (анимация замаха); урон считает GameManager через attackRange
  punch() {
    this.punchT = 0.35
  }

  setupAnimation() {
    this.animationTime = 0
    this.animationSpeed = 0.015
    this.walkTime = 0
  }

  update(deltaTime = 0.016, isMoving = false) {
    this.animationTime += this.animationSpeed

    if (isMoving) {
      // Цикл ходьбы: ноги в противофазе, руки наоборот
      this.walkTime += deltaTime * 8
      const swing = Math.sin(this.walkTime) * 0.6

      this.parts.leftLeg.rotation.x = swing
      this.parts.rightLeg.rotation.x = -swing
      this.parts.leftArm.rotation.x = -swing * 0.5
      this.parts.rightArm.rotation.x = swing * 0.5
      this.parts.leftArm.rotation.z = 0
      this.parts.rightArm.rotation.z = 0

      // Лёгкий наклон корпуса вперёд
      this.parts.body.rotation.x = 0.12
      this.parts.body.rotation.y = 0
      this.parts.head.rotation.y = 0
    } else {
      // Idle: лёгкое покачивание (без поворота головы/корпуса по Y —
      // лицо всегда к камере, чёрный бок не виден)
      this.parts.body.rotation.y = 0
      this.parts.body.rotation.x = 0
      this.parts.body.position.y =
        (this.parts.body.homeY ?? 3.25) + Math.sin(this.animationTime) * 0.05

      this.parts.head.rotation.y = 0

      this.parts.leftArm.rotation.z = Math.sin(this.animationTime * 0.7) * 0.15
      this.parts.rightArm.rotation.z = Math.cos(this.animationTime * 0.7) * 0.15
      this.parts.leftArm.rotation.x = 0
      this.parts.rightArm.rotation.x = 0

      this.parts.leftLeg.rotation.x = Math.sin(this.animationTime * 0.5) * 0.08
      this.parts.rightLeg.rotation.x = Math.cos(this.animationTime * 0.5) * 0.08
    }

    // Удар F: замах правой + клевок головой (у динозавра выглядит как укус).
    // Поверх обычной анимации, гаснет за ~0.35 c.
    if (this.punchT > 0) {
      this.punchT = Math.max(0, this.punchT - deltaTime)
      const k = this.punchT / 0.35
      this.parts.rightArm.rotation.x = -1.5 * k
      this.parts.rightArm.rotation.z = 0
      this.parts.head.rotation.x = 0.35 * k
    } else if (this.parts.head) {
      this.parts.head.rotation.x = 0
    }
  }
}

// Огромный автобус (БОЛЬШЕ Человека): кузов 5 м + окна + колёса.
// Отдельной функцией — тот же автобус летит во врага при броске.
export function buildBusMesh(s) {
  const g = new THREE.Group()
  const busYellow = new THREE.MeshStandardMaterial({ color: 0xe8a13d, metalness: 0.3, roughness: 0.5 })
  const busGlass = new THREE.MeshStandardMaterial({ color: 0x9fd0ff, metalness: 0.6, roughness: 0.2 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x23262e, metalness: 0.5, roughness: 0.4 })
  const add = (geo, m, x, y, z) => {
    const mesh = new THREE.Mesh(geo, m)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    g.add(mesh)
  }
  add(new THREE.BoxGeometry(1.5 * s, 1.5 * s, 5.0 * s), busYellow, 0, 0, 1.6 * s) // кузов 5 м
  add(new THREE.BoxGeometry(1.54 * s, 0.6 * s, 4.0 * s), busGlass, 0, 0.24 * s, 1.6 * s) // окна
  // Крыша-люки
  add(new THREE.BoxGeometry(0.6 * s, 0.1 * s, 0.8 * s), dark, 0, 0.8 * s, 0.6 * s)
  add(new THREE.BoxGeometry(0.6 * s, 0.1 * s, 0.8 * s), dark, 0, 0.8 * s, 2.4 * s)
  ;[-1.4, 1.4].forEach(z => {
    ;[-1, 1].forEach(x => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34 * s, 0.34 * s, 0.2 * s, 12), dark)
      wheel.rotation.z = Math.PI / 2
      wheel.castShadow = true
      wheel.position.set(x * 0.76 * s, -0.84 * s, (1.6 + z) * s)
      g.add(wheel)
    })
  })
  return g
}
