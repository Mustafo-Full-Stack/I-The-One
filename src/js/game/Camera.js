import * as THREE from 'three'

// Единственная камера проекта: «Обзор · сверху».
// Смотрит сверху по диагонали, можно крутить мышью/пальцем, зум — колесо/щипок.
// Параметры «изометрии»:
const PITCH = 0.55 // высота взгляда над ареной
const YAW = Math.PI / 4 // диагональный ракурс
const DISTANCE = 46 // дальность (крыша 50×50)
const LIMITS = { distMin: 24, distMax: 90, pitchMin: 0.15, pitchMax: 1.25 }

export class Camera {
  constructor() {
    const width = window.innerWidth
    const height = window.innerHeight
    const aspect = width / height

    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000)

    this.mode = '3d'
    this.yaw = YAW
    this.controlYaw = YAW // опора движения (см. getControlYaw/syncControlToYaw)
    this.pitch = PITCH
    this.distance = DISTANCE

    // Сглаженная точка фокуса (за кем следим) — чтобы не было рывков
    this.focus = new THREE.Vector3(0, 2, 0)

    this._tmpDesired = new THREE.Vector3()
    this._tmpLook = new THREE.Vector3()

    // Орбит-контролы (мышь/тач) — обработчики для detach
    this._orbitHandlers = []
    this._dragging = false
    this._lastX = 0
    this._lastY = 0
    this._pinchDist = 0
    // Момент последнего ручного вращения (для паузы автовращения)
    this.lastManualOrbit = 0

