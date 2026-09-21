import * as THREE from 'three'

export class Lighting {
  constructor(scene) {
    this.scene = scene
    this.mainLight = null
    this.setupLighting()
  }

  setupLighting() {
    // Основной направленный свет (имитация солнца/основного источника)
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8)
    mainLight.position.set(20, 30, 15)
    mainLight.castShadow = true

    // Настройка качественных теней
    mainLight.shadow.mapSize.width = 2048
    mainLight.shadow.mapSize.height = 2048
    mainLight.shadow.camera.left = -50
    mainLight.shadow.camera.right = 50
    mainLight.shadow.camera.top = 50
    mainLight.shadow.camera.bottom = -50
    mainLight.shadow.camera.near = 0.5
    mainLight.shadow.camera.far = 100
    mainLight.shadow.bias = -0.0001

    this.mainLight = mainLight
    this.scene.add(mainLight)

    // Мягкий заполняющий свет сверху
    const fillLight = new THREE.DirectionalLight(0x9cb4cc, 0.3)
    fillLight.position.set(-15, 25, -10)
    this.scene.add(fillLight)

    // Амбиентный свет для общего освещения (мягкий)
    const ambientLight = new THREE.AmbientLight(0x8fa5b8, 0.4)
    this.scene.add(ambientLight)

    // Лёгкий полусферический свет для реалистичности
    const hemisphereLight = new THREE.HemisphereLight(0x87a7c4, 0x1e2a38, 0.5)
    this.scene.add(hemisphereLight)
  }

  // Применение пресета качества графики (тени + туман)
  applyPreset(preset) {
    if (!this.mainLight) return
    this.mainLight.castShadow = preset.shadows
    if (preset.shadows) {
      this.mainLight.shadow.mapSize.width = preset.shadowMapSize
      this.mainLight.shadow.mapSize.height = preset.shadowMapSize
      // Пересоздаём карту теней, чтобы новый размер вступил в силу
      if (this.mainLight.shadow.map) {
        this.mainLight.shadow.map.dispose()
        this.mainLight.shadow.map = null
      }
      this.mainLight.shadow.needsUpdate = true
    }
    if (this.scene.fog) {
      this.scene.fog.near = preset.fogNear
      this.scene.fog.far = preset.fogFar
    }
  }
}
