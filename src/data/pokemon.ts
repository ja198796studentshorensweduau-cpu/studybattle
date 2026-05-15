export interface StudyMon {
  id: number;
  name: string;
  nickname?: string;
  type: string;
  typeColor: string;
  emoji: string;
  baseHp: number;
  baseAtk: number;
  baseDef: number;
  description: string;
}

export interface WildEncounter {
  mon: StudyMon;
  level: number;
}

/** Returns the nickname if set, otherwise the species name */
export function getDisplayName(mon: StudyMon): string {
  return mon.nickname || mon.name;
}

/**
 * Type effectiveness chart.
 * Key = attacker type, Value = map of defender type → multiplier.
 * 1.5 = super effective, 0.75 = not very effective, 1.0 = neutral (default).
 */
const typeChart: Record<string, Record<string, number>> = {
  Fire:   { Nature: 1.5, Ice: 1.5, Water: 0.75, Earth: 0.75, Fire: 0.75 },
  Water:  { Fire: 1.5, Earth: 1.5, Nature: 0.75, Water: 0.75, Ice: 0.75 },
  Earth:  { Fire: 1.5, Wind: 1.5, Water: 0.75, Nature: 0.75 },
  Wind:   { Nature: 1.5, Earth: 0.75, Ice: 0.75 },
  Ice:    { Wind: 1.5, Nature: 1.5, Fire: 0.75, Water: 0.75 },
  Nature: { Water: 1.5, Earth: 1.5, Fire: 0.75, Ice: 0.75, Wind: 0.75 },
  Dark:   { Light: 1.5, Dark: 0.75 },
  Light:  { Dark: 1.5, Light: 0.75 },
};

/** Get type effectiveness multiplier. Returns 1.5 (super effective), 0.75 (resisted), or 1.0 (neutral). */
export function getTypeMultiplier(attackerType: string, defenderType: string): number {
  return typeChart[attackerType]?.[defenderType] ?? 1.0;
}

/** Human-readable label for a multiplier */
export function getEffectivenessLabel(mult: number): { text: string; color: string } | null {
  if (mult >= 1.5) return { text: 'Super effective!', color: 'text-green-400' };
  if (mult <= 0.75) return { text: 'Not very effective...', color: 'text-orange-400' };
  return null;
}

