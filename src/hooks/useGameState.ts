import { useState, useCallback } from 'react';
import { StudyMon, studymons, xpForLevel } from '../data/pokemon';

export interface PartyMember {
  mon: StudyMon;
  capturedAtLevel: number;
}

export interface QuestionRecord {
  questionId: string;
  category: string;
  correct: boolean;
  timestamp: number;
}

export interface SaveData {
  playerName: string;
  activeMon: StudyMon;
  party: PartyMember[];
  level: number;
  xp: number;
  totalXp: number;
  battlesWon: number;
  battlesLost: number;
  questionsAnswered: QuestionRecord[];
  streak: number;
  bestStreak: number;
  createdAt: number;
  lastPlayedAt: number;
  /** IDs of monsters ever encountered in battle */
  encounteredMonIds?: number[];
  /** IDs of monsters ever captured / rescued */
  capturedMonIds?: number[];
  /** Anti-tamper checksum */
  _cs?: string;
  /** Set to true if save failed integrity check */
  _tampered?: boolean;
}

const SAVE_KEY = 'studybattle_saves_v2';
const SALT = 'sb_v2_integrity_';

/** Simple hash for integrity checking — not cryptographic, just tamper detection */
function computeChecksum(data: SaveData): string {
  const raw = `${SALT}${data.playerName}|${data.level}|${data.xp}|${data.totalXp}|${data.battlesWon}|${data.battlesLost}|${data.questionsAnswered.length}|${data.streak}|${data.bestStreak}|${data.activeMon.id}|${data.party.length}|${data.createdAt}`;
  // Simple string hash
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const chr = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return hash.toString(36);
}

/** Validate a save and clamp values to legitimate bounds. Returns cleaned save. */
function validateSave(data: SaveData): SaveData {
  const clean = { ...data };

  // Clamp level
  if (typeof clean.level !== 'number' || clean.level < 1) clean.level = 1;
  if (clean.level > 100) clean.level = 100;

  // Clamp XP — max XP at any level is xpForLevel(level)
  const maxXp = xpForLevel(clean.level);
  if (typeof clean.xp !== 'number' || clean.xp < 0) clean.xp = 0;
  if (clean.xp >= maxXp && clean.level < 100) clean.xp = maxXp - 1;

  // Clamp totalXp — can't be more than what's needed to reach current level + current xp
  let expectedMaxTotalXp = clean.xp;
  for (let l = 1; l < clean.level; l++) expectedMaxTotalXp += xpForLevel(l);
  if (typeof clean.totalXp !== 'number' || clean.totalXp < 0) clean.totalXp = 0;
  // Allow some margin (200%) for edge cases, but catch extreme edits
  if (clean.totalXp > expectedMaxTotalXp * 2 + 1000) clean.totalXp = expectedMaxTotalXp;

  // Clamp streaks
  if (typeof clean.streak !== 'number' || clean.streak < 0) clean.streak = 0;
  if (typeof clean.bestStreak !== 'number' || clean.bestStreak < 0) clean.bestStreak = 0;
  if (clean.bestStreak > clean.questionsAnswered.length) clean.bestStreak = clean.questionsAnswered.length;
  if (clean.streak > clean.bestStreak) clean.streak = clean.bestStreak;

  // Clamp battle counts
  if (typeof clean.battlesWon !== 'number' || clean.battlesWon < 0) clean.battlesWon = 0;
  if (typeof clean.battlesLost !== 'number' || clean.battlesLost < 0) clean.battlesLost = 0;

  // Party size cap (reasonable max: 10)
  if (clean.party.length > 10) clean.party = clean.party.slice(0, 10);

  // Check integrity
  if (clean._cs !== undefined) {
    const expected = computeChecksum({ ...clean, _cs: undefined, _tampered: undefined } as SaveData);
    if (clean._cs !== expected) {
      clean._tampered = true;
    }
  }

  return clean;
}

