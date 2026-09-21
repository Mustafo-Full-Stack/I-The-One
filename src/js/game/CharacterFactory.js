import * as THREE from 'three'

// -------- Вспомогательные функции сборки (все примитивы, лёгкие) --------

function mat(color, metalness = 0.15, roughness = 0.7, emissive = 0, emissiveIntensity = 0) {
  const o = { color, metalness, roughness }
  if (emissive) { o.emissive = emissive; o.emissiveIntensity = emissiveIntensity }
  return new THREE.MeshStandardMaterial(o)
}

function addMesh(p, geo, m, x, y, z, rx, ry, rz, sx, sy, sz) {
  const mesh = new THREE.Mesh(geo, m)
  mesh.position.set(x, y, z)
  if (rx || ry || rz) mesh.rotation.set(rx, ry, rz)
  if (sx !== 1 || sy !== 1 || sz !== 1) mesh.scale.set(sx, sy, sz)
  mesh.castShadow = true
  mesh.receiveShadow = true
  if (p) p.add(mesh)
  return mesh
}

function box(p, x, y, z, w, h, d, m, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  return addMesh(p, new THREE.BoxGeometry(w, h, d), m, x, y, z, rx, ry, rz, sx, sy, sz)
}

function sph(p, x, y, z, r, m, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  return addMesh(p, new THREE.SphereGeometry(r, 20, 16), m, x, y, z, rx, ry, rz, sx, sy, sz)
}

function cyl(p, x, y, z, rt, rb, h, m, rx = 0, rz = 0, seg = 14) {
  return addMesh(p, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z, rx, 0, rz, 1, 1, 1)
}

function cone(p, x, y, z, r, h, m, rx = 0, rz = 0, seg = 6) {
  return addMesh(p, new THREE.ConeGeometry(r, h, seg), m, x, y, z, rx, 0, rz, 1, 1, 1)
}

function torus(p, x, y, z, r, tube, m, rx = 0, ry = 0, rz = 0) {
  return addMesh(p, new THREE.TorusGeometry(r, tube, 8, 20), m, x, y, z, rx, ry, rz, 1, 1, 1)
}

// -------- Лицо для человекоподобных --------

// Голова-шар в группе head лежит на (0, r + 0.15, 0) — здесь строим лицо вокруг центра шара
function attachFace(head, r, skin, hair) {
  const F = new THREE.Group()
  F.position.set(0, r + 0.15, 0)
  head.add(F)

  // Волосы: колпак-полусфера с «рваной» чёлкой
  const capGeo = new THREE.SphereGeometry(r + 0.16, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.54)
  const cap = new THREE.Mesh(capGeo, mat(hair, 0.05, 0.85))
  cap.position.set(0, 0.06, -0.04)
  cap.scale.set(1.02, 1.12, 1.04)
  cap.castShadow = true
  F.add(cap)

  box(F, 0, r * 0.42, r * 0.94, r * 0.8, r * 0.15, r * 0.16, mat(hair, 0.05, 0.85), 0, 0, -0.15)
  // Боковые пряди
  ;[-1, 1].forEach(s => box(F, s * r * 0.86, r * 0.2, r * 0.1, r * 0.2, r * 0.7, r * 0.22, mat(hair, 0.05, 0.85)))

  // Глаза (белок + зрачок + блик)
  const white = mat(0xffffff, 0.0, 0.3)
  const pupil = mat(0x141414, 0.0, 0.35)
  ;[-1, 1].forEach(s => {
    sph(F, s * r * 0.38, r * 0.14, r * 0.88, r * 0.17, white)
    sph(F, s * r * 0.38, r * 0.14, r * 0.88 + r * 0.17 * 0.6, r * 0.09, pupil)
    sph(F, s * r * 0.38 + r * 0.06, r * 0.14 + r * 0.07, r * 0.88 + r * 0.17 * 0.78, r * 0.028, mat(0xffffff))
  })

  // Брови
  ;[-1, 1].forEach(s => box(F, s * r * 0.38, r * 0.34, r * 0.92, r * 0.26, r * 0.06, r * 0.09, mat(hair, 0.05, 0.85), 0, 0, s > 0 ? -0.12 : 0.12))

  // Нос, рот, уши
  sph(F, 0, r * 0.02, r * 0.96, r * 0.13, mat(skin, 0.0, 0.6))
  box(F, 0, -r * 0.44, r * 0.94, r * 0.42, r * 0.05, r * 0.08, mat(0x8a3a3a, 0.0, 0.45))
  ;[-1, 1].forEach(s => sph(F, s * r * 0.92, r * 0.05, 0, r * 0.16, mat(skin, 0.0, 0.6)))
}

// -------- Гуманоидный каркас с шарнирами (плечи/бёдра) --------

