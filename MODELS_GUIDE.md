# 🎮 Руководство по 3D персонажам и управлению

## 📥 Бесплатные источники 3D моделей для браузерных игр

### ⭐ Рекомендуемые ресурсы (CC0 - свободно использовать):

#### 1. **Gobkit Free Minions** (ЛУЧШИЙ ВЫБОР ДЛЯ НАШЕЙ ИГРЫ)
- **Сайт**: https://gobkit.itch.io/gobkit-free-minions
- **Что**: 8 готовых персонажей с анимациями
- **Формат**: GLB (идеально для Three.js)
- **Включает**: idle, attack, death анимации
- **Лицензия**: CC0 (свободно)
- **Скачать**: Нажать "Download Now"

#### 2. **KayKit Adventurers** (АЛЬТЕРНАТИВА)
- **Сайт**: https://kaylousberg.itch.io/kaykit-adventurers
- **Что**: 5 готовых персонажей (воин, маг, разбойник и т.д.)
- **Формат**: GLB, GLTF
- **Лицензия**: CC0 (свободно коммерчески)

#### 3. **Poly Haven**
- **Сайт**: https://polyhaven.com/models
- **Что**: Множество 3D моделей (персонажи, предметы, среда)
- **Лицензия**: CC0
- **Поиск**: Ищите "character" или "humanoid"

#### 4. **Sketchfab (бесплатные с CC0)**
- **Сайт**: https://sketchfab.com
- **Фильтр**: License → Creative Commons Zero
- **Поиск**: "low poly character"

#### 5. **Quaternius** (СПЕЦИАЛЬНО ДЛЯ ЛОУ-ПОЛИ)
- **Сайт**: https://quaternius.com
- **Что**: Low-poly игровые модели
- **Формат**: GLB, OBJ, FBX
- **Лицензия**: CC0

---

## 🚀 Как использовать готовую модель в игре

### Шаг 1: Скачайте модель
1. Перейдите на один из сайтов выше
2. Нажмите "Download"
3. Распакуйте ZIP файл
4. Найдите файл с расширением **.glb** или **.gltf**

### Шаг 2: Разместите файл в проекте
```
I'm-the0one/
├── public/
│   └── models/
│       ├── character1.glb
│       ├── character2.glb
│       └── ...
├── src/
├── index.html
└── ...
```

### Шаг 3: Загрузите в игру

**Вариант А: Из JavaScript модуля**
```javascript
import { Player } from './js/game/PlayerNew.js'

const player = new Player(scene)

// Загрузить готовую модель
await player.loadModelFromURL('https://your-domain.com/models/character.glb')

// Или локально
await player.loadModelFromURL('/models/character.glb')
```

**Вариант B: Используя CharacterLoader**
```javascript
import { CharacterLoader } from './js/game/CharacterLoader.js'

const loader = new CharacterLoader(scene)

// Загрузить модель
await loader.loadCharacter('/models/minion.glb', 'minion1')

// Создать экземпляр
const character = loader.switchCharacter('minion1', { x: 0, y: 0, z: 0 })

// Воспроизвести анимацию (индекс анимации: 0, 1, 2...)
loader.playAnimation(0)
```

---

## 🎮 Управление персонажем

### Элементы управления (Desktop):
- **W / ↑** — Вперёд
- **S / ↓** — Назад
- **A / ←** — Влево
- **D / →** — Вправо
- **SPACE** — Прыжок

### Элементы управления (Mobile):
- **Кнопки со стрелками** (виртуальные) — Движение
- **Кнопка прыжка** — Прыжок

### Код для управления:
```javascript
import { CharacterController } from './js/game/CharacterController.js'

const controller = new CharacterController(playerGroup)

// В игровом цикле
function animate() {
  const deltaTime = 0.016 // 60 FPS
  controller.update(deltaTime)
  renderer.render(scene, camera)
}
```

---

## 📝 Рекомендуемые модели для начала