export const studymons: StudyMon[] = [
  // --- Starters (id 1-3) ---
  { id: 1, name: 'Terraclaw', type: 'Earth', typeColor: '#8B6914', emoji: '🦎', baseHp: 55, baseAtk: 4, baseDef: 7, description: 'A sturdy lizard that burrows through solid rock. Its thick hide makes it incredibly durable in battle.' },
  { id: 2, name: 'Aquafin', type: 'Water', typeColor: '#3B82F6', emoji: '🐟', baseHp: 45, baseAtk: 5, baseDef: 5, description: 'A nimble fish that darts through currents with ease. Well-balanced in both offense and defense.' },
  { id: 3, name: 'Pyrowl', type: 'Fire', typeColor: '#EF4444', emoji: '🦉', baseHp: 35, baseAtk: 8, baseDef: 3, description: 'A fierce owl wreathed in flame. Devastating attacks but fragile — not for the faint of heart.' },

  // --- Wind (id 4, 9, 17, 22, 37, 43) ---
  { id: 4, name: 'Breezel', type: 'Wind', typeColor: '#06B6D4', emoji: '🦅', baseHp: 30, baseAtk: 4, baseDef: 5, description: 'A swift eagle that rides thermal updrafts. Light and agile but not very powerful.' },
  { id: 9, name: 'Stormyx', type: 'Wind', typeColor: '#7C3AED', emoji: '⚡', baseHp: 28, baseAtk: 7, baseDef: 3, description: 'A living bolt of lightning. Strikes fast and hard but cannot withstand a strong blow.' },
  { id: 17, name: 'Volteel', type: 'Wind', typeColor: '#A855F7', emoji: '🐍', baseHp: 32, baseAtk: 8, baseDef: 2, description: 'An electric serpent that coils around prey with shocking speed. Pure glass cannon.' },
  { id: 22, name: 'Zephyrix', type: 'Wind', typeColor: '#22D3EE', emoji: '🦋', baseHp: 25, baseAtk: 5, baseDef: 4, description: 'A delicate butterfly whose wings create razor-sharp gusts. Beautiful but ephemeral.' },
  { id: 37, name: 'Gustraptor', type: 'Wind', typeColor: '#0891B2', emoji: '🦜', baseHp: 34, baseAtk: 6, baseDef: 4, description: 'A colourful raptor that shrieks with the force of a gale. Surprisingly vicious.' },
  { id: 43, name: 'Cyclonix', type: 'Wind', typeColor: '#6366F1', emoji: '🌪️', baseHp: 38, baseAtk: 7, baseDef: 5, description: 'A sentient tornado that wanders the plains. Feared by travellers for its sudden appearances.' },

  // --- Ice (id 5, 10, 15, 19, 30, 38) ---
  { id: 5, name: 'Crystok', type: 'Ice', typeColor: '#93C5FD', emoji: '❄️', baseHp: 40, baseAtk: 3, baseDef: 7, description: 'A living crystal of pure ice. Extremely defensive but slow to attack.' },
  { id: 10, name: 'Glacitaur', type: 'Ice', typeColor: '#60A5FA', emoji: '🐻‍❄️', baseHp: 55, baseAtk: 4, baseDef: 9, description: 'A towering ice bear of immense endurance. One of the tankiest monsters known.' },
  { id: 15, name: 'Avalynx', type: 'Ice', typeColor: '#A5F3FC', emoji: '🐱', baseHp: 38, baseAtk: 5, baseDef: 8, description: 'A frosty feline that prowls frozen caves. Deceptively tough beneath its soft exterior.' },
  { id: 19, name: 'Frostfang', type: 'Ice', typeColor: '#7DD3FC', emoji: '🐺', baseHp: 40, baseAtk: 6, baseDef: 6, description: 'A wolf of the frozen north. Balanced and reliable — a true all-rounder.' },
  { id: 30, name: 'Glacewing', type: 'Ice', typeColor: '#BAE6FD', emoji: '🦢', baseHp: 32, baseAtk: 5, baseDef: 7, description: 'An elegant swan that glides over frozen lakes. Its wings leave trails of frost.' },
  { id: 38, name: 'Permafrost', type: 'Ice', typeColor: '#E0F2FE', emoji: '🏔️', baseHp: 60, baseAtk: 3, baseDef: 10, description: 'A sentient mountain of eternal ice. Nearly immovable, nearly indestructible.' },

  // --- Fire (id 3 above, 6, 14, 18, 24, 29, 39) ---
  { id: 6, name: 'Magmaw', type: 'Fire', typeColor: '#DC2626', emoji: '🐉', baseHp: 45, baseAtk: 6, baseDef: 4, description: 'A small dragon that spews molten rock. Respectable power with decent bulk.' },
  { id: 14, name: 'Inferape', type: 'Fire', typeColor: '#F97316', emoji: '🔥', baseHp: 35, baseAtk: 7, baseDef: 4, description: 'A blazing primate that punches with fists of fire. Fast and furious.' },
  { id: 18, name: 'Emberon', type: 'Fire', typeColor: '#B91C1C', emoji: '🐗', baseHp: 50, baseAtk: 6, baseDef: 5, description: 'A smouldering boar that charges through underbrush, igniting everything in its path.' },
  { id: 24, name: 'Cindervolt', type: 'Fire', typeColor: '#EA580C', emoji: '🦊', baseHp: 33, baseAtk: 9, baseDef: 2, description: 'A fox of living cinders. The highest raw attack power of any fire type — but paper-thin.' },
  { id: 29, name: 'Viperblaze', type: 'Fire', typeColor: '#DC2626', emoji: '🐲', baseHp: 40, baseAtk: 8, baseDef: 3, description: 'A serpentine dragon that breathes streams of white-hot fire. Terrifying to face.' },
  { id: 39, name: 'Scorchion', type: 'Fire', typeColor: '#9A3412', emoji: '🦂', baseHp: 36, baseAtk: 7, baseDef: 5, description: 'A scorpion whose tail drips molten venom. Its sting burns both body and spirit.' },

  // --- Water (id 2 above, 7, 13, 20, 25, 40) ---
  { id: 7, name: 'Tidehorn', type: 'Water', typeColor: '#2563EB', emoji: '🦈', baseHp: 42, baseAtk: 5, baseDef: 6, description: 'A horned shark of the deep seas. A solid fighter with no major weaknesses.' },
  { id: 13, name: 'Tsunarion', type: 'Water', typeColor: '#0EA5E9', emoji: '🌊', baseHp: 45, baseAtk: 5, baseDef: 6, description: 'A spirit of the tidal wave. Crashes into foes with overwhelming momentum.' },
  { id: 20, name: 'Tidecrawl', type: 'Water', typeColor: '#0284C7', emoji: '🦀', baseHp: 48, baseAtk: 4, baseDef: 9, description: 'An armoured crab with claws like steel. Very hard to crack but not the fastest.' },
  { id: 25, name: 'Coralhorn', type: 'Water', typeColor: '#0369A1', emoji: '🐙', baseHp: 38, baseAtk: 6, baseDef: 5, description: 'An octopus adorned with coral horns. Its many arms make it unpredictable.' },
  { id: 40, name: 'Abysseel', type: 'Water', typeColor: '#1E3A5F', emoji: '🐋', baseHp: 55, baseAtk: 5, baseDef: 7, description: 'A deep-sea leviathan that surfaces only during storms. Its song shakes the ocean floor.' },

  // --- Earth (id 1 above, 8, 12, 21, 26, 41) ---
  { id: 8, name: 'Quakeon', type: 'Earth', typeColor: '#92400E', emoji: '🐂', baseHp: 55, baseAtk: 4, baseDef: 8, description: 'A bull that shakes the earth with each step. Built like a fortress on four legs.' },
  { id: 12, name: 'Bouldrake', type: 'Earth', typeColor: '#78716C', emoji: '🪨', baseHp: 60, baseAtk: 3, baseDef: 10, description: 'A creature of living stone. Almost impossible to damage but painfully slow to attack.' },
  { id: 21, name: 'Sandwyrm', type: 'Earth', typeColor: '#A16207', emoji: '🐛', baseHp: 52, baseAtk: 5, baseDef: 6, description: 'A burrowing wyrm of the desert dunes. It ambushes prey from below with crushing force.' },
  { id: 26, name: 'Petragon', type: 'Earth', typeColor: '#57534E', emoji: '🗿', baseHp: 70, baseAtk: 2, baseDef: 12, description: 'An ancient stone sentinel. The absolute peak of defense — but its attacks barely scratch.' },
  { id: 41, name: 'Ironmole', type: 'Earth', typeColor: '#78350F', emoji: '🦡', baseHp: 46, baseAtk: 5, baseDef: 8, description: 'A badger with iron-hard claws. Digs tunnels through bedrock as easily as soil.' },

  // --- Nature (id 11, 16, 23, 42) ---
  { id: 11, name: 'Floravine', type: 'Nature', typeColor: '#16A34A', emoji: '🌿', baseHp: 35, baseAtk: 4, baseDef: 5, description: 'A sentient vine that sways gently in the breeze. Looks harmless, but its grip is iron.' },
  { id: 16, name: 'Thornback', type: 'Nature', typeColor: '#15803D', emoji: '🦔', baseHp: 42, baseAtk: 5, baseDef: 7, description: 'A hedgehog covered in venomous thorns. Attackers hurt themselves more than they hurt it.' },
  { id: 23, name: 'Mossgolem', type: 'Nature', typeColor: '#166534', emoji: '🧌', baseHp: 65, baseAtk: 3, baseDef: 11, description: 'A towering golem of moss and ancient wood. Immovable as the forest itself.' },
  { id: 42, name: 'Sporeshroom', type: 'Nature', typeColor: '#4ADE80', emoji: '🍄', baseHp: 44, baseAtk: 4, baseDef: 6, description: 'A mushroom creature that releases clouds of spores. Oddly endearing despite the toxins.' },

  // --- Dark (id 27, 44, 46) ---
  { id: 27, name: 'Shadowmist', type: 'Dark', typeColor: '#6B21A8', emoji: '👻', baseHp: 30, baseAtk: 7, baseDef: 4, description: 'A wraith of living shadow. It feeds on fear and strikes when you least expect.' },
  { id: 44, name: 'Nightcrawl', type: 'Dark', typeColor: '#581C87', emoji: '🦇', baseHp: 28, baseAtk: 6, baseDef: 3, description: 'A bat that hunts in total darkness. Its echolocation reveals every weakness.' },
  { id: 46, name: 'Grimreap', type: 'Dark', typeColor: '#4C1D95', emoji: '💀', baseHp: 42, baseAtk: 8, baseDef: 4, description: 'A skeletal horror wreathed in dark energy. Devastating attacks but brittle bones.' },

  // --- Light (id 28, 45, 47) ---
  { id: 28, name: 'Luminos', type: 'Light', typeColor: '#FDE047', emoji: '✨', baseHp: 35, baseAtk: 6, baseDef: 6, description: 'A being of pure radiance. Balanced in all aspects, it shines brightest in adversity.' },
  { id: 45, name: 'Solarbeam', type: 'Light', typeColor: '#FACC15', emoji: '☀️', baseHp: 40, baseAtk: 7, baseDef: 5, description: 'A miniature sun that hovers above the ground. Its light burns through even stone.' },
  { id: 47, name: 'Prismoth', type: 'Light', typeColor: '#FEF08A', emoji: '🦚', baseHp: 32, baseAtk: 5, baseDef: 7, description: 'A peacock whose feathers refract light into dazzling rainbows. Blinding and beautiful.' },

  // --- Rare / Boss-tier (id 48-50) ---
  { id: 48, name: 'Voidmaw', type: 'Dark', typeColor: '#1E1B4B', emoji: '🕳️', baseHp: 50, baseAtk: 9, baseDef: 5, description: 'A maw into the void itself. Said to devour light, sound, and hope in equal measure.' },
  { id: 49, name: 'Aurorex', type: 'Light', typeColor: '#FEF9C3', emoji: '🌈', baseHp: 48, baseAtk: 7, baseDef: 8, description: 'A legendary beast draped in aurora light. Equally skilled in attack and defense.' },
  { id: 50, name: 'Terraflux', type: 'Earth', typeColor: '#B45309', emoji: '🌋', baseHp: 75, baseAtk: 6, baseDef: 10, description: 'A volcanic titan of magma and stone. The rarest encounter — and the hardest to fell.' },
];