function humanoid(parent, cfg) {
  const s = cfg.scale || 1
  const headR = (cfg.headRadius ?? 1.1) * s
  const bodyY = (cfg.bodyY ?? 3.35) * s
  const [bw, bh, bd] = cfg.body || [1.9, 2.7, 1.05]
  const skin = cfg.skin || 0xd9a468

  // Туловище
  const body = new THREE.Group()
  body.position.set(0, bodyY, 0)
  parent.add(body)
  body.homeY = bodyY
  box(body, 0, 0, 0, bw, bh, bd, cfg.bodyMat)
  if (cfg.chest) box(body, 0, bh * 0.22, bd * 0.55, bw * 0.6, bh * 0.48, bd * 0.1, cfg.chest)
  if (cfg.collar) box(body, 0, bh * 0.5, -0.02, bw * 0.72, bh * 0.16, bd * 0.2, cfg.collar)
  if (cfg.belt) box(body, 0, -bh * 0.12, 0, bw * 1.06, bh * 0.13, bd * 1.08, cfg.belt)

  // Ноги (шарнир на бедре)
  const hipY = bodyY - bh * 0.5
  const legX = (cfg.legX ?? 0.58) * s
  const lw = (cfg.legW ?? 0.62) * s
  const lh = (cfg.legH ?? (hipY + 0.05)) 
  const mkLeg = (side) => {
    const g = new THREE.Group()
    g.position.set(side * legX, hipY, 0)
    parent.add(g)
    box(g, 0, -lh * 0.44, 0, lw, lh, lw, cfg.legMat)
    box(g, side * 0.04, -lh - 0.12, 0.1, lw * 1.45, 0.24, lw * 1.8, cfg.shoeMat || cfg.legMat)
    return g
  }
  const leftLeg = mkLeg(-1)
  const rightLeg = mkLeg(1)

  // Руки (шарнир на плече)
  const shX = (cfg.armX ?? 1.32) * s
  const shY = bodyY + bh * 0.42
  // Руки — до бёдер, как у реального человека (кисть чуть ниже бедра),
  // а не до земли. Формула от плеча до бедра + небольшой запас.
  const ah = (cfg.armH ?? (shY - hipY + 0.35))
  const aw = (cfg.armW ?? 0.5) * s
  const handR = (cfg.handR ?? 0.28) * s
  const mkArm = (side) => {
    const g = new THREE.Group()
    g.position.set(side * shX, shY, 0)
    parent.add(g)
    box(g, 0, -ah * 0.44 - 0.05, 0, aw, ah, aw, cfg.armMat)
    sph(g, 0, -ah * 0.88 - 0.12, 0.06, handR, cfg.handMat || mat(skin, 0.05, 0.7))
    return g
  }
  const leftArm = mkArm(-1)
  const rightArm = mkArm(1)

  // Шея + голова (шарнир на шее)
  const head = new THREE.Group()
  head.position.set(0, bodyY + bh * 0.48, 0)
  parent.add(head)
  sph(head, 0, headR + 0.15, 0, headR, cfg.headMat || mat(skin, 0.0, 0.6))

  const parts = { head, body, leftArm, rightArm, leftLeg, rightLeg }
  if (cfg.face) attachFace(head, headR, cfg.face[0], cfg.face[1])
  return parts
}

// -------- Персонажи --------

// Человек: спортивная одежда, аккуратные пропорции
const buildHuman = (p) => humanoid(p, {
  skin: 0xd9a468,
  face: [0xd9a468, 0x1e140c],
  body: [1.9, 2.7, 1.05],
  bodyMat: mat(0x3f7fb0, 0.25, 0.55),
  collar: mat(0xf2f6fa, 0.05, 0.7),
  chest: mat(0x4a8fc2, 0.2, 0.55),
  belt: mat(0x20242e, 0.2, 0.6),
  armMat: mat(0x3f7fb0, 0.25, 0.55),
  handMat: mat(0xd9a468, 0.05, 0.7),
  legMat: mat(0x2b3140, 0.2, 0.6),
  shoeMat: mat(0x171c26, 0.05, 0.6)
})

