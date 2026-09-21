import * as THREE from 'three'

export class CharacterController {
  constructor(characterGroup) {
    this.character = characterGroup
    this.velocity = new THREE.Vector3()
    this.position = this.character.position.clone()
    this.isJumping = false
    this.isMoving = false
    this.moveSpeed = 0.3
    this.jumpPower = 0.5
    this.gravity = 0.02
    this.groundY = 0
    this.keys = {}
    this.joy = { x: 0, y: 0 }
    // Крестовина (4 кнопки): активные направления + сумма для update
    this.dpad = { x: 0, y: 0 }
    this._dpadDirs = new Set()
    // Угол камеры (yaw) — движение всегда относительно взгляда, как в экшен-играх:
    // W — вперёд туда, куда смотрит камера
    this.cameraYaw = 0
    this.cameraRelative = true
    // Сырой ввод «вперёд» (W / джойстик вверх = +1, S = -1) и «вбок» (D = +1, A = -1).
    // Нужны автовращению камеры: доворачиваем только при движении вперёд —
    // при стрейфах доворот уходил бы в бесконечное кружение (проверено симуляцией).
    this.forwardInput = 0
    this.lateralInput = 0

    this.setupInputListeners()
  }

  setupInputListeners() {
    this._onKeyDown = (e) => {
      // Пробел/Enter по сфокусированной кнопке (📷/⚙/Старт) кликают её повторно
      // и не должны считаться игровым вводом (прыжок)
      if ((e.key === ' ' || e.key.toLowerCase() === 'enter')) {
        const tag = e.target && e.target.tagName
        if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA') {
          e.preventDefault()
          return
        }
      }
      this.keys[e.key.toLowerCase()] = true
    }
    this._onKeyUp = (e) => {
      this.keys[e.key.toLowerCase()] = false
    }

    window.addEventListener('keydown', this._onKeyDown)
    window.addEventListener('keyup', this._onKeyUp)

