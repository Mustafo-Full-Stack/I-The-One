import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export class Player {
  constructor(scene) {
    this.scene = scene
    this.group = new THREE.Group()
    this.scene.add(this.group)

    this.gltfLoader = new GLTFLoader()
    this.loadedModel = null
    this.useCustomModel = false
    this.animationMixer = null
    this.animationTime = 0
    this.animationSpeed = 0.015
    this.parts = {}

    // Сначала создаём встроенный персонаж, потом можем заменить на готовый
    this.createDefaultPlayer()
    this.setupAnimation()
  }

  createDefaultPlayer() {
    // Голова
    const headGeometry = new THREE.SphereGeometry(1.2, 32, 32)
    const headMaterial = new THREE.MeshStandardMaterial({
      color: 0xf5a57a,
      metalness: 0.1,
      roughness: 0.8
    })
    const head = new THREE.Mesh(headGeometry, headMaterial)
    head.position.y = 4.2
    head.castShadow = true
    head.receiveShadow = true
    this.group.add(head)

    // Туловище
    const bodyGeometry = new THREE.BoxGeometry(2, 3, 1.2)
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a7ba7,
      metalness: 0.2,
      roughness: 0.7
    })
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
    body.position.y = 2.2
    body.castShadow = true
    body.receiveShadow = true
    this.group.add(body)

    // Руки
    const armGeometry = new THREE.BoxGeometry(0.6, 2.5, 0.6)
    const armMaterial = new THREE.MeshStandardMaterial({
      color: 0x5a8fb7,
      metalness: 0.15,
      roughness: 0.8
    })
    const leftArm = new THREE.Mesh(armGeometry, armMaterial)
    leftArm.position.set(-1.5, 2.5, 0)
    leftArm.castShadow = true
    leftArm.receiveShadow = true
    this.group.add(leftArm)

    const rightArm = leftArm.clone()
    rightArm.position.x = 1.5
    this.group.add(rightArm)

    // Ноги
    const legGeometry = new THREE.BoxGeometry(0.7, 2.5, 0.7)
    const legMaterial = new THREE.MeshStandardMaterial({
      color: 0x37475a,
      metalness: 0.2,
      roughness: 0.75
    })
    const leftLeg = new THREE.Mesh(legGeometry, legMaterial)
    leftLeg.position.set(-0.6, 0.2, 0)
    leftLeg.castShadow = true
    leftLeg.receiveShadow = true
    this.group.add(leftLeg)

    const rightLeg = leftLeg.clone()
    rightLeg.position.x = 0.6
    this.group.add(rightLeg)

    // Тень под персонажем
    const shadowGeometry = new THREE.CircleGeometry(1.5, 32)
    const shadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.3
    })
    const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial)
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = 0.01
    this.group.add(shadow)

    // Сохраняем части для анимации
    this.parts = {
      head,
      body,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg
    }
  }

  // Загрузка готовой модели из URL (например, из Gobkit)
  async loadModelFromURL(modelUrl) {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        modelUrl,
        (gltf) => {
          // Очищаем встроенного персонажа
          this.group.clear()

          // Добавляем загруженную модель
          const model = gltf.scene
          model.traverse((node) => {
            if (node.isMesh) {
              node.castShadow = true
              node.receiveShadow = true
            }
          })

          this.group.add(model)
          this.loadedModel = gltf
          this.useCustomModel = true

          // Создаём mixer для анимаций
          if (gltf.animations.length > 0) {
            this.animationMixer = new THREE.AnimationMixer(model)
          }

          resolve(gltf)
        },
        undefined,
        (error) => {
          console.warn(`Ошибка загрузки модели: ${error.message}. Используется встроенный персонаж.`)
          reject(error)
        }
      )
    })
  }

  setupAnimation() {
    this.animationTime = 0
    this.animationSpeed = 0.015
  }

  update(deltaTime = 0.016) {
    if (this.useCustomModel && this.animationMixer) {
      // Обновляем анимацию загруженной модели
      this.animationMixer.update(deltaTime)
    } else {
      // Анимация встроенного персонажа
      this.animationTime += this.animationSpeed

      // Лёгкое покачивание туловища
      this.parts.body.rotation.y = Math.sin(this.animationTime * 0.8) * 0.05
      this.parts.body.position.y = 2.2 + Math.sin(this.animationTime) * 0.05

      // Покачивание головой
      this.parts.head.rotation.y = Math.sin(this.animationTime * 0.6) * 0.1

      // Плавное движение рук
      this.parts.leftArm.rotation.z = Math.sin(this.animationTime * 0.7) * 0.15
      this.parts.rightArm.rotation.z = Math.cos(this.animationTime * 0.7) * 0.15

      // Лёгкое движение ног (стойка)
      this.parts.leftLeg.rotation.x = Math.sin(this.animationTime * 0.5) * 0.08
      this.parts.rightLeg.rotation.x = Math.cos(this.animationTime * 0.5) * 0.08

      // Плавное вертикальное покачивание всего персонажа
      this.group.position.y = Math.abs(Math.sin(this.animationTime * 0.8)) * 0.15
    }
  }

  // Переключение между встроенным и загруженным персонажем
  toggleModel() {
    if (this.useCustomModel) {
      // Возврат к встроенному
      this.group.clear()
      this.createDefaultPlayer()
      this.useCustomModel = false
      this.animationMixer = null
    }
  }
}