// Воин: шлем с гребнем, щит, меч, латы
const buildWarrior = (p) => {
  const r = 1.1
  const parts = humanoid(p, {
    headRadius: r,
    face: null,
    body: [2.0, 2.7, 1.15],
    bodyMat: mat(0x4a5a6b, 0.55, 0.45),
    chest: mat(0x67798c, 0.6, 0.35),
    belt: mat(0x57322d, 0.3, 0.5),
    collar: mat(0x67798c, 0.6, 0.4),
    armMat: mat(0x4a5a6b, 0.55, 0.45),
    handMat: mat(0x3a4350, 0.5, 0.5),
    legMat: mat(0x3a4451, 0.5, 0.45),
    shoeMat: mat(0x2a2f38, 0.3, 0.5),
    armX: 1.38,
    armW: 0.55
  })

  // Шлем с прорезью-наголовником
  const helm = new THREE.Mesh(new THREE.SphereGeometry(r + 0.2, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.62))
  helm.position.set(0, r + 0.15, -0.04)
  helm.scale.set(1.03, 1.06, 1.06)
  helm.material = mat(0x7b8ea6, 0.6, 0.35)
  helm.castShadow = true
  parts.head.add(helm)

  // Забрало (тёмная полоса-тень поверх глаз)
  box(parts.head, 0, r + 0.15, r * 0.98, r * 1.5, r * 0.22, r * 0.3, mat(0x171c24, 0.4, 0.5), 0, 0, 0)

  // Гребень + плюмаж
  cyl(parts.head, 0, r + 1.1, 0, 0.09, 0.09, 0.6, mat(0x9c1e2e, 0.4, 0.5))
  sph(parts.head, 0, r + 1.5, 0, 0.2, mat(0xc2333f, 0.1, 0.6))

  // Наплечники
  ;[-1, 1].forEach(s => {
    const armPivot = s === -1 ? parts.leftArm : parts.rightArm
    sph(armPivot, 0, 0.05, -0.08, 0.8, mat(0x7b8ea6, 0.6, 0.35), 0, 0, 0, 1.0, 0.85, 1.15)
  })

  // Щит на левой руке
  const shield = sph(null, 0, -1.85, -0.5, 0.62, mat(0x8a2b2b, 0.4, 0.4))
  shield.scale.set(1.2, 1.2, 0.35)
  parts.leftArm.add(shield)
  sph(parts.leftArm, 0, -1.85, -0.72, 0.28, mat(0xc9a23d, 0.6, 0.3))

  // Меч в правой руке
  box(parts.rightArm, 0, -1.9, 0.18, 0.16, 1.9, 0.08, mat(0xdfe3e8, 0.7, 0.25), 0, 0, 0.15)
  box(parts.rightArm, 0, -1.0, 0.18, 0.34, 0.12, 0.16, mat(0xc9a23d, 0.6, 0.3))
  box(parts.rightArm, 0, -0.7, 0.18, 0.14, 0.5, 0.14, mat(0x4a2a1a, 0.2, 0.6))

  return parts
}

// Ниндзя: худой, маска, красный пояс
const buildNinja = (p) => {
  const parts = humanoid(p, {
    skin: 0xc8a07a,
    face: [0xc8a07a, 0x14161c],
    body: [1.55, 2.75, 0.95],
    bodyMat: mat(0x191d26, 0.3, 0.5),
    chest: mat(0x232837, 0.35, 0.5),
    belt: mat(0xd43a4f, 0.15, 0.55),
    collar: mat(0x191d26, 0.3, 0.5),
    armMat: mat(0x1b1f29, 0.3, 0.55),
    handMat: mat(0x101218, 0.3, 0.5),
    legMat: mat(0x13161d, 0.3, 0.5),
    shoeMat: mat(0x0c0e13, 0.3, 0.5),
    armX: 1.28,
    armW: 0.46,
    legX: 0.54,
    legW: 0.52,
    handR: 0.25
  })

  // Повязка на лбу + хвосты
  const r = 1.1
  const cy = r + 0.15
  box(parts.head, 0, cy + r * 0.18, r * 0.82, r * 1.75, r * 0.3, r * 0.34, mat(0xd43a4f, 0.15, 0.55), 0, 0.02, -0.25)
  box(parts.head, 0, cy + r * 0.08, -r * 1.2, r * 0.13, r * 0.1, r * 0.6, mat(0xd43a4f, 0.15, 0.55))
  return parts
}