### Gobkit Free Minions - ИДЕАЛЬНО ДЛЯ НАЧАЛА
- Уже имеют идеальные материалы
- Оптимизированы для браузера
- Готовые анимации работают из коробки
- CC0 лицензия
- Поддержка Three.js

**Как использовать Gobkit:**
1. Скачайте с: https://gobkit.itch.io/gobkit-free-minions
2. Распакуйте ZIP
3. Возьмите файлы `minion-a01.glb`, `minion-a02.glb` и т.д.
4. Поместите в папку `public/models/`

Пример кода:
```javascript
// Загрузить первого миниона
await player.loadModelFromURL('/models/minion-a01.glb')

// Минионы имеют встроенные анимации:
// - idle (0-29 кадры @ 24 FPS)
// - attack (30-59 кадры)
// - dead (60-89 кадры)
```

---

## ⚙️ Форматы и конвертация

### Поддерживаемые форматы в Three.js:
- ✅ **GLB** (рекомендуется) — один файл, оптимизирован
- ✅ **GLTF** (JSON + текстуры) — работает, но тяжелее
- ⚠️ **FBX** — требует GLTFLoader после конвертации
- ⚠️ **OBJ** — работает, но без анимаций обычно

### Если модель в FBX:
Конвертируйте на https://products.aspose.app/3d/conversion/fbx-to-glb

---

## 🎨 Структура файлов в проекте

```
I'm-the0one/
├── public/                          # Статические ассеты
│   └── models/                      # Папка для 3D моделей
│       ├── minion-a01.glb
│       ├── minion-a02.glb
│       ├── character-warrior.glb
│       └── character-mage.glb
├── src/
│   ├── js/
│   │   ├── game/
│   │   │   ├── Player.js            # Встроенный персонаж
│   │   │   ├── PlayerNew.js         # Поддержка готовых моделей
│   │   │   ├── CharacterLoader.js   # Менеджер загрузки
│   │   │   └── CharacterController.js # Управление
│   │   └── GameManager.js
│   └── ...
└── ...
```

---

## 💡 Советы по оптимизации

### 1. Размер файлов
- GLB модели должны быть < 500 KB
- Если больше — оптимизируйте в Blender или используйте https://gltf-pack.glb.dev

### 2. Текстуры
- Используйте сжатие WebP если возможно
- Резина текстур: максимум 1024x1024 для браузера

### 3. Полигоны
- Low-poly модели: 10K-50K полигонов
- Medium: 50K-200K полигонов
- Не используйте > 500K полигонов для браузера

### 4. Кэширование
Для offline работы:
```javascript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
}
```

---

## 🔗 Полезные ссылки

- **Gobkit API (CDN ссылки)**: https://gobkit.com/api/free
- **Three.js GLTFLoader**: https://threejs.org/docs/index.html#examples/en/loaders/GLTFLoader
- **Blender (бесплатный редактор)**: https://blender.org
- **Что такое GLB/GLTF**: https://www.khronos.org/gltf/

---

## 🎯 Быстрый старт (3 шага)

1. **Скачайте модель**:
   - Перейдите https://gobkit.itch.io/gobkit-free-minions
   - Нажмите "Download Now"
   - Распакуйте ZIP

2. **Поместите в проект**:
   ```
   public/models/minion-a01.glb
   ```

3. **Используйте в коде**:
   ```javascript
   const player = new Player(scene)
   await player.loadModelFromURL('/models/minion-a01.glb')
   ```

---

## ❓ FAQ

**Q: Могу ли я использовать эти модели коммерчески?**
A: Да! CC0 лицензия разрешает даже коммерческое использование без указания авторства.

**Q: Какой формат лучше для браузера?**
A: GLB — один файл, оптимизирован, быстро загружается.

**Q: Как изменить масштаб модели?**
A: `model.scale.set(2, 2, 2)` для увеличения в 2 раза.

**Q: Как добавить собственную анимацию?**
A: Используйте Blender для создания анимаций и экспорта GLB с анимациями.

**Q: Модель выглядит чёрной/невидимой**
A: Добавьте свет к сцене: `scene.add(new THREE.HemisphereLight(0xffffff, 0.5))`