// Build the encounter pool — all mons are encounterable
// Order matters: earlier indices appear at lower player levels
export const wildEncounters: StudyMon[] = [
  // Early game (player level 1-9 → indices 0-5)
  studymons.find(m => m.id === 2)!,   // Aquafin
  studymons.find(m => m.id === 4)!,   // Breezel
  studymons.find(m => m.id === 11)!,  // Floravine
  studymons.find(m => m.id === 22)!,  // Zephyrix
  studymons.find(m => m.id === 5)!,   // Crystok
  studymons.find(m => m.id === 44)!,  // Nightcrawl

  // Mid-early (level 9-18 → indices 6-11)
  studymons.find(m => m.id === 9)!,   // Stormyx
  studymons.find(m => m.id === 7)!,   // Tidehorn
  studymons.find(m => m.id === 6)!,   // Magmaw
  studymons.find(m => m.id === 16)!,  // Thornback
  studymons.find(m => m.id === 28)!,  // Luminos
  studymons.find(m => m.id === 42)!,  // Sporeshroom

  // Mid (level 18-30 → indices 12-17)
  studymons.find(m => m.id === 8)!,   // Quakeon
  studymons.find(m => m.id === 14)!,  // Inferape
  studymons.find(m => m.id === 15)!,  // Avalynx
  studymons.find(m => m.id === 17)!,  // Volteel
  studymons.find(m => m.id === 27)!,  // Shadowmist
  studymons.find(m => m.id === 37)!,  // Gustraptor

  // Mid-late (level 30-45 → indices 18-23)
  studymons.find(m => m.id === 13)!,  // Tsunarion
  studymons.find(m => m.id === 18)!,  // Emberon
  studymons.find(m => m.id === 19)!,  // Frostfang
  studymons.find(m => m.id === 21)!,  // Sandwyrm
  studymons.find(m => m.id === 25)!,  // Coralhorn
  studymons.find(m => m.id === 39)!,  // Scorchion

  // Late (level 45-60 → indices 24-29)
  studymons.find(m => m.id === 12)!,  // Bouldrake
  studymons.find(m => m.id === 20)!,  // Tidecrawl
  studymons.find(m => m.id === 23)!,  // Mossgolem
  studymons.find(m => m.id === 24)!,  // Cindervolt
  studymons.find(m => m.id === 29)!,  // Viperblaze
  studymons.find(m => m.id === 30)!,  // Glacewing

  // End-game (level 60-80 → indices 30-35)
  studymons.find(m => m.id === 10)!,  // Glacitaur
  studymons.find(m => m.id === 26)!,  // Petragon
  studymons.find(m => m.id === 40)!,  // Abysseel
  studymons.find(m => m.id === 41)!,  // Ironmole
  studymons.find(m => m.id === 43)!,  // Cyclonix
  studymons.find(m => m.id === 45)!,  // Solarbeam

  // Rare (level 80+ → indices 36-41)
  studymons.find(m => m.id === 38)!,  // Permafrost
  studymons.find(m => m.id === 46)!,  // Grimreap
  studymons.find(m => m.id === 47)!,  // Prismoth
  studymons.find(m => m.id === 48)!,  // Voidmaw
  studymons.find(m => m.id === 49)!,  // Aurorex
  studymons.find(m => m.id === 50)!,  // Terraflux
];

export function getRandomWildEncounter(playerLevel: number): WildEncounter {
  const maxIdx = Math.min(Math.floor(playerLevel / 3) + 3, wildEncounters.length);
  const mon = wildEncounters[Math.floor(Math.random() * maxIdx)];
  const levelVariance = Math.floor(Math.random() * 5) - 2;
  const level = Math.max(1, Math.min(playerLevel + levelVariance, 100));
  return { mon: { ...mon }, level };
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