    this._applyPosition(1)
  }

  // Отметить ручное вращение — автовращение встанет на паузу
  markManualOrbit() {
    try {
      this.lastManualOrbit = performance.now()
    } catch (e) {
      this.lastManualOrbit = Date.now()
    }
  }

  // Сколько секунд прошло с ручного вращения (Infinity — ещё не крутили)
  secondsSinceManualOrbit() {
    if (!this.lastManualOrbit) return Infinity
    try {
      return (performance.now() - this.lastManualOrbit) / 1000
    } catch (e) {
      return (Date.now() - this.lastManualOrbit) / 1000
    }
  }

  // Опора движения: угол, от которого персонаж переводит ввод (WASD/джойстик)
  // в мировое направление. Пока автовращение активно, доворачивается только
  // сам взгляд (yaw), а опора остаётся замороженной — иначе получается петля
  // «камера повернулась → движение повернулось → камера повернулась...»
  // (бесконечная карусель при S или джойстике чуть вбок).
  getControlYaw() {
    return this.controlYaw
  }

  // Вернуть опору движения «к взгляду»: когда автовращение неактивно
  // (покой, пауза после ручного обзора, выкл. в настройках) W ведёт туда,
  // куда смотрит камера. Вызывается GameManager каждый кадр.
  syncControlToYaw() {
    this.controlYaw = this.yaw
  }

  setControlYaw(yaw) {
    this.controlYaw = yaw
  }

  // Плавный доворот «изометрии» за направлением персонажа: yaw стремится к
  // heading + PI (смотреть сверху на путь бега). speed — рад/с (1.4 — мягко).
  softFollowHeading(heading, dt, speed = 1.4) {
    const targetYaw = heading + Math.PI
    let diff = targetYaw - this.yaw
    while (diff > Math.PI) diff -= 2 * Math.PI
    while (diff < -Math.PI) diff += 2 * Math.PI
    // Экспоненциальное сглаживание — одинаковая скорость на любом FPS
    const k = 1 - Math.exp(-Math.max(speed, 0.1) * Math.max(dt, 0))
    this.yaw += diff * Math.min(Math.max(k, 0), 1)
  }

  getCamera() {
    return this.camera
  }

  getYaw() {
    return this.yaw
  }

  _focusHeight() {
    return 2.0
  }

  // --- Орбит-управление: ПК (мышь drag + колесо) и телефон (drag пальцем + щипок-зум) ---
  attachOrbit(dom) {
    this.detachOrbit()
    if (!dom) return

    const SENS_MOUSE = 0.0052
    const SENS_TOUCH = 0.0065

    const isUiEvent = (e) => {
      // Не перехватываем события с кнопок/джойстика/панелей — только с канваса
      if (e.target !== dom) return true
      return false
    }

    const clampPitchDist = () => {
      this.pitch = Math.max(LIMITS.pitchMin, Math.min(LIMITS.pitchMax, this.pitch))
      this.distance = Math.max(LIMITS.distMin, Math.min(LIMITS.distMax, this.distance))
    }

    // --- Мышь ---
    const onMouseDown = (e) => {
      if (e.button !== 0 && e.button !== 2) return
      this._dragging = true
      this._lastX = e.clientX
      this._lastY = e.clientY
    }
    const onMouseMove = (e) => {
      if (!this._dragging) return
      const dx = e.clientX - this._lastX
      const dy = e.clientY - this._lastY
      this._lastX = e.clientX
      this._lastY = e.clientY
      this.yaw -= dx * SENS_MOUSE
      this.controlYaw = this.yaw
      // Тянем вверх — смотрим вверх (как свайп на телефоне)
      this.pitch -= dy * SENS_MOUSE
      this.markManualOrbit()
      clampPitchDist()
    }
    const onMouseUp = () => { this._dragging = false }
    const onWheel = (e) => {
      e.preventDefault()
      this.distance *= (e.deltaY > 0 ? 1.1 : 0.9)
      clampPitchDist()
    }
    const onContextMenu = (e) => e.preventDefault()

    // --- Тач: один палец — вращение, два — щипок-зум ---
    const touchPos = (t) => ({ x: t.clientX, y: t.clientY })
    const onTouchStart = (e) => {
      if (isUiEvent(e)) return
      if (e.touches.length === 1) {
        const p = touchPos(e.touches[0])
        this._lastX = p.x
        this._lastY = p.y
      } else if (e.touches.length === 2) {
        const a = touchPos(e.touches[0])
        const b = touchPos(e.touches[1])
        this._pinchDist = Math.hypot(a.x - b.x, a.y - b.y)
      }
    }
    const onTouchMove = (e) => {
      if (isUiEvent(e)) return
      e.preventDefault()
      if (e.touches.length === 1) {
        const p = touchPos(e.touches[0])
        const dx = p.x - this._lastX
        const dy = p.y - this._lastY
        this._lastX = p.x
        this._lastY = p.y
        this.yaw -= dx * SENS_TOUCH
        this.controlYaw = this.yaw
        this.pitch -= dy * SENS_TOUCH
        this.markManualOrbit()
        clampPitchDist()
      } else if (e.touches.length === 2) {
        const a = touchPos(e.touches[0])
        const b = touchPos(e.touches[1])
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (this._pinchDist > 0) {
          this.distance *= (this._pinchDist / Math.max(d, 1))
          clampPitchDist()
        }
        this._pinchDist = d
      }
    }

    // Pointer Events для мыши (универсально). Тач — через touch-события на канвасе,
    // т.к. джойстик должен оставаться независимым.
    dom.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    dom.addEventListener('wheel', onWheel, { passive: false })
    dom.addEventListener('contextmenu', onContextMenu)
    dom.addEventListener('touchstart', onTouchStart, { passive: true })
    dom.addEventListener('touchmove', onTouchMove, { passive: false })

    this._orbitHandlers.push(
      { el: dom, type: 'mousedown', h: onMouseDown },
      { el: window, type: 'mousemove', h: onMouseMove },
      { el: window, type: 'mouseup', h: onMouseUp },
      { el: dom, type: 'wheel', h: onWheel },
      { el: dom, type: 'contextmenu', h: onContextMenu },
      { el: dom, type: 'touchstart', h: onTouchStart },
      { el: dom, type: 'touchmove', h: onTouchMove }
    )
  }

  detachOrbit() {
    if (this._orbitHandlers) {
      this._orbitHandlers.forEach(({ el, type, h }) => el.removeEventListener(type, h))
    }
    this._orbitHandlers = []
    this._dragging = false
  }

  _applyPosition(snap = 0) {
    const f = this.focus
    const cosP = Math.cos(this.pitch)
    const sinP = Math.sin(this.pitch)
    this._tmpDesired.set(
      f.x + Math.sin(this.yaw) * cosP * this.distance,
      f.y + sinP * this.distance,
      f.z + Math.cos(this.yaw) * cosP * this.distance
    )
    // Земля — пол камеры: не даём уйти под арену
    if (this._tmpDesired.y < 1.2) this._tmpDesired.y = 1.2

    if (snap) this.camera.position.copy(this._tmpDesired)
    else this.camera.position.lerp(this._tmpDesired, 0.08)

    this._tmpLook.copy(f)
    this.camera.lookAt(this._tmpLook)
  }

  // Плавное следование за целью
  follow(target) {
    const pos = target.position
    const wantY = pos.y + this._focusHeight()
    // Быстро, но плавно тянем фокус за игроком (рывки при прыжках сглаживаются)
    this.focus.x += (pos.x - this.focus.x) * 0.25
    this.focus.y += (wantY - this.focus.y) * 0.25
    this.focus.z += (pos.z - this.focus.z) * 0.25
    this._applyPosition(0)
  }
}