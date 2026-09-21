const STORAGE_KEY = 'selectedCharacter'

// Единственный источник правды по статическим данным персонажей.
// price — цена в магазине (Человек бесплатен). Кошелёк и владения —
// в Economy.js (localStorage). Внешность строится из type (CharacterFactory).
// Урон строго растёт с ценой: дороже персонаж — сильнее удар.
// Щиты (защита): 1 щит = блокирует 1 удар. Кончились щиты — следующий
// чистый удар выбивает с ринга.
//   < $5,000 ......... 0 щитов (Человек, Воин, MAGA)
//   $5,000–$20,000 ... 1 щит (Ниндзя, Обезьяна, Робот)
//   > $20,000 ........ 2 щита (Динозавр, Гигант, King Kong, Босс)
//   Король ........... 3 щита (МАКС, только у него)
export const CHARACTERS = [
  { id: 'human',   name: 'Человек',  type: 'human',   price: 0,     health: 100, defense: 10, attackRange: 4.0, damage: 15, height: 1.8, shields: 0 },
  { id: 'maga',    name: 'MAGA',     type: 'maga',    price: 2000,  health: 120, defense: 15, attackRange: 4.0, damage: 20, height: 1.7, shields: 0 },
  { id: 'warrior', name: 'Воин',     type: 'warrior', price: 3500,  health: 150, defense: 25, attackRange: 3.6, damage: 25, height: 1.9, shields: 0 },
  { id: 'ninja',   name: 'Ниндзя',   type: 'ninja',   price: 7000,  health: 110, defense: 12, attackRange: 4.0, damage: 32, height: 1.75, shields: 1 },
  { id: 'monkey',  name: 'Обезьяна', type: 'monkey',  price: 10000, health: 170, defense: 20, attackRange: 3.8, damage: 36, height: 1.7, shields: 1 },
  { id: 'robot',   name: 'Робот',    type: 'robot',   price: 15000, health: 220, defense: 45, attackRange: 4.2, damage: 42, height: 2.0, shields: 1 },
  { id: 'dino',    name: 'Динозавр', type: 'dino',    price: 22000, health: 300, defense: 35, attackRange: 5.5, damage: 50, height: 4.2, shields: 2 },
  { id: 'giant',   name: 'Гигант',   type: 'giant',   price: 30000, health: 450, defense: 60, attackRange: 6.2, damage: 58, height: 4.5, shields: 2 },
  { id: 'kong',    name: 'King Kong', type: 'kong',   price: 40000, health: 550, defense: 70, attackRange: 6.8, damage: 68, height: 6.0, shields: 2 },
  { id: 'boss',    name: 'Босс',     type: 'boss',    price: 45000, health: 500, defense: 65, attackRange: 6.0, damage: 75, height: 4.8, shields: 2 },
  { id: 'king',    name: 'Король',   type: 'king',    price: 50000, health: 200, defense: 35, attackRange: 4.4, damage: 85, height: 2.0, shields: 3 }
]

// Играбельны: бесплатный Человек, MAGA ($2,000) и Воин ($3,500).
// Остальные заблокированы (видны, но не выбираются и не покупаются).
export const PLAYABLE_IDS = ['human', 'maga', 'warrior']

export function getCharacterById(id) {
  return CHARACTERS.find(c => c.id === id) || CHARACTERS[0]
}

// Миграция старого id 'man' -> 'human' (ранняя версия данных)
function normalizeId(id) {
  if (id === 'man') return 'human'
  return id
}

export function getSelectedCharacterId() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const id = normalizeId(raw)
    if (id && CHARACTERS.some(c => c.id === id)) return id
  } catch (e) { /* localStorage недоступен */ }
  return CHARACTERS[0].id
}

export function setSelectedCharacterId(id) {
  id = normalizeId(id)
  if (!id || !CHARACTERS.some(c => c.id === id)) return
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch (e) { /* localStorage недоступен */ }
}

export function formatBalance(value) {
  return '$' + Number(value || 0).toLocaleString('en-US')
}