// MAGA: светлая кожа, красная футбольная форма с MAGA/10 на спине,
// стрижка Кроп + Мид Фейд: рваный послойный верх, прямая чёлка,
// дымчатый переход на боках, чёткая окантовка. Рост 1.7, щит 1.
const buildMaga = (p) => {
  const SKIN = 0x7c5134 // чёрный + белый: средний смуглый тон (−10% яркости)
  const HAIR = mat(0x111114, 0.05, 0.9)
  const RED = mat(0xc22333, 0.25, 0.55)
  const parts = humanoid(p, {
    skin: SKIN,
    face: null, // лицо рисуем сами (иначе шапка волос закроет кроп)
    body: [1.8, 2.7, 1.0],
    bodyMat: RED,
    chest: mat(0xa11b29, 0.25, 0.55),
    belt: mat(0x8a1620, 0.25, 0.55),
    collar: mat(0xffffff, 0.05, 0.7),
    armMat: RED,
    handMat: mat(SKIN, 0.05, 0.7),
    legMat: mat(SKIN, 0.05, 0.7), // голые ноги из-под шорт
    shoeMat: mat(0x14151a, 0.3, 0.5),
    armX: 1.32,
    armW: 0.5,
    armH: 2.9 // руки до бёдер, как у реального человека (не до земли)
  })

  // Красные шорты поверх бёдер
  box(p, 0, 1.85, 0, 1.85, 0.95, 1.0, mat(0xa11b29, 0.25, 0.55))

  // Надпись на спине: MAGA + номер 10.
  // Плоскость развёрнута на спину (rotation.y = PI) — текст на канвасе
  // рисуем как обычно, он читается правильно.
  const numCanvas = document.createElement('canvas')
  numCanvas.width = 256
  numCanvas.height = 256
  const nctx = numCanvas.getContext('2d')
  nctx.clearRect(0, 0, 256, 256)
  nctx.textAlign = 'center'
  nctx.textBaseline = 'middle'
  // MAGA — с разрядкой, белым с тёмно-красной окантовкой
  nctx.font = 'bold 40px sans-serif'
  nctx.lineWidth = 6
  nctx.strokeStyle = '#7a1010'
  nctx.strokeText('M A G A', 128, 58)
  nctx.fillStyle = '#ffffff'
  nctx.fillText('M A G A', 128, 58)
  // 10 — крупно, с окантовкой
  nctx.font = 'bold 130px sans-serif'
  nctx.lineWidth = 10
  nctx.strokeStyle = '#7a1010'
  nctx.strokeText('10', 128, 168)
  nctx.fillStyle = '#ffffff'
  nctx.fillText('10', 128, 168)
  const numTex = new THREE.CanvasTexture(numCanvas)
  const numPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 1.5),
    new THREE.MeshBasicMaterial({ map: numTex, transparent: true })
  )
  numPlane.position.set(0, 0.15, -0.52)
  numPlane.rotation.y = Math.PI
  parts.body.add(numPlane)

  // --- Лицо: глаза реалистичнее (белок + каряя радужка + зрачок + блик + веки) ---
  const r = 1.1
  const cy = r + 0.15
  const skinM = mat(SKIN, 0.0, 0.6)
  const white = mat(0xf2ede4, 0.0, 0.35)
  const irisM = mat(0x111111, 0.0, 0.35) // глаза чёрные, не шоколадные
  const pupil = mat(0x000000, 0.0, 0.3)
  const glint = mat(0xffffff, 0.0, 0.2)
  ;[-1, 1].forEach(s => {
    const ex = s * r * 0.38, ey = cy + r * 0.14, ez = r * 0.88
    sph(parts.head, ex, ey, ez, r * 0.19, white) // белок чуть больше
    sph(parts.head, ex, ey, ez + r * 0.13, r * 0.115, irisM) // радужка
    sph(parts.head, ex, ey, ez + r * 0.19, r * 0.06, pupil) // зрачок
    sph(parts.head, ex + r * 0.05, ey + r * 0.06, ez + r * 0.235, r * 0.025, glint) // блик
    // Верхнее веко — тёмная линия над глазом
    box(parts.head, ex, ey + r * 0.21, ez + r * 0.02, r * 0.42, r * 0.07, r * 0.12, HAIR)
  })
  ;[-1, 1].forEach(s => box(parts.head, s * r * 0.38, cy + r * 0.36, r * 0.92, r * 0.26, r * 0.06, r * 0.09, HAIR, 0, 0, s > 0 ? -0.1 : 0.1))
  sph(parts.head, 0, cy + r * 0.02, r * 0.96, r * 0.13, skinM)
  // Губы чётче: тёмный контур + внутренняя часть
  box(parts.head, 0, cy - r * 0.44, r * 0.94, r * 0.48, r * 0.09, r * 0.1, mat(0x5c2424, 0.0, 0.5))
  box(parts.head, 0, cy - r * 0.44, r * 0.945, r * 0.34, r * 0.045, r * 0.07, mat(0x9c4a4a, 0.0, 0.5))
  // Лёгкая тень скул для объёма лица
  ;[-1, 1].forEach(s => box(parts.head, s * r * 0.62, cy - r * 0.12, r * 0.72, r * 0.3, r * 0.22, r * 0.1, mat(0x6e4530, 0.0, 0.7)))
  ;[-1, 1].forEach(s => sph(parts.head, s * r * 0.92, cy + r * 0.05, 0, r * 0.16, skinM))

  // --- Волосы: угольно-чёрный гладкий боб («горшок») ---
  // Купол сверху
  const bobCap = new THREE.Mesh(
    new THREE.SphereGeometry(r + 0.18, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.58),
    HAIR
  )
  bobCap.position.set(0, cy + 0.02, -0.05)
  bobCap.scale.set(1.02, 1.05, 1.04)
  bobCap.castShadow = true
  parts.head.add(bobCap)
  // Ровная гладкая чёлка: выше глаз, лоб закрыт, до носа не достаёт
  box(parts.head, 0, cy + r * 0.55, r * 0.88, r * 1.7, r * 0.25, r * 0.3, HAIR)
  // Боковины боба до ушей
  ;[-1, 1].forEach(s => box(parts.head, s * r * 0.88, cy - r * 0.15, -0.05, r * 0.28, r * 0.9, r * 0.9, HAIR))
  // Затылок боба
  box(parts.head, 0, cy - r * 0.1, -r * 0.92, r * 1.55, r * 1.0, r * 0.3, HAIR)

  // --- Чёрные спортивные очки: облегающие, глянцевые тёмные линзы ---
  const lensM = new THREE.MeshStandardMaterial({
    color: 0x0a0d12, metalness: 0.9, roughness: 0.12
  })
  // Единая линза-визор через оба глаза (впереди глаз — глаза не торчат)
  box(parts.head, 0, cy + r * 0.14, r * 1.02, r * 1.66, r * 0.42, r * 0.22, lensM)
  // Дужки к ушам
  ;[-1, 1].forEach(s => box(parts.head, s * r * 0.88, cy + r * 0.16, r * 0.35, r * 0.1, r * 0.12, r * 1.2, lensM))
  // Переносица
  box(parts.head, 0, cy + r * 0.1, r * 1.05, r * 0.22, r * 0.14, r * 0.16, lensM)
  // Глянцевый блик на линзе
  box(parts.head, -0.4, cy + r * 0.22, r * 1.1, r * 0.5, r * 0.06, r * 0.05, mat(0xffffff, 0.0, 0.15), 0, 0, -0.35)
  // (боковины и затылок уже закрыты бобом — фейд не нужен)
  return parts
}

