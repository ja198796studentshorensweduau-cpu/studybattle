export interface StudyMon {
  id: number;
  name: string;
  type: string;
  typeColor: string;
  emoji: string;
  baseHp: number;
  baseAtk: number;
  baseDef: number;
}

export interface WildEncounter {
  mon: StudyMon;
  level: number;
}

export const studymons: StudyMon[] = [
  { id: 1, name: 'Terraclaw', type: 'Earth', typeColor: '#8B6914', emoji: '🦎', baseHp: 55, baseAtk: 4, baseDef: 7 },
  { id: 2, name: 'Aquafin', type: 'Water', typeColor: '#3B82F6', emoji: '🐟', baseHp: 45, baseAtk: 5, baseDef: 5 },
  { id: 3, name: 'Pyrowl', type: 'Fire', typeColor: '#EF4444', emoji: '🦉', baseHp: 35, baseAtk: 8, baseDef: 3 },
  { id: 4, name: 'Breezel', type: 'Wind', typeColor: '#06B6D4', emoji: '🦅', baseHp: 30, baseAtk: 4, baseDef: 5 },
  { id: 5, name: 'Crystok', type: 'Ice', typeColor: '#93C5FD', emoji: '❄️', baseHp: 40, baseAtk: 3, baseDef: 7 },
  { id: 6, name: 'Magmaw', type: 'Fire', typeColor: '#DC2626', emoji: '🐉', baseHp: 45, baseAtk: 6, baseDef: 4 },
  { id: 7, name: 'Tidehorn', type: 'Water', typeColor: '#2563EB', emoji: '🦈', baseHp: 42, baseAtk: 5, baseDef: 6 },
  { id: 8, name: 'Quakeon', type: 'Earth', typeColor: '#92400E', emoji: '🐂', baseHp: 55, baseAtk: 4, baseDef: 8 },
  { id: 9, name: 'Stormyx', type: 'Wind', typeColor: '#7C3AED', emoji: '⚡', baseHp: 28, baseAtk: 7, baseDef: 3 },
  { id: 10, name: 'Glacitaur', type: 'Ice', typeColor: '#60A5FA', emoji: '🐻‍❄️', baseHp: 55, baseAtk: 4, baseDef: 9 },
  { id: 11, name: 'Floravine', type: 'Nature', typeColor: '#16A34A', emoji: '🌿', baseHp: 35, baseAtk: 4, baseDef: 5 },
  { id: 12, name: 'Bouldrake', type: 'Earth', typeColor: '#78716C', emoji: '🪨', baseHp: 60, baseAtk: 3, baseDef: 10 },
  { id: 13, name: 'Tsunarion', type: 'Water', typeColor: '#0EA5E9', emoji: '🌊', baseHp: 45, baseAtk: 5, baseDef: 6 },
  { id: 14, name: 'Inferape', type: 'Fire', typeColor: '#F97316', emoji: '🔥', baseHp: 35, baseAtk: 7, baseDef: 4 },
  { id: 15, name: 'Avalynx', type: 'Ice', typeColor: '#A5F3FC', emoji: '🐱', baseHp: 38, baseAtk: 5, baseDef: 8 },
];

export const wildEncounters: StudyMon[] = [
  studymons[1],
  studymons[3],
  studymons[10],
  studymons[0],
  studymons[4],
  studymons[2],
  studymons[8],
  studymons[6],
  studymons[5],
  studymons[7],
  studymons[11],
  studymons[12],
  studymons[13],
  studymons[14],
  studymons[9],
];

export function getRandomWildEncounter(playerLevel: number): WildEncounter {
  const maxIdx = Math.min(Math.floor(playerLevel / 3) + 3, wildEncounters.length);
  const mon = wildEncounters[Math.floor(Math.random() * maxIdx)];
  const levelVariance = Math.floor(Math.random() * 5) - 2;
  const level = Math.max(1, Math.min(playerLevel + levelVariance, 100));
  return { mon, level };
}

export function calculateHp(mon: StudyMon, level: number): number {
  return Math.floor(mon.baseHp + (mon.baseHp * level) / 10);
}

export function calculateAtk(mon: StudyMon, level: number): number {
  return Math.floor(mon.baseAtk + (mon.baseAtk * level) / 15);
}

export function calculateDef(mon: StudyMon, level: number): number {
  return Math.floor(mon.baseDef + (mon.baseDef * level) / 15);
}

export function calculateDamage(atkStat: number, defStat: number, level: number): number {
  const levelFactor = 1 + level * 0.1;
  const raw = (atkStat + 1) * levelFactor * (8 / (8 + defStat));
  const variance = 0.85 + Math.random() * 0.3;
  return Math.max(1, Math.floor(raw * variance));
}

export function xpForLevel(level: number): number {
  return Math.floor(level * level * 10 + level * 25);
}

export function xpGainFromBattle(enemyLevel: number): number {
  return Math.floor(enemyLevel * 15 + 20);
}
