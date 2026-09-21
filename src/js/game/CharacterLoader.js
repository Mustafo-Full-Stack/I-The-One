import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { AnimationUtils } from 'three'

export class CharacterLoader {
  constructor(scene) {
    this.scene = scene
    this.gltfLoader = new GLTFLoader()
    this.loadedModels = {}
    this.activeCharacter = null
    this.animationMixer = null
    this.currentAnimation = null
  }

  // Загрузка модели персонажа из URL
  async loadCharacter(url, characterName) {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf) => {
          this.loadedModels[characterName] = gltf
          resolve(gltf)
        },
        undefined,
        (error) => {
          console.error(`Ошибка загрузки персонажа ${characterName}:`, error)
          reject(error)
        }
      )
    })
  }

  // Создание копии персонажа (для использования одной загруженной модели)
  createCharacterInstance(characterName, position = { x: 0, y: 0, z: 0 }) {
    const gltf = this.loadedModels[characterName]
    if (!gltf) {
      console.error(`Персонаж ${characterName} не загружен`)
      return null
    }

    // Клонируем сцену
    const scene = gltf.scene.clone(true)
    scene.position.set(position.x, position.y, position.z)

    // Создаём новый mixer для этого экземпляра
    const mixer = new THREE.AnimationMixer(scene)

    // Добавляем в сцену
    this.scene.add(scene)

    return {
      scene,
      mixer,
      gltf: {
        animations: gltf.animations
      }
    }
  }

  // Смена активного персонажа
  switchCharacter(characterName, position = { x: 0, y: 0, z: 0 }) {
    // Удаляем старого персонажа
    if (this.activeCharacter) {
      this.scene.remove(this.activeCharacter.scene)
    }

    // Создаём нового
    this.activeCharacter = this.createCharacterInstance(characterName, position)

    if (this.activeCharacter) {
      this.animationMixer = this.activeCharacter.mixer
      return this.activeCharacter
    }

    return null
  }

  // Воспроизведение анимации
  playAnimation(animationIndex, loop = true) {
    if (!this.activeCharacter || !this.activeCharacter.gltf.animations.length) {
      return null
    }

    const animation = this.activeCharacter.gltf.animations[animationIndex]
    if (!animation) return null

    const action = this.animationMixer.clipAction(animation)
    action.loop = loop ? THREE.LoopRepeat : THREE.LoopOnce
    action.play()

    this.currentAnimation = action
    return action
  }

  // Остановка текущей анимации
  stopAnimation() {
    if (this.currentAnimation) {
      this.currentAnimation.stop()
      this.currentAnimation = null
    }
  }

  // Обновление анимации (вызывается каждый frame)
  update(deltaTime) {
    if (this.animationMixer) {
      this.animationMixer.update(deltaTime)
    }
  }

  // Получение информации о загруженных моделях
  getLoadedCharacters() {
    return Object.keys(this.loadedModels)
  }

  // Получение активного персонажа
  getActiveCharacter() {
    return this.activeCharacter
  }
}