// Король: корона с рубином, мантия, золото
const buildKing = (p) => {
  const r = 1.1
  const parts = humanoid(p, {
    skin: 0xd9b38c,
    face: [0xd9b38c, 0xcfd4da],
    body: [2.1, 2.8, 1.15],
    bodyMat: mat(0x5a2d82, 0.35, 0.5),
    collar: mat(0xffc23d, 0.6, 0.3),
    chest: mat(0x6b3a99, 0.35, 0.5),
    belt: mat(0xffc23d, 0.6, 0.3),
    armMat: mat(0x4a2470, 0.35, 0.5),
    handMat: mat(0xd9b38c, 0.05, 0.7),
    legMat: mat(0x3f2358, 0.35, 0.5),
    shoeMat: mat(0x2a183d, 0.2, 0.5),
    armX: 1.42,
    armW: 0.55
  })

  // Мантия позади
  box(p, 0, 3.3, -1.05, 2.5, 3.5, 0.3, mat(0x7a2150, 0.15, 0.85))
  sph(p, 0, 3.35, -1.1, 0.55, mat(0x7a2150, 0.15, 0.85))

  // Корона
  const cy = r + 0.15
  const gold = mat(0xffc23d, 0.65, 0.25)
  cyl(parts.head, 0, cy + 0.85, -0.1, 0.82, 0.88, 0.6, gold, 0, 0, 14)
  torus(parts.head, 0, cy + 0.85, -0.1, 0.85, 0.07, gold, Math.PI / 2, 0, 0)
  ;[-0.55, 0, 0.55].forEach(x => cone(parts.head, x, cy + 1.4, -0.12, 0.16, 0.42, gold))
  sph(parts.head, 0, cy + 1.02, 1.05, 0.2, mat(0xd2212e, 0.1, 0.4, 0xd2212e, 0.8))

  return parts
}

