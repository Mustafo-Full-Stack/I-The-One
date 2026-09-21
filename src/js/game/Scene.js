import * as THREE from 'three'

// Арена — крыша высотки (60/80/100 м, 100 этажей вниз).
// Выбитый с крыши падает вниз вдоль стен (как в I'm the One).
// Небо: градиентный купол + солнце + дрейфующие облака.
export class Scene {
  constructor(size, style) {
    this.roofSize = Math.max(30, Math.min(130, Number(size) || 50))
    // Стиль крыши: classic (синий), neon (фиолет), sand (тёплый), gold (золото)
    this.style = Object.assign(
      { floor: '#39485e', floorAlt: '#354357', inner: 0x46586e, glow: 0x35e0ff, emblem: 0x6ad0ff },
      { neon:   { floor: '#3a2a5e', floorAlt: '#332252', inner: 0x4a2a6e, glow: 0xc44dff, emblem: 0xe08aff },
        sand:   { floor: '#5e4a39', floorAlt: '#544335', inner: 0x6e5846, glow: 0xffb03a, emblem: 0xffd25e },
        gold:   { floor: '#4a3d22', floorAlt: '#423620', inner: 0x5e4c28, glow: 0xffd25e, emblem: 0xfff2b5 } }[style] || {}
    )
    this.scene = new THREE.Scene()
    this.clouds = []
    this.setupScene()
  }

  setupScene() {
    this.scene.background = new THREE.Color(0x1a2332)

    // Дальний туман — дом высокий, падение должно быть видно
    this.scene.fog = new THREE.Fog(0x1a2332, 80, 500)

    this.createSky()
    this.createArena()
  }

