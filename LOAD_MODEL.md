# 🎮 Как загрузить красивую готовую модель персонажа

## 📥 ШАГ 1: Скачайте бесплатную модель

### Вариант 1: Gobkit Free Minions (РЕКОМЕНДУЕТСЯ)
1. Откройте: https://gobkit.itch.io/gobkit-free-minions
2. Нажмите "Download Now"
3. Распакуйте ZIP файл
4. Найдите файлы `minion-a01.glb`, `minion-a02.glb` и т.д.

### Вариант 2: KayKit Adventurers
1. Откройте: https://kaylousberg.itch.io/kaykit-adventurers
2. Скачайте свободную версию
3. Распакуйте и найдите GLB файлы

---

## 📁 ШАГ 2: Поместите модель в папку проекта

Создайте папку `models` рядом с файлом game-play.html:

```
I'm-the0one/
├── game-play.html
├── models/
│   ├── minion-a01.glb
│   ├── minion-a02.glb
│   └── ...
```

---

## 🔧 ШАГ 3: Загрузите модель в игру

### Способ 1: Отредактируйте game-play.html

Откройте файл **game-play.html** в текстовом редакторе (Notepad++, VS Code и т.д.)

Найдите строку (примерно строка 288):
```javascript
      // loadModelFromURL('https://gobkit.com/api/free') // Gobkit API
      // loadModelFromURL('/models/character.glb') // Локальная модель
```

**Раскомментируйте нужную строку:**

Если модель локальная:
```javascript
loadModelFromURL('/models/minion-a01.glb') // Загрузит локальную модель
```

Или используйте по URL:
```javascript
loadModelFromURL('https://gobkit.com/api/free')
```

Сохраните файл и откройте его в браузере.

---

## 🎯 Примеры готовых моделей

### Gobkit Minions (рекомендуется)
```javascript
loadModelFromURL('/models/minion-a01.glb')
loadModelFromURL('/models/minion-a02.glb')
```

### По прямым ссылкам (если размещены в интернете)
```javascript
loadModelFromURL('https://example.com/models/character.glb')
```

---

## ⚠️ Важно!

- Файл должен быть в формате **GLB** или **GLTF**
- Модель должна быть оптимизирована для браузера (< 500 KB)
- Размер модели может быть большим - используется масштабирование

---

## 🎮 После загрузки:

1. Откройте **game-play.html** в браузере
2. Вместо встроенного персонажа появится красивая готовая модель
3. Управление остаётся тем же:
   - **WASD** - движение
   - **SPACE** - прыжок

---

## ✅ Готово!

Теперь у вас есть красивый персонаж вместо простых геометрических фигур! 🎮