function buildPrimate(p, scale, fur, belly, faceFur) {
  const s = scale || 1
  const furM = mat(fur, 0.0, 0.95)
  const bellyM = mat(belly, 0.0, 0.9)
  const faceM = mat(faceFur, 0.0, 0.85)

  // Приземистое тело с брюхом
  const body = new THREE.Group()
  body.position.set(0, 1.7 * s, 0)
  p.add(body)
  body.homeY = 1.7 * s
  sph(body, 0, 0.35 * s, 0, 1.05 * s, furM, 0, 0, 0, 1.15, 1.05, 0.95)
  sph(body, 0, 0.15 * s, 0.55 * s, 0.85 * s, bellyM, 0, 0, 0, 1.05, 1.1, 0.9)

  // Голова с мордой
  const head = new THREE.Group()
  head.position.set(0, 2.6 * s, 0.1 * s)
  p.add(head)
  sph(head, 0, 0.75 * s, 0, 0.72 * s, furM)
  sph(head, 0, 0.55 * s, 0.78 * s, 0.5 * s, faceM, 0, 0, 0, 0.9, 0.85, 0.95)

  // Брови-козырёк + глаза
  box(head, 0, 0.95 * s, 0.66 * s, 0.9 * s, 0.22 * s, 0.5 * s, furM, 0, 0, -0.12)
  sph(head, 0, 0.88 * s, 1.0 * s, 0.1 * s, mat(0x141414, 0.05, 0.3))
  sph(head, 0, 0.72 * s, 1.08 * s, 0.05 * s, mat(0x141414, 0.05, 0.3))
  // Ноздри
  sph(head, 0, 0.5 * s, 1.08 * s, 0.06 * s, mat(0x22201c, 0.0, 0.6))
  // Уши
  ;[-0.5, 0.5].forEach(x => sph(head, x * s, 0.72 * s, 0.02 * s, 0.2 * s, furM))

  // Хвост
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * s, 0.05 * s, 2.4 * s, 8), furM)
  tail.position.set(0, 1.7 * s, -1.05 * s)
  tail.rotation.x = Math.PI / 2 + 0.45
  p.add(tail)
  tail.castShadow = true
  tail.receiveShadow = true

  // Длинные руки с лапами
  const mkArm = (side) => {
    const g = new THREE.Group()
    g.position.set(side * 1.45 * s, 1.9 * s, 0.05 * s)
    p.add(g)
    box(g, 0, -0.85 * s, 0, 0.72 * s, 2.9 * s, 0.72 * s, furM)
    sph(g, side * 0.12 * s, -1.95 * s, 0.1 * s, 0.3 * s, mat(fur, 0.0, 0.9))
    return g
  }
  const leftArm = mkArm(-1)
  const rightArm = mkArm(1)

  // Короткие ноги со ступнями
  const mkLeg = (side) => {
    const g = new THREE.Group()
    g.position.set(side * 0.5 * s, 0.85 * s, 0)
    p.add(g)
    box(g, 0, -0.45 * s, 0.05 * s, 0.6 * s, 0.9 * s, 0.68 * s, furM)
    sph(g, side * 0.15 * s, -1.0 * s, 0.35 * s, 0.26 * s, mat(0x4a2f1e, 0.0, 0.95), 0, 0, 0, 1.3, 0.7, 1.1)
    return g
  }
  const leftLeg = mkLeg(-1)
  const rightLeg = mkLeg(1)

  return { head, body, leftArm, rightArm, leftLeg, rightLeg }
}

const buildMonkey = (p) => buildPrimate(p, 1, 0x7a5736, 0xd9b99a, 0xc9a078)
const buildKong = (p) => buildPrimate(p, 3.0, 0x2e1c10, 0x4a3523, 0x6b4a2f)

// Динозавр: горб, шея, хвост, шипы
const buildDino = (p) => {
  const green = mat(0x3f8a3f, 0.05, 0.7)
  const greenDark = mat(0x2f6a2e, 0.05, 0.7)
  const bellyM = mat(0xcfd97a, 0.0, 0.75)

  // Тело (вытянутый шар) + брюхо
  const body = new THREE.Group()
  body.position.set(0, 2.3, 0)
  p.add(body)
  body.homeY = 2.3
  sph(body, 0, 0.2, -0.1, 1.15, green, 0, 0, 0, 1.0, 0.95, 1.7)
  sph(body, 0, 0.0, 0.5, 0.8, bellyM, 0, 0, 0, 0.9, 0.8, 1.3)

  // Шея (наклон вперёд-вверх, строго по центру тела)
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.7, 2.4, 10), green)
  neck.position.set(0, 3.9, 0.7)
  neck.rotation.x = 0.9
  neck.castShadow = true
  neck.receiveShadow = true
  p.add(neck)

  // Голова с пастью (по центру, а не сбоку)
  const head = new THREE.Group()
  head.position.set(0, 5.0, 1.9)
  p.add(head)
  sph(head, 0, 0, 0, 0.5, green)
  box(head, 0, -0.12, 0.62, 0.5, 0.32, 0.75, greenDark)
  box(head, 0, -0.3, 0.55, 0.52, 0.12, 0.8, mat(0x6b2a22, 0.0, 0.6))
  sph(head, -0.22, 0.18, 0.4, 0.09, mat(0xe8b23d, 0.3, 0.3, 0xe8b23d, 0.6))
  sph(head, 0.22, 0.18, 0.4, 0.09, mat(0xe8b23d, 0.3, 0.3, 0xe8b23d, 0.6))

  // Хвост (назад-вверх)
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.5, 3.0, 10), green)
  tail.position.set(0, 2.6, -1.7)
  tail.rotation.x = 0.5
  tail.castShadow = true
  tail.receiveShadow = true
  p.add(tail)

  // Шипы
  const spike = mat(0x5baf5a, 0.05, 0.6)
  ;[[-0.7, 3.05, 0.2], [0, 3.1, -0.5], [0.7, 3.05, 0.2]].forEach(([x, y, z]) => {
    const k = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.85, 6), spike)
    k.position.set(x, y, z)
    p.add(k)
    k.castShadow = true
  })

  // Ноги и руки
  const mkLeg = (side, z) => {
    const g = new THREE.Group()
    g.position.set(side * 0.75, 1.1, z)
    p.add(g)
    box(g, 0, -0.55, 0, 0.72, 1.1, 0.9, greenDark)
    box(g, side * 0.1, -1.15, 0.25, 0.95, 0.28, 1.1, mat(0x4a7a2e, 0.0, 0.8))
    return g
  }
  const leftArm = mkLeg(-1, 0.1)
  const rightArm = mkLeg(1, 0.1)
  const leftLeg = mkLeg(-1, -1.0)
  const rightLeg = mkLeg(1, -1.0)
  return { head, body, leftArm, rightArm, leftLeg, rightLeg }
}

