// Уровни сложности — только для «Играть с ботами».
// Пул ботов — по щитам персонажей, награда за каждый килл своя.
// Оружие ботов растёт с уровнем: легко — кулаки, средне — ножи,
// сложно — катаны/АК, невозможно — катаны/АК/пулемёты (вид + дальность).
export const DIFFICULTIES = [
  {
    id: 'easy', name: 'Легко', icon: '🌱',
    desc: 'Боты с 1 щитом: Ниндзя, Обезьяна, Робот',
    reward: 100, pool: ['ninja', 'monkey', 'robot'],
    speedMul: 0.9, atkCd: 2.8, armed: false, arms: []
  },
  {
    id: 'medium', name: 'Средне', icon: '⚔️',
    desc: 'Боты с 2 щитами и ножами',
    reward: 250, pool: ['dino', 'giant', 'kong', 'boss'],
    speedMul: 1.0, atkCd: 2.5, armed: false, arms: ['knife']
  },
  {
    id: 'hard', name: 'Сложно', icon: '🔥',
    desc: 'Боты с 2–3 щитами, катаны и АК',
    reward: 500, pool: ['dino', 'giant', 'kong', 'boss', 'king'],
    speedMul: 1.15, atkCd: 2.0, armed: false, arms: ['katana', 'ak']
  },
  {
    id: 'impossible', name: 'Невозможно', icon: '💀',
    desc: 'Три Короля: катаны, АК, пулемёты',
    reward: 1500, pool: ['king', 'king', 'king'],
    speedMul: 1.35, atkCd: 1.4, armed: true, arms: ['katana', 'ak', 'mg']
  }
]

export function getDifficulty(id) {
  return DIFFICULTIES.find(d => d.id === id) || DIFFICULTIES[1]
}
