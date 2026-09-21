// Карты-крыши: пользователь выбирает перед боем. Все больше 50×50.
// players — всего бойцов на карте (ты + боты). style — свой дизайн крыши.
export const ARENAS = [
  { id: 'roof60',  name: 'Крыша 60',  icon: '🏢', size: 60,  players: 5,  style: 'classic', desc: 'Компактная крыша 60×60. Быстрые бои.' },
  { id: 'roof80',  name: 'Крыша 80',  icon: '🌃', size: 80,  players: 8,  style: 'neon',    desc: 'Просторная крыша 80×80. Есть где разбежаться.' },
  { id: 'roof100', name: 'Крыша 100', icon: '🌆', size: 100, players: 10, style: 'sand',    desc: 'Гигантская крыша 100×100 для долгой охоты.' },
  { id: 'roof120', name: 'Крыша 120', icon: '🌇', size: 120, players: 12, style: 'gold',    desc: 'Арена-монстр 120×120. Выживут не все.' }
]

export function getArena(id) {
  return ARENAS.find(a => a.id === id) || ARENAS[0]
}