    this._mobileHandlers = []
    this.setupMobileControls()
  }

  setupMobileControls() {
    const joystick = document.getElementById('joystick')
    const knob = document.getElementById('joystick-knob')
    if (!joystick || !knob) return

    this._joyId = null
    this._joyCenter = { x: 0, y: 0 }
    this._joyMaxR = 50 // максимальный радиус отклонения ручки (px)

    const centerOf = (rect) => ({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    })

    const moveKnob = (dx, dy) => {
      const dist = Math.hypot(dx, dy)
      if (dist > this._joyMaxR) {
        const s = this._joyMaxR / dist
        dx *= s
        dy *= s
      }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`
      this.joy.x = dx / this._joyMaxR
      this.joy.y = dy / this._joyMaxR
    }

    const resetKnob = () => {
      knob.style.transform = 'translate(-50%, -50%)'
      this.joy.x = 0
      this.joy.y = 0
    }

    const onTouchStart = (e) => {
      e.preventDefault()
      if (this._joyId !== null) return
      const t = e.changedTouches[0]
      this._joyId = t.identifier
      const rect = joystick.getBoundingClientRect()
      this._joyCenter = centerOf(rect)
      moveKnob(t.clientX - this._joyCenter.x, t.clientY - this._joyCenter.y)
    }

    const onTouchMove = (e) => {
      e.preventDefault()
      if (this._joyId === null) return
      for (const t of e.changedTouches) {
        if (t.identifier === this._joyId) {
          moveKnob(t.clientX - this._joyCenter.x, t.clientY - this._joyCenter.y)
          break
        }
      }
    }

    const onTouchEnd = (e) => {
      e.preventDefault()
      for (const t of e.changedTouches) {
        if (t.identifier === this._joyId) {
          this._joyId = null
          resetKnob()
          break
        }
      }
    }

    joystick.addEventListener('touchstart', onTouchStart, { passive: false })
    joystick.addEventListener('touchmove', onTouchMove, { passive: false })
    joystick.addEventListener('touchend', onTouchEnd, { passive: false })
    joystick.addEventListener('touchcancel', onTouchEnd, { passive: false })

    // Мышь — для тестирования на десктопе
    let mouseDown = false
    const onMouseDown = (e) => {
      e.preventDefault()
      mouseDown = true
      const rect = joystick.getBoundingClientRect()
      this._joyCenter = centerOf(rect)
      moveKnob(e.clientX - this._joyCenter.x, e.clientY - this._joyCenter.y)
    }
    const onMouseMove = (e) => {
      if (!mouseDown) return
      e.preventDefault()
      moveKnob(e.clientX - this._joyCenter.x, e.clientY - this._joyCenter.y)
    }
    const onMouseUp = () => {
      if (!mouseDown) return
      mouseDown = false
      resetKnob()
    }
    joystick.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    this._mobileHandlers.push(
      { el: joystick, type: 'touchstart', h: onTouchStart },
      { el: joystick, type: 'touchmove', h: onTouchMove },
      { el: joystick, type: 'touchend', h: onTouchEnd },
      { el: joystick, type: 'touchcancel', h: onTouchEnd },
      { el: joystick, type: 'mousedown', h: onMouseDown },
      { el: window, type: 'mousemove', h: onMouseMove },
      { el: window, type: 'mouseup', h: onMouseUp }
    )

    // Кнопка прыжка
    const bindJump = (id, key) => {      const el = document.getElementById(id)
      if (!el) return
      const press = (e) => { e.preventDefault(); this.keys[key] = true }
      const release = (e) => { e.preventDefault(); this.keys[key] = false }
      const add = (type, h) => {
        el.addEventListener(type, h, type.startsWith('touch') ? { passive: false } : undefined)
        this._mobileHandlers.push({ el, type, h })
      }
      add('touchstart', press)
      add('touchend', release)
      add('touchcancel', release)
      add('mousedown', press)
      add('mouseup', release)
      add('mouseleave', release)
    }
    // Крестовина: 4 кнопки = те же оси, что джойстик (вверх = вперёд).
    // pointer-события покрывают и палец, и мышь на ПК.
    const DPAD_VEC = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }
    const refreshDpad = () => {
      let x = 0, y = 0
      this._dpadDirs.forEach(d => {
        const v = DPAD_VEC[d]
        if (v) { x += v[0]; y += v[1] }
      })
      this.dpad.x = Math.max(-1, Math.min(1, x))
      this.dpad.y = Math.max(-1, Math.min(1, y))
    }
    document.querySelectorAll('#dpad [data-dir]').forEach(btn => {
      const dir = btn.dataset.dir
      if (!DPAD_VEC[dir]) return
      const press = (e) => {
        e.preventDefault()
        this._dpadDirs.add(dir)
        refreshDpad()
        btn.classList.add('dpad-on')
      }
      const release = (e) => {
        if (e) e.preventDefault()
        this._dpadDirs.delete(dir)
        refreshDpad()
        btn.classList.remove('dpad-on')
      }
      btn.addEventListener('pointerdown', press)
      btn.addEventListener('pointerup', release)
      btn.addEventListener('pointercancel', release)
      btn.addEventListener('pointerleave', release)
      btn.addEventListener('contextmenu', (e) => e.preventDefault())
      this._mobileHandlers.push(
        { el: btn, type: 'pointerdown', h: press },
        { el: btn, type: 'pointerup', h: release },
        { el: btn, type: 'pointercancel', h: release },
        { el: btn, type: 'pointerleave', h: release }
      )
    })
    this._refreshDpad = refreshDpad
    bindJump('touch-jump', ' ')
  }

  // Угол камеры задаёт GameManager каждый кадр (camera.getYaw())
  setCameraYaw(yaw) {
    this.cameraYaw = yaw || 0
  }

  setCameraRelative(enabled) {
    this.cameraRelative = !!enabled
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown)
    window.removeEventListener('keyup', this._onKeyUp)
    if (this._mobileHandlers) {
      this._mobileHandlers.forEach(({ el, type, h }) => el.removeEventListener(type, h))
      this._mobileHandlers = []
    }
    this.keys = {}
    this.joy.x = 0
    this.joy.y = 0
    this.dpad.x = 0
    this.dpad.y = 0
    if (this._dpadDirs) this._dpadDirs.clear()
    document.querySelectorAll('#dpad .dpad-on').forEach(b => b.classList.remove('dpad-on'))
  }

  // Обновление позиции персонажа
  update(deltaTime = 0.016) {
    // Выбит с ринга: физикой полёта владеет GameManager,
    // управление и гравитация контроллера отключены до респауна.
    if (this.knockedOut) {
      this.isMoving = false
      this.position.copy(this.character.position)
      return this.position
    }
    const step = Math.min(deltaTime * 60, 3) // защита от больших скачков (фоновая вкладка)

    const direction = new THREE.Vector3()

    // Получение направления движения (клавиатура)
    if (this.keys['w'] || this.keys['arrowup']) direction.z -= 1
    if (this.keys['s'] || this.keys['arrowdown']) direction.z += 1
    if (this.keys['a'] || this.keys['arrowleft']) direction.x -= 1
    if (this.keys['d'] || this.keys['arrowright']) direction.x += 1

    // Аналоговый джойстик (y отрицательный = вперёд) + крестовина
    direction.x += this.joy.x + this.dpad.x
    direction.z += this.joy.y + this.dpad.y

    // Запоминаем сырой ввод до перевода в мировые координаты
    this.forwardInput = Math.max(-1, Math.min(1, -direction.z))
    this.lateralInput = Math.max(-1, Math.min(1, direction.x))

    // Переводим ввод в мировые координаты относительно камеры.
    // Ввод: x (A/D), z (W=-1 / S=+1). Вперёд камеры на земле: (-sinYaw, 0, -cosYaw),
    // вправо: (cosYaw, 0, -sinYaw).
    if (this.cameraRelative) {
      const yaw = this.cameraYaw
      const fwdX = -Math.sin(yaw), fwdZ = -Math.cos(yaw)
      const rightX = Math.cos(yaw), rightZ = -Math.sin(yaw)
      const ix = direction.x, iz = direction.z
      // world = right * ix + forward * (-iz)
      direction.set(
        rightX * ix + fwdX * (-iz),
        0,
        rightZ * ix + fwdZ * (-iz)
      )
    }

    // Аналоговая величина: 0..1 — для плавного изменения скорости
    const mag = Math.min(direction.length(), 1)

    if (mag > 0.08) {
      direction.normalize()
      this.isMoving = true

      // Движение (скорость масштабируется величиной наклона джойстика и шагом времени)
      this.position.x += direction.x * this.moveSpeed * mag * step
      this.position.z += direction.z * this.moveSpeed * mag * step

      // Разворот персонажа в сторону движения.
      // Экспоненциальное сглаживание по времени (0.2 при 60 FPS, как раньше),
      // иначе на 30 FPS персонаж крутился бы медленнее, чем на 120 FPS.
      const angle = Math.atan2(direction.x, direction.z)
      const turnK = 1 - Math.exp(-13.4 * Math.max(deltaTime, 0))
      this.character.rotation.y = this.lerpAngle(this.character.rotation.y, angle, turnK)
    } else {
      this.isMoving = false
      // В покое тело сохраняет последнее направление (не возвращается к камере)
    }

    // Прыжок
    if ((this.keys[' '] || this.keys['space']) && !this.isJumping) {
      this.velocity.y = this.jumpPower
      this.isJumping = true
    }

    // Применение гравитации
    this.velocity.y -= this.gravity * step

    // Обновление позиции Y
    this.position.y += this.velocity.y * step

    // Проверка столкновения с землёй
    if (this.position.y <= this.groundY) {
      this.position.y = this.groundY
      this.velocity.y = 0
      this.isJumping = false
    }

    // Край крыши: половина + 1 запас. Вышел за половину —
    // падение подхватит GameManager. Лимит задаёт GameManager под карту.
    const arenaSize = this.arenaLimit || 26
    this.position.x = Math.max(-arenaSize, Math.min(arenaSize, this.position.x))
    this.position.z = Math.max(-arenaSize, Math.min(arenaSize, this.position.z))

    // Применение новой позиции
    this.character.position.copy(this.position)

    return this.position
  }

  // Плавная интерполяция угла по кратчайшему пути
  lerpAngle(current, target, t) {
    let diff = target - current
    while (diff > Math.PI) diff -= 2 * Math.PI
    while (diff < -Math.PI) diff += 2 * Math.PI
    return current + diff * t
  }

  // Установка позиции
  setPosition(x, y, z) {
    this.position.set(x, y, z)
    this.character.position.copy(this.position)
  }

  // Получение текущей позиции
  getPosition() {
    return this.position.clone()
  }

  // Включение/отключение управления
  setControlEnabled(enabled) {
    if (!enabled) {
      this.keys = {}
    }
  }

  // Выбивание с ринга: true — полёт (управление off), false — респаун
  setKnockedOut(knocked) {
    this.knockedOut = !!knocked
    if (knocked) this.keys = {}
  }
}
