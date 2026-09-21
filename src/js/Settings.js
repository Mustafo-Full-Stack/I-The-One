// Пресеты качества графики: от Лёгкого до Ультра.
// Туман дальний — арена на крыше 100-этажки, падение видно на 300 м вниз.
export const GRAPHICS_PRESETS = {
  low: {
    label: 'Лёгкий',
    antialias: false,
    pixelRatio: 1,
    shadows: false,
    shadowMapSize: 0,
    fogNear: 60,
    fogFar: 200
  },
  medium: {
    label: 'Средний',
    antialias: false,
    pixelRatio: 1,
    shadows: true,
    shadowMapSize: 1024,
    fogNear: 80,
    fogFar: 300
  },
  high: {
    label: 'Высокий',
    antialias: true,
    pixelRatio: 1.5,
    shadows: true,
    shadowMapSize: 2048,
    fogNear: 80,
    fogFar: 400
  },
  ultra: {
    label: 'Ультра',
    antialias: true,
    pixelRatio: 1.75,
    shadows: true,
    shadowMapSize: 2048,
    fogNear: 100,
    fogFar: 500
  }
}

const STORAGE_KEY = 'gameSettings'
const DEFAULTS = { fps: 120, graphics: 'ultra', autoRotate: true, controls: 'joystick' }

class Settings {
  constructor() {
    this.data = { ...DEFAULTS }
    this.load()
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const saved = JSON.parse(raw || '{}')
      const fresh = !raw // первый запуск: настроек ещё нет
      this.data = { ...DEFAULTS, ...saved }
      // Слабый телефон (<=3 ГБ RAM) при первом запуске: не душим его
      // ультра-настройками — ставим средние, пользователь всегда может поднять
      try {
        const mem = navigator.deviceMemory
        if (fresh && mem && mem <= 3) {
          this.data.graphics = 'medium'
          this.data.fps = 60
        }
      } catch (e) { /* ignore */ }
      // Защита от некорректных значений
      this.data.fps = this._clampFps(this.data.fps)
      if (!GRAPHICS_PRESETS[this.data.graphics]) this.data.graphics = DEFAULTS.graphics
      if (typeof this.data.autoRotate !== 'boolean') this.data.autoRotate = DEFAULTS.autoRotate
      if (this.data.controls !== 'joystick' && this.data.controls !== 'buttons') {
        this.data.controls = DEFAULTS.controls
      }
    } catch (e) {
      this.data = { ...DEFAULTS }
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data))
    } catch (e) {
      // localStorage может быть недоступен — игнорируем
    }
  }

  _clampFps(v) {
    v = Number(v)
    if (!isFinite(v)) v = 60
    return Math.max(30, Math.min(160, Math.round(v)))
  }

  get fps() {
    return this.data.fps
  }

  set fps(v) {
    this.data.fps = this._clampFps(v)
  }

  get graphics() {
    return this.data.graphics
  }

  set graphics(v) {
    if (GRAPHICS_PRESETS[v]) this.data.graphics = v
  }

  // Камера в проекте единственная — «Обзор · сверху»
  get camera() {
    return '3d'
  }

  // Автовращение камеры за движением (по умолчанию включено)
  get autoRotate() {
    return this.data.autoRotate !== false
  }

  set autoRotate(v) {
    this.data.autoRotate = !!v
  }

  // Управление для мобилок и ПК с тачем: джойстик или 4 кнопки
  get controls() {
    return this.data.controls === 'buttons' ? 'buttons' : 'joystick'
  }

  set controls(v) {
    this.data.controls = v === 'buttons' ? 'buttons' : 'joystick'
  }

  get preset() {
    return GRAPHICS_PRESETS[this.data.graphics] || GRAPHICS_PRESETS.high
  }
}

export const settings = new Settings()
