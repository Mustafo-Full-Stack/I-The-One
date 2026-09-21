# 🎮 Управление персонажем + Готовые модели

## 📌 Что добавлено

1. **Управление персонажем** (WASD + SPACE для прыжка)
2. **Динамическая загрузка готовых 3D моделей** из интернета
3. **Система управления персонажами** (CharacterLoader, CharacterController)
4. **Пример с управлением** - game-with-controls.html

---

## 🚀 Быстрый старт - Тестирование управления

### Откройте файл:
```
game-with-controls.html
```

Этот файл уже полностью настроен для:
- ✅ Управления встроенным персонажем (WASD + SPACE)
- ✅ Загрузки готовых моделей по URL
- ✅ Изменения масштаба и позиции камеры

---

## 🎮 Как использовать готовые модели

### Вариант 1: Gobkit Free Minions (РЕКОМЕНДУЕТСЯ)

1. **Скачайте модели**:
   - https://gobkit.itch.io/gobkit-free-minions
   - Нажмите "Download Now"
   - Распакуйте ZIP

2. **Поместите в проект**:
   ```
   public/models/minion-a01.glb
   public/models/minion-a02.glb
   ```

3. **Используйте в коде** (для Vite):
   ```javascript
   import { Player } from './js/game/Player.js'
   
   const player = new Player(scene)
   await player.loadModelFromURL('/models/minion-a01.glb')
   ```

### Вариант 2: Использование API (без загрузки)

Используйте прямые ссылки из Gobkit API:
```javascript
// Прямые URL на готовые модели
const modelUrl = 'https://gobkit.com/api/free'

// Или конкретные минионы
const models = [
  'https://gobkit.com/minions/glb/minion-a01.glb',
  'https://gobkit.com/minions/glb/minion-a02.glb'
]
```

### Вариант 3: Другие источники

**KayKit Adventurers**:
- https://kaylousberg.itch.io/kaykit-adventurers
- Скачать, распаковать, использовать GLB файлы

**Quaternius** (low-poly):
- https://quaternius.com
- Выбрать персонажа, скачать GLB

---

## ⌨️ Управление

### Клавиатура:
- **W** - Вперёд
- **S** - Назад
- **A** - Влево
- **D** - Вправо
- **↑↓←→** - Альтернативное управление
- **SPACE** - Прыжок

### Мобильный (в разработке):
- Виртуальные кнопки направления
- Кнопка прыжка

---

## 📁 Созданные файлы

### Основные модули:

1. **src/js/game/PlayerNew.js** (119 строк)
   - Загрузка готовых моделей GLB/GLTF
   - Встроенная поддержка анимаций
   - Fallback на встроенного персонажа

2. **src/js/game/CharacterLoader.js** (119 строк)
   - Менеджер загрузки моделей
   - Управление несколькими персонажами
   - Воспроизведение анимаций

3. **src/js/game/CharacterController.js** (105 строк)
   - Управление движением персонажа
   - Поддержка клавиатуры и касаний
   - Физика (гравитация, прыжок)

4. **game-with-controls.html** (435 строк)
   - Полнофункциональный пример
   - Встроенное управление
   - Загрузка моделей из URL
   - Готов к использованию

### Документация:

5. **MODELS_GUIDE.md** (257 строк)
   - Полное руководство по ассетам
   - Рекомендуемые источники
   - Примеры кода
   - Советы по оптимизации

---

## 💻 Пример кода - Использование в своём проекте

### Способ 1: С game-with-controls.html
Просто откройте файл в браузере - всё уже работает!

### Способ 2: С Vite модулями
```javascript
import { Player } from './js/game/PlayerNew.js'
import { CharacterController } from './js/game/CharacterController.js'

// В GameManager
const player = new Player(scene)

// Загрузить готовую модель
try {
  await player.loadModelFromURL('/models/minion-a01.glb')
} catch (e) {
  console.log('Модель не загружена, используется встроенный персонаж')
}

// Создать контроллер управления
const controller = new CharacterController(player.group)

// В игровом цикле
function animate() {
  controller.update(deltaTime)
  renderer.render(scene, camera)
}
```