// Робот: гладкий металл, светящийся визор и реактор
const buildRobot = (p) => {
  const steel = mat(0xb9c2c9, 0.8, 0.25)
  const steelDark = mat(0x76828a, 0.7, 0.35)
  const gold = mat(0xc9a23d, 0.75, 0.3)
  const glowCyan = (ei) => mat(0x22e6ff, 0.0, 0.3, 0x22e6ff, ei)
  const glowRed = (ei) => mat(0xff3b3b, 0.0, 0.3, 0xff3b3b, ei)

  // Корпус-капсула
  const body = new THREE.Group()
  body.position.set(0, 2.75, 0)
  p.add(body)
  body.homeY = 2.75
  cyl(body, 0, 0, 0, 0.95, 0.9, 2.4, steel, 0, 0, 16)
  sph(body, 1.15, 0.55, 0, 0.42, steelDark)
  sph(body, -1.15, 0.55, 0, 0.42, steelDark)
  // Реактор
  torus(body, 0, -0.35, 0.62, 0.28, 0.08, glowCyan(0.9), Math.PI / 2, 0, 0)
  sph(body, 0, -0.35, 0.6, 0.12, glowRed(1.0))

  // Голова с визором
  const head = new THREE.Group()
  head.position.set(0, 4.45, 0)
  p.add(head)
  box(head, 0, 0, 0, 1.15, 0.95, 1.05, steel)
  box(head, 0, 0.02, 0.5, 0.92, 0.26, 0.12, glowCyan(1.0))
  // Антенна
  cyl(head, 0.3, 1.05, 0.25, 0.05, 0.05, 0.55, steelDark)
  sph(head, 0.3, 1.4, 0.25, 0.11, glowRed(0.9))

  // Плечи-суставы и руки
  const mkArm = (side) => {
    const g = new THREE.Group()
    g.position.set(side * 1.45, 3.6, 0)
    p.add(g)
    sph(g, 0, 0, 0, 0.5, steelDark)
    cyl(g, 0, -0.55, 0, 0.4, 0.4, 1.0, steel, 0, 0, 12)
    sph(g, 0, -1.1, 0, 0.34, steelDark)
    box(g, 0, -1.65, 0, 0.42, 0.95, 0.42, steel)
    sph(g, 0, -2.1, 0.08, 0.28, gold)
    return g
  }
  const leftArm = mkArm(-1)
  const rightArm = mkArm(1)

  // Ноги с массивными ступнями
  const mkLeg = (side) => {
    const g = new THREE.Group()
    g.position.set(side * 0.72, 1.35, 0)
    p.add(g)
    cyl(g, 0, -0.55, 0, 0.55, 0.5, 1.1, steel, 0, 0, 12)
    sph(g, 0, -1.2, 0, 0.42, steelDark)
    box(g, side * 0.05, -1.85, 0.12, 0.85, 0.32, 1.0, steelDark)
    return g
  }
  const leftLeg = mkLeg(-1)
  const rightLeg = mkLeg(1)
  return { head, body, leftArm, rightArm, leftLeg, rightLeg }
}

// Гигант: каменный исполин с бородой
const buildGiant = (p) => {
  const s = 2.0
  const skin = mat(0x8a8371, 0.1, 0.85)
  const dark = mat(0x5c584a, 0.1, 0.85)
  const parts = humanoid(p, {
    scale: s,
    skin: 0x8a8371,
    face: null,
    headRadius: 1.5,
    body: [2.7, 2.9, 1.5],
    bodyMat: mat(0x6c6a5c, 0.15, 0.8),
    chest: mat(0x7c7a6a, 0.1, 0.8),
    belt: mat(0x4a3a28, 0.2, 0.8),
    armMat: mat(0x7c7a6a, 0.1, 0.8),
    handMat: mat(0x8a8371, 0.1, 0.8),
    legMat: mat(0x58564a, 0.15, 0.8),
    shoeMat: mat(0x3f3d33, 0.2, 0.8),
    armX: 1.75,
    armW: 0.8,
    legX: 0.85,
    legW: 0.9,
    handR: 0.4
  })

  // Могучая борода + массивные брови + глаза
  const r = 1.5, cy = r + 0.15
  box(parts.head, 0, cy - 0.25, r * 0.55, r * 1.3, r * 1.0, r * 0.4, mat(0x4d4a3f, 0.05, 0.9), 0.15, 0, 0)
  box(parts.head, 0, cy - 0.9, r * 0.6, r * 0.8, r * 0.9, r * 0.32, mat(0x4d4a3f, 0.05, 0.9), 0.0, 0, 0)
  ;[-1, 1].forEach(x => {
    sph(parts.head, x * r * 0.4, cy + r * 0.3, r * 0.85, 0.17, mat(0x1c1d1a, 0.0, 0.5))
    box(parts.head, x * r * 0.4, cy + r * 0.5, r * 0.9, r * 0.3, r * 0.12, r * 0.14, mat(0x3a382f, 0.0, 0.8), 0, 0, x * 0.08)
  })
  sph(parts.head, 0, cy - 0.08, r * 0.92, 0.22, mat(0x7c7867, 0.0, 0.7))
  return parts
}