export function loadSaves(): (SaveData | null)[] {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return [null, null, null];
    const saves: (SaveData | null)[] = JSON.parse(raw);
    // Validate each save on load
    return saves.map(s => s ? validateSave(s) : null);
  } catch {
    return [null, null, null];
  }
}

export function saveSaveData(slot: number, data: SaveData) {
  // Add checksum before saving
  const withChecksum = { ...data, _tampered: undefined };
  withChecksum._cs = computeChecksum(withChecksum);
  const saves = loadSaves();
  saves[slot] = withChecksum;
  localStorage.setItem(SAVE_KEY, JSON.stringify(saves));
}

export function deleteSaveData(slot: number) {
  const saves = loadSaves();
  saves[slot] = null;
  localStorage.setItem(SAVE_KEY, JSON.stringify(saves));
}

export function exportSaveToFile(slot: number) {
  const saves = loadSaves();
  const save = saves[slot];
  if (!save) return;
  const json = JSON.stringify(save, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `studybattle_save_${slot + 1}_${save.playerName}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importSaveFromJSON(slot: number, data: unknown): string | null {
  if (!data || typeof data !== 'object') return 'Invalid save file.';
  const d = data as Record<string, unknown>;
  if (typeof d.playerName !== 'string') return 'Missing playerName.';
  if (!d.activeMon || typeof d.activeMon !== 'object') return 'Missing activeMon.';
  if (typeof d.level !== 'number') return 'Missing level.';
  if (typeof d.xp !== 'number') return 'Missing xp.';
  if (!Array.isArray(d.questionsAnswered)) return 'Missing questionsAnswered.';
  // Ensure party exists
  if (!Array.isArray(d.party)) {
    (d as Record<string, unknown>).party = [];
  }
  saveSaveData(slot, data as SaveData);
  return null;
}

export function createNewSave(name: string, starterIndex: number): SaveData {
  const starter = studymons[starterIndex];
  return {
    playerName: name,
    activeMon: starter,
    party: [],
    level: 1,
    xp: 0,
    totalXp: 0,
    battlesWon: 0,
    battlesLost: 0,
    questionsAnswered: [],
    streak: 0,
    bestStreak: 0,
    createdAt: Date.now(),
    lastPlayedAt: Date.now(),
    encounteredMonIds: [starter.id],
    capturedMonIds: [starter.id],
  };
}

export const CAPTURE_COST = 30;

export type GameScreen = 'title' | 'new_game' | 'overworld' | 'battle' | 'stats' | 'party';

export function useGameState() {
  const [screen, setScreen] = useState<GameScreen>('title');
  const [saveSlot, setSaveSlot] = useState<number>(0);
  const [gameData, setGameData] = useState<SaveData | null>(null);

  const loadGame = useCallback((slot: number) => {
    const saves = loadSaves();
    if (saves[slot]) {
      setSaveSlot(slot);
      setGameData(saves[slot]);
      setScreen('overworld');
    }
  }, []);

  const startNewGame = useCallback((slot: number, name: string, starterIndex: number) => {
    const newSave = createNewSave(name, starterIndex);
    setSaveSlot(slot);
    setGameData(newSave);
    saveSaveData(slot, newSave);
    setScreen('overworld');
  }, []);

  const updateGameData = useCallback(
    (updater: (prev: SaveData) => SaveData) => {
      setGameData((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        saveSaveData(saveSlot, next);
        return next;
      });
    },
    [saveSlot]
  );

  const addXp = useCallback(
    (amount: number) => {
      updateGameData((prev) => {
        let newXp = prev.xp + amount;
        let newLevel = prev.level;
        let needed = xpForLevel(newLevel);
        while (newXp >= needed && newLevel < 100) {
          newXp -= needed;
          newLevel++;
          needed = xpForLevel(newLevel);
        }
        return {
          ...prev,
          xp: newXp,
          level: newLevel,
          totalXp: prev.totalXp + amount,
          lastPlayedAt: Date.now(),
        };
      });
    },
    [updateGameData]
  );

  const spendXp = useCallback(
    (amount: number): boolean => {
      let success = false;
      updateGameData((prev) => {
        if (prev.xp >= amount) {
          success = true;
          return { ...prev, xp: prev.xp - amount, lastPlayedAt: Date.now() };
        }
        return prev;
      });
      return success;
    },
    [updateGameData]
  );

  const addToParty = useCallback(
    (mon: StudyMon, level: number) => {
      updateGameData((prev) => ({
        ...prev,
        party: [...prev.party, { mon, capturedAtLevel: level }],
        lastPlayedAt: Date.now(),
      }));
    },
    [updateGameData]
  );

  const setActiveMon = useCallback(
    (mon: StudyMon) => {
      updateGameData((prev) => ({
        ...prev,
        activeMon: mon,
        lastPlayedAt: Date.now(),
      }));
    },
    [updateGameData]
  );

  const removeFromParty = useCallback(
    (index: number) => {
      updateGameData((prev) => ({
        ...prev,
        party: prev.party.filter((_, i) => i !== index),
        lastPlayedAt: Date.now(),
      }));
    },
    [updateGameData]
  );

  const recordAnswer = useCallback(
    (questionId: string, category: string, correct: boolean) => {
      updateGameData((prev) => {
        const record: QuestionRecord = {
          questionId,
          category,
          correct,
          timestamp: Date.now(),
        };
        const newStreak = correct ? prev.streak + 1 : 0;
        return {
          ...prev,
          questionsAnswered: [...prev.questionsAnswered, record],
          streak: newStreak,
          bestStreak: Math.max(prev.bestStreak, newStreak),
          lastPlayedAt: Date.now(),
        };
      });
    },
    [updateGameData]
  );

  const recordBattleResult = useCallback(
    (won: boolean) => {
      updateGameData((prev) => ({
        ...prev,
        battlesWon: prev.battlesWon + (won ? 1 : 0),
        battlesLost: prev.battlesLost + (won ? 0 : 1),
        lastPlayedAt: Date.now(),
      }));
    },
    [updateGameData]
  );

  const recordEncounter = useCallback(
    (monId: number) => {
      updateGameData((prev) => {
        const existing = prev.encounteredMonIds || [];
        if (existing.includes(monId)) return prev;
        return { ...prev, encounteredMonIds: [...existing, monId], lastPlayedAt: Date.now() };
      });
    },
    [updateGameData]
  );

  const recordCapture = useCallback(
    (monId: number) => {
      updateGameData((prev) => {
        const existingEnc = prev.encounteredMonIds || [];
        const existingCap = prev.capturedMonIds || [];
        return {
          ...prev,
          encounteredMonIds: existingEnc.includes(monId) ? existingEnc : [...existingEnc, monId],
          capturedMonIds: existingCap.includes(monId) ? existingCap : [...existingCap, monId],
          lastPlayedAt: Date.now(),
        };
      });
    },
    [updateGameData]
  );

  const renameActiveMon = useCallback(
    (nickname: string) => {
      updateGameData((prev) => ({
        ...prev,
        activeMon: { ...prev.activeMon, nickname: nickname.trim() || undefined },
        lastPlayedAt: Date.now(),
      }));
    },
    [updateGameData]
  );

  const renamePartyMon = useCallback(
    (partyIndex: number, nickname: string) => {
      updateGameData((prev) => ({
        ...prev,
        party: prev.party.map((m, i) =>
          i === partyIndex
            ? { ...m, mon: { ...m.mon, nickname: nickname.trim() || undefined } }
            : m
        ),
        lastPlayedAt: Date.now(),
      }));
    },
    [updateGameData]
  );

  return {
    screen,
    setScreen,
    saveSlot,
    gameData,
    loadGame,
    startNewGame,
    updateGameData,
    addXp,
    spendXp,
    addToParty,
    setActiveMon,
    removeFromParty,
    recordAnswer,
    recordBattleResult,
    renameActiveMon,
    renamePartyMon,
    recordEncounter,
    recordCapture,
  };
}