  // --- Небо ---
  _skyTexture() {
    const c = document.createElement('canvas')
    c.width = 4
    c.height = 256
    const ctx = c.getContext('2d')
    const g = ctx.createLinearGradient(0, 0, 0, 256)
    g.addColorStop(0.0, '#060d24') // зенит
    g.addColorStop(0.45, '#16294d') // верх
    g.addColorStop(0.72, '#3a5a8a') // горизонт
    g.addColorStop(0.85, '#c46a4a') // закатная полоса
    g.addColorStop(1.0, '#1a2332') // низ
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 4, 256)
    const tex = new THREE.CanvasTexture(c)
    return tex
  }

  _glowTexture(inner, outer) {
    const c = document.createElement('canvas')
    c.width = 128
    c.height = 128
    const ctx = c.getContext('2d')
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64)
    g.addColorStop(0, inner)
    g.addColorStop(1, outer)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
    return new THREE.CanvasTexture(c)
  }

  createSky() {
    // Купол неба
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(600, 24, 16),
      new THREE.MeshBasicMaterial({ map: this._skyTexture(), side: THREE.BackSide, fog: false })
    )
    this.scene.add(dome)

    // Солнце
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this._glowTexture('rgba(255, 240, 210, 1)', 'rgba(255, 180, 120, 0)'),
      transparent: true,
      fog: false,
      depthWrite: false
    }))
    sun.scale.set(120, 120, 1)
    sun.position.set(-260, 250, -420)
    this.scene.add(sun)

    // Луна
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this._glowTexture('rgba(235, 242, 255, 1)', 'rgba(150, 180, 230, 0)'),
      transparent: true,
      fog: false,
      depthWrite: false
    }))
    moon.scale.set(70, 70, 1)
    moon.position.set(300, 320, -380)
    this.scene.add(moon)

    // Тёплое свечение города у горизонта
    const horizon = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this._glowTexture('rgba(255, 170, 100, 0.5)', 'rgba(255, 170, 100, 0)'),
      transparent: true,
      fog: false,
      depthWrite: false
    }))
    horizon.scale.set(900, 220, 1)
    horizon.position.set(0, -40, -480)
    this.scene.add(horizon)

    // Звёзды
    const starGeo = new THREE.BufferGeometry()
    const starPos = new Float32Array(400 * 3)
    for (let i = 0; i < 400; i++) {
      const a = Math.random() * Math.PI * 2
      const e = 0.15 + Math.random() * 1.3 // над горизонтом
      const r = 560
      starPos[i * 3] = Math.cos(a) * Math.cos(e) * r
      starPos[i * 3 + 1] = Math.sin(e) * r
      starPos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xcfe0ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85
    }))
    this.scene.add(stars)

    // Облака: мягкие пятна, медленно дрейфуют (см. update) — два яруса
    const cloudTex = this._glowTexture('rgba(220, 232, 245, 0.55)', 'rgba(220, 232, 245, 0)')
    for (let i = 0; i < 12; i++) {
      const cl = new THREE.Sprite(new THREE.SpriteMaterial({
        map: cloudTex,
        transparent: true,
        fog: false,
        depthWrite: false,
        opacity: 0.4 + Math.random() * 0.35
      }))
      const high = i >= 8
      const w = high ? 140 + Math.random() * 160 : 90 + Math.random() * 130
      cl.scale.set(w, w * 0.42, 1)
      const a = Math.random() * Math.PI * 2
      cl.position.set(
        Math.cos(a) * 420,
        high ? 220 + Math.random() * 120 : 90 + Math.random() * 130,
        Math.sin(a) * 420
      )
      cl.userData.speed = 1.2 + Math.random() * 1.8
      this.scene.add(cl)
      this.clouds.push(cl)
    }
  }

  update(frameDt) {
    // Дрейф облаков по кругу
    for (const cl of this.clouds) {
      cl.position.x += cl.userData.speed * frameDt
      if (cl.position.x > 480) cl.position.x = -480
    }
    // Мигание авиа-маяков
    if (this.beaconMat) {
      this._beaconT = (this._beaconT || 0) + frameDt
      this.beaconMat.emissiveIntensity = (Math.sin(this._beaconT * 4) > 0) ? 2.2 : 0.25
    }
  }

  // Земля ночного города + РЯДЫ домов улицами (20–100 этажей, разный размер).
  // Сетка кварталов с пропуском центра (там наша башня).
  createCityBelow() {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 256
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#070b16'
    ctx.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 900; i++) {
      const lit = Math.random() < 0.55
      ctx.fillStyle = lit
        ? (Math.random() < 0.7 ? 'rgba(255, 210, 94, 0.8)' : 'rgba(140, 190, 255, 0.8)')
        : 'rgba(40, 55, 80, 0.6)'
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2)
    }
    const tex = new THREE.CanvasTexture(c)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(8, 8)
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1800, 1800),
      new THREE.MeshBasicMaterial({ map: tex })
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -300
    this.scene.add(ground)

    // Три варианта текстуры под разную высоту (окна не тянутся)
    const winShort = this._windowsTexture()
    winShort.repeat.set(4, 12)
    const winMid = this._windowsTexture()
    winMid.repeat.set(4, 25)
    const winTall = this._windowsTexture()
    winTall.repeat.set(5, 40)
    const texFor = (h) => h < 120 ? winShort : (h < 220 ? winMid : winTall);

    // Кварталы рядами: шаг 95, пропуск центра 1×1
    for (let gx = -2; gx <= 2; gx++) {
      for (let gz = -2; gz <= 2; gz++) {
        if (gx === 0 && gz === 0) continue // наша башня
        const x = gx * 95 + (Math.random() - 0.5) * 14
        const z = gz * 95 + (Math.random() - 0.5) * 14
        const w = 24 + Math.random() * 14 // ширина 24–38
        const hgt = 60 + Math.random() * 240 // высота 60–300 (20–100 этажей)
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(w, hgt, w),
          new THREE.MeshStandardMaterial({ map: texFor(hgt), color: 0xbbbbcc, metalness: 0.1, roughness: 0.9 })
        )
        m.position.set(x, -300 + hgt / 2, z)
        this.scene.add(m)
        // Маяк на высоких соседях
        if (hgt > 200) {
          const b = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), this.beaconMat)
          b.position.set(x, -300 + hgt + 0.6, z)
          this.scene.add(b)
        }
      }
    }
  }

  // Фасад как у реального жилого дома: этажные плиты, окна с рамами,
  // часть окон горит, лоджии с перилами, блоки кондиционеров.
  // Один этаж = 16 px, 32 этажа на тайл.
  _windowsTexture() {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 512 // 32 этажа на тайл, повтор по высоте
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#1b2434' // штукатурка
    ctx.fillRect(0, 0, 256, 512)
    for (let f = 0; f < 32; f++) {
      const y = f * 16
      // Плита перекрытия
      ctx.fillStyle = '#2c3a52'
      ctx.fillRect(0, y, 256, 2)
      const hasBalcony = f % 4 === 2
      for (let x = 0; x < 6; x++) {
        const wx = 10 + x * 42
        const lit = ((x * 7 + f * 13) % 5) < 2
        // Рама
        ctx.fillStyle = '#dfe6ee'
        ctx.fillRect(wx - 1, y + 3, 26, 11)
        // Стекло
        ctx.fillStyle = lit ? '#ffd25e' : '#33506e'
        ctx.fillRect(wx, y + 4, 24, 9)
        // Переплёт
        ctx.fillStyle = 'rgba(20, 28, 40, 0.7)'
        ctx.fillRect(wx + 11, y + 4, 2, 9)
        // Перила лоджии
        if (hasBalcony) {
          ctx.fillStyle = '#0e141f'
          ctx.fillRect(wx - 3, y + 12, 30, 2)
          for (let b = 0; b < 5; b++) ctx.fillRect(wx - 3 + b * 7, y + 6, 1.5, 8)
        }
        // Кондиционер
        if ((x + f) % 9 === 0) {
          ctx.fillStyle = '#3a4556'
          ctx.fillRect(wx + 26, y + 8, 8, 6)
        }
      }
    }
    const tex = new THREE.CanvasTexture(c)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(4, 4) // 4 повтора = ~128 «этажей» по 300 м
    return tex
  }

  createArena() {
    const ROOF = this.roofSize // крыша ROOF×ROOF м
    const half = ROOF / 2

    // Тело 100-этажного дома, крыша на y = 0
    const towerGeo = new THREE.BoxGeometry(ROOF + 2, 300, ROOF + 2)
    const towerMat = new THREE.MeshStandardMaterial({
      map: this._windowsTexture(),
      color: 0xffffff,
      metalness: 0.15,
      roughness: 0.85
    })
    const tower = new THREE.Mesh(towerGeo, towerMat)
    tower.position.set(0, -150, 0)
    this.scene.add(tower)

    // Объём фасада: вертикальные пилястры + карниз под крышей
    const twHalf = (ROOF + 2) / 2
    const pilMat = new THREE.MeshStandardMaterial({ color: 0x232f45, metalness: 0.2, roughness: 0.8 })
    const pilGeo = new THREE.BoxGeometry(0.9, 300, 0.5)
    ;[[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const p1 = new THREE.Mesh(pilGeo, pilMat)
      p1.position.set(sx * (twHalf + 0.1), -150, sz * twHalf * 0.45)
      this.scene.add(p1)
      const p2 = new THREE.Mesh(pilGeo, pilMat)
      p2.position.set(sx * twHalf * 0.45, -150, sz * (twHalf + 0.1))
      p2.rotation.y = Math.PI / 2
      this.scene.add(p2)
    })
    const cornice = new THREE.Mesh(
      new THREE.BoxGeometry(ROOF + 5, 2.2, ROOF + 5),
      new THREE.MeshStandardMaterial({ color: 0x2c3a52, metalness: 0.3, roughness: 0.6 })
    )
    cornice.position.set(0, -1.1, 0)
    this.scene.add(cornice)

    // Красные авиа-маяки на стенах (мигают, см. update)
    this.beaconMat = new THREE.MeshStandardMaterial({
      color: 0xff3b3b, emissive: 0xff2222, emissiveIntensity: 1.5
    })
    this._beaconT = 0
    ;[[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([sx, sz], i) => {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), this.beaconMat)
      const y = -60 - i * 55
      b.position.set(
        sx !== 0 ? sx * (twHalf + 0.4) : (i % 2 ? 9 : -9),
        y,
        sz !== 0 ? sz * (twHalf + 0.4) : (i % 2 ? -9 : 9)
      )
      this.scene.add(b)
    })

    // Ночной город внизу + соседние башни (видно при падении)
    this.createCityBelow()

    // Пол крыши — плитка
    const floorGeometry = new THREE.PlaneGeometry(ROOF, ROOF)
    const floorMaterial = new THREE.MeshStandardMaterial({
      map: this._tilesTexture(),
      color: 0xffffff,
      metalness: 0.15,
      roughness: 0.6
    })
    const floor = new THREE.Mesh(floorGeometry, floorMaterial)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    this.scene.add(floor)

    // Контрастный центр крыши
    const innerFloorGeometry = new THREE.PlaneGeometry(ROOF * 0.68, ROOF * 0.68)
    const innerFloorMaterial = new THREE.MeshStandardMaterial({
      color: this.style.inner,
      metalness: 0.15,
      roughness: 0.6
    })
    const innerFloor = new THREE.Mesh(innerFloorGeometry, innerFloorMaterial)
    innerFloor.rotation.x = -Math.PI / 2
    innerFloor.position.y = 0.05
    innerFloor.receiveShadow = true
    this.scene.add(innerFloor)

    // Эмблема центра: светящееся кольцо (цвет стиля карты)
    const emblem = new THREE.Mesh(
      new THREE.RingGeometry(3.2, 3.7, 48),
      new THREE.MeshBasicMaterial({ color: this.style.emblem, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
    )
    emblem.rotation.x = -Math.PI / 2
    emblem.position.y = 0.08
    this.scene.add(emblem)

    // Низкий парапет по краю (чисто визуальный — через него выбивают)
    this.createRoofCurb(ROOF)

    // Стулья (до 5) + будки + антенна + прожекторы
    this.createChairs(ROOF)
    this.createRoofProps(ROOF)
    this.createFloodlights(ROOF)
  }

  // Плитка пола крыши (цвета — из стиля карты)
  _tilesTexture() {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 256
    const ctx = c.getContext('2d')
    ctx.fillStyle = this.style.floor
    ctx.fillRect(0, 0, 256, 256)
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const odd = (x + y) % 2 === 0
        ctx.fillStyle = odd ? this.style.floor : this.style.floorAlt
        ctx.fillRect(x * 64 + 1, y * 64 + 1, 62, 62)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'
        ctx.fillRect(x * 64 + 1, y * 64 + 1, 62, 6)
      }
    }
    const tex = new THREE.CanvasTexture(c)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(6, 6)
    return tex
  }

  createRoofCurb(roof) {
    const h = 0.5, t = 0.4, half = roof / 2
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1e2a38,
      metalness: 0.4,
      roughness: 0.6
    })
    const mk = (w, d, x, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
      m.position.set(x, h / 2, z)
      m.castShadow = true
      m.receiveShadow = true
      this.scene.add(m)
    }
    mk(roof + t, t, 0, -half)
    mk(roof + t, t, 0, half)
    mk(t, roof + t, -half, 0)
    mk(t, roof + t, half, 0)

    // Светящаяся кромка края — видно границу ринга ночью
    const glowMat = new THREE.MeshBasicMaterial({ color: this.style.glow })
    const gm = (w, d, x, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), glowMat)
      m.position.set(x, h + 0.04, z)
      this.scene.add(m)
    }
    gm(roof + t, 0.12, 0, -half)
    gm(roof + t, 0.12, 0, half)
    gm(0.12, roof + t, -half, 0)
    gm(0.12, roof + t, half, 0)
  }

  // 5 стульев полукругом у южного края — декор крыши
  _makeChair(seatMat, legMat) {
    const chair = new THREE.Group()
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.55), seatMat)
    seat.position.y = 0.46
    seat.castShadow = true
    chair.add(seat)
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, 0.08), seatMat)
    back.position.set(0, 0.8, -0.26)
    back.castShadow = true
    chair.add(back)
    const legGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.46, 6)
    ;[[-0.23, -0.23], [0.23, -0.23], [-0.23, 0.23], [0.23, 0.23]].forEach(([x, z]) => {
      const leg = new THREE.Mesh(legGeo, legMat)
      leg.position.set(x, 0.23, z)
      chair.add(leg)
    })
    return chair
  }

  createChairs(roof) {
    const half = roof / 2
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x7a5c3a, metalness: 0.1, roughness: 0.8 })
    const legMat = new THREE.MeshStandardMaterial({ color: 0x3a3f46, metalness: 0.6, roughness: 0.4 })
    for (let i = 0; i < 5; i++) {
      const chair = this._makeChair(seatMat, legMat)
      const x = -8 + i * 4
      chair.position.set(x, 0, half - 3.2)
      chair.rotation.y = Math.PI + (i - 2) * 0.18 // лицом к центру крыши
      this.scene.add(chair)
    }
  }

  createRoofProps(roof) {
    const half = roof / 2
    const boxMat = new THREE.MeshStandardMaterial({
      color: 0x2b3648,
      metalness: 0.3,
      roughness: 0.7
    })
    // Вентбудки у дальнего края (внутри крыши, бою не мешают)
    ;[[-1, -1], [1, -1]].forEach(([sx, sz]) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 2.4), boxMat)
      b.position.set(sx * (half - 3), 0.9, sz * (half - 3))
      b.castShadow = true
      b.receiveShadow = true
      this.scene.add(b)
    })
    // Антенна с красным маяком
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.16, 6, 8),
      new THREE.MeshStandardMaterial({ color: 0x76828a, metalness: 0.7, roughness: 0.4 })
    )
    pole.position.set(half - 1.5, 3, half - 1.5)
    pole.castShadow = true
    this.scene.add(pole)
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 12, 10),
      new THREE.MeshStandardMaterial({
        color: 0xff3b3b, emissive: 0xff2222, emissiveIntensity: 1.2
      })
    )
    beacon.position.set(half - 1.5, 6.2, half - 1.5)
    this.scene.add(beacon)
  }

  // Прожекторы по углам — световые столбы крыши
  createFloodlights(roof) {
    const half = roof / 2
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3f46, metalness: 0.6, roughness: 0.4 })
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xfff2cc, emissive: 0xffedb5, emissiveIntensity: 1.5
    })
    ;[[-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 5, 8), poleMat)
      pole.position.set(sx * (half - 1.2), 2.5, sz * (half - 1.2))
      pole.castShadow = true
      this.scene.add(pole)
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.4, 0.4), headMat)
      head.position.set(sx * (half - 1.2), 5.1, sz * (half - 1.2))
      head.rotation.y = sx * 0.6
      this.scene.add(head)
      // Конус света вниз (дешёвый фейк-прожектор без реального света)
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(3.2, 5, 16, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0xfff2cc, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false
        })
      )
      cone.position.set(sx * (half - 1.2), 2.5, sz * (half - 1.2))
      this.scene.add(cone)
    })
  }

  getScene() {
    return this.scene
  }
}