// Босс: тёмная броня, золотые рога, светящиеся глаза
const buildBoss = (p) => {
  const s = 1.75
  const parts = humanoid(p, {
    scale: s,
    skin: 0x8a5a3c,
    face: null,
    headRadius: 1.3,
    body: [2.5, 2.9, 1.4],
    bodyMat: mat(0x591313, 0.6, 0.35),
    chest: mat(0x6d1a1a, 0.6, 0.35),
    belt: mat(0xc9a23d, 0.7, 0.3),
    collar: mat(0xc9a23d, 0.7, 0.3),
    armMat: mat(0x4a0f0f, 0.6, 0.4),
    handMat: mat(0x8a5a3c, 0.1, 0.7),
    legMat: mat(0x3a0a0a, 0.6, 0.4),
    shoeMat: mat(0x260707, 0.5, 0.4),
    armX: 1.8,
    armW: 0.7,
    legX: 0.8,
    legW: 0.75
  })

  // Капюшон-шлем и светящиеся глаза
  const r = 1.3, cy = r + 0.15
  sph(parts.head, 0, cy, -0.25, r + 0.22, mat(0x3a0a0a, 0.5, 0.4), 0, 0, 0, 1.05, 1.1, 1.0)
  ;[-1, 1].forEach(x => sph(parts.head, x * r * 0.38, cy + r * 0.18, r * 0.78, 0.13, mat(0xff2222, 0.0, 0.3, 0xff2222, 1.1)))
  box(parts.head, 0, cy - r * 0.2, r * 0.9, r * 1.4, r * 0.5, r * 0.4, mat(0x2b0707, 0.4, 0.5), 0.12, 0, -0.2)

  // Золотые рога
  ;[-1, 1].forEach(x => {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.26, 1.1, 8), mat(0xc9a23d, 0.7, 0.3))
    horn.position.set(x * r * 0.5, cy + r + 0.55, -0.15)
    horn.rotation.z = -x * 0.45
    parts.head.add(horn)
    horn.castShadow = true
  })

  // Шипастые наплечники
  ;[-1, 1].forEach(s => {
    sph(parts[s === -1 ? 'leftArm' : 'rightArm'], 0, 0.3, -0.1, 0.9, mat(0x6d1a1a, 0.6, 0.35), 0, 0, 0, 1.2, 0.8, 1.1)
    ;[0, 1, 2].forEach(i => {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.7, 6), mat(0xdfe0d8, 0.6, 0.3))
      sp.position.set((i - 1) * 0.5, 0.95, -0.2)
      parts[s === -1 ? 'leftArm' : 'rightArm'].add(sp)
      sp.castShadow = true
    })
  })

  // Плащ позади
  box(p, 0, 3.4, -1.5, 2.6, 3.6, 0.3, mat(0x350909, 0.3, 0.8))

  return parts
}

const BUILDERS = {
  human: buildHuman,
  maga: buildMaga,
  warrior: buildWarrior,
  ninja: buildNinja,
  monkey: buildMonkey,
  robot: buildRobot,
  dino: buildDino,
  giant: buildGiant,
  kong: buildKong,
  boss: buildBoss,
  king: buildKing
}

// Собирает модель персонажа прямо в parent (parts нужны для анимации).
export function buildCharacter(parent, type) {
  const builder = BUILDERS[type] || buildHuman
  return builder(parent)
}

// Группа для превью: приводится к единому росту и ставится на пол.
export function createPreviewGroup(type) {
  const group = new THREE.Group()
  buildCharacter(group, type)

  const box = new THREE.Box3().setFromObject(group)
  const size = box.getSize(new THREE.Vector3())
  const s = 3.2 / size.y
  group.scale.setScalar(s)

  // Ставим персонажа на пол (минимальный y -> 0)
  const box2 = new THREE.Box3().setFromObject(group)
  group.position.y = -box2.min.y

  const size2 = box2.getSize(new THREE.Vector3()).multiplyScalar(s)
  const radius = Math.max(size2.x, size2.y, size2.z) * 0.55
  return { group, radius }
}