### Способ 3: С CharacterLoader (несколько персонажей)
```javascript
import { CharacterLoader } from './js/game/CharacterLoader.js'

const loader = new CharacterLoader(scene)

// Загрузить несколько моделей
await loader.loadCharacter('/models/minion-a01.glb', 'minion1')
await loader.loadCharacter('/models/minion-a02.glb', 'minion2')

// Переключаться между ними
loader.switchCharacter('minion1')
loader.playAnimation(0) // Играть первую анимацию

// Обновление
function animate() {
  loader.update(deltaTime)
  renderer.render(scene, camera)
}
```

---

## 🎯 Какие модели скачать для начала

### BEST CHOICE - Gobkit Free Minions
✅ **Почему**: 
- Специально для браузерных игр
- Готовые анимации (idle, attack, dead)
- Оптимизированы
- CC0 лицензия
- Работают прямо из коробки

📥 **Скачать**: https://gobkit.itch.io/gobkit-free-minions

### ALTERNATIVE - KayKit Adventurers
✅ **Почему**:
- Уникальный low-poly стиль
- 5 готовых персонажей
- CC0 лицензия

📥 **Скачать**: https://kaylousberg.itch.io/kaykit-adventurers

---

## 🔍 Проверка функционала

### Тест 1: Управление встроенным персонажем
```bash
# Откройте game-with-controls.html
# Нажмите W, S, A, D - персонаж должен двигаться
# Нажмите SPACE - персонаж должен прыгать
```

### Тест 2: Загрузка готовой модели
```bash
# 1. Скачайте minion-a01.glb из Gobkit
# 2. Откройте game-with-controls.html
# 3. Введите в поле URL: https://gobkit.com/api/free
# 4. Нажмите "Загрузить"
# (или используйте локальный URL если разместили локально)
```

### Тест 3: Использование в модулях Vite
```bash
# 1. Установите зависимости
npm install

# 2. Запустите dev сервер
npm run dev

# 3. Откройте http://localhost:5173
```

---

## 📊 Структура проекта теперь

```
I'm-the0one/
├── game.html                          # Исходная версия
├── game-with-controls.html            # 🆕 С управлением
├── MODELS_GUIDE.md                    # 🆕 Руководство по моделям
├── SETUP_INSTRUCTIONS.md              # 🆕 Этот файл
├── src/
│   └── js/
│       └── game/
│           ├── Player.js              # Встроенный персонаж
│           ├── PlayerNew.js           # 🆕 Поддержка готовых моделей
│           ├── CharacterLoader.js     # 🆕 Менеджер моделей
│           ├── CharacterController.js # 🆕 Управление персонажем
│           ├── Scene.js
│           ├── Camera.js
│           └── Lighting.js
└── public/
    └── models/                        # 📁 Поместите модели сюда
        ├── minion-a01.glb
        └── minion-a02.glb
```

---

## 🐛 Возможные проблемы

### Проблема: Модель не загружается
**Решение**:
- Проверьте URL (должен быть доступен)
- Проверьте консоль браузера (F12)
- Убедитесь, что файл GLB, не OBJ или FBX

### Проблема: Персонаж чёрный/невидимый
**Решение**:
- Добавьте свет к сцене
- Проверьте масштаб модели (может быть огромной)
- Используйте `model.scale.set(0.5, 0.5, 0.5)`

### Проблема: Управление не работает
**Решение**:
- Убедитесь, что canvas в фокусе
- Проверьте консоль на ошибки
- Переоткройте страницу

---

## 🎓 Следующие шаги

### Уровень 1 - Базовое:
- [ ] Загрузить и протестировать Gobkit модели
- [ ] Добавить несколько персонажей на выбор
- [ ] Настроить управление под себя

### Уровень 2 - Среднее:
- [ ] Создать менеджер персонажей (выбор в меню)
- [ ] Добавить звуковые эффекты при движении
- [ ] Сохранять выбранного персонажа в localStorage

### Уровень 3 - Продвинутое:
- [ ] Добавить врагов (AI)
- [ ] Боевая система
- [ ] Кастомизация персонажа
- [ ] Мультиплеер

---

## 📞 Поддержка

Если что-то не работает:
1. Проверьте консоль браузера (F12)
2. Прочитайте MODELS_GUIDE.md
3. Убедитесь, что файлы на месте
4. Попробуйте другую модель

---

## 📄 Лицензия

Все добавленные модели используют CC0 лицензию - полностью свободны для использования!

---

**Готово к использованию!** 🚀

Откройте `game-with-controls.html` и начните управлять персонажем прямо сейчас!
