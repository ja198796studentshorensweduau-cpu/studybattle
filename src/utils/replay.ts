/**
 * Battle replay system.
 * Records events during a battle, stores the latest replay in memory,
 * and allows exporting as a JSON file.
 */

/** Snapshot of both sides' state at this moment */
export interface BattleSnapshot {
  playerMon: string;
  playerEmoji: string;
  playerHp: number;
  playerMaxHp: number;
  playerType: string;
  enemyMon: string;
  enemyEmoji: string;
  enemyHp: number;
  enemyMaxHp: number;
  enemyType: string;
  enemyLevel: number;
}

export interface ReplayEvent {
  turn: number;
  timestamp: number;
  type: 'encounter' | 'attack' | 'damage' | 'faint' | 'swap' | 'question' | 'answer' | 'capture' | 'victory' | 'defeat' | 'run' | 'enemy_party' | 'type_bonus' | 'info';
  actor: 'player' | 'enemy' | 'system';
  message: string;
  data?: Record<string, unknown>;
  snapshot?: BattleSnapshot;
}

export interface Replay {
  version: 1;
  playerName: string;
  playerMon: string;
  playerLevel: number;
  startTime: number;
  endTime: number;
  result: 'win' | 'loss' | 'run';
  totalXp: number;
  events: ReplayEvent[];
}

let _currentReplay: Replay | null = null;
let _lastCompletedReplay: Replay | null = null;
let _turnCounter = 0;

/** Start recording a new replay — wipes the in-progress one */
export function startReplay(playerName: string, playerMon: string, playerLevel: number) {
  _turnCounter = 0;
  _currentReplay = {
    version: 1,
    playerName,
    playerMon,
    playerLevel,
    startTime: Date.now(),
    endTime: 0,
    result: 'run',
    totalXp: 0,
    events: [],
  };
}

/** Add an event to the current replay */
export function recordEvent(
  type: ReplayEvent['type'],
  actor: ReplayEvent['actor'],
  message: string,
  data?: Record<string, unknown>,
  snapshot?: BattleSnapshot,
) {
  if (!_currentReplay) return;
  _currentReplay.events.push({
    turn: _turnCounter,
    timestamp: Date.now(),
    type,
    actor,
    message,
    data,
    snapshot,
  });
}

/** Increment the turn counter */
export function nextTurn() {
  _turnCounter++;
}

/** Finish the replay and store it as the last completed one */
export function finishReplay(result: 'win' | 'loss' | 'run', totalXp: number) {
  if (!_currentReplay) return;
  _currentReplay.endTime = Date.now();
  _currentReplay.result = result;
  _currentReplay.totalXp = totalXp;
  _lastCompletedReplay = _currentReplay;
  _currentReplay = null;
}

/** Get the last completed replay (or null) */
export function getLastReplay(): Replay | null {
  return _lastCompletedReplay;
}

/** Check if there's a replay available to export */
export function hasReplay(): boolean {
  return _lastCompletedReplay !== null;
}

/** Export the last replay as a downloadable JSON file */
export function exportReplay() {
  if (!_lastCompletedReplay) return;
  const r = _lastCompletedReplay;
  const duration = Math.round((r.endTime - r.startTime) / 1000);
  const filename = `replay_${r.playerName}_${r.result}_${duration}s_${new Date(r.startTime).toISOString().slice(0, 10)}.json`;

  const json = JSON.stringify(r, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Import a replay from JSON data. Returns error message or null on success. */
export function importReplay(data: unknown): string | null {
  if (!data || typeof data !== 'object') return 'Invalid replay file.';
  const r = data as Record<string, unknown>;
  if (r.version !== 1) return 'Unsupported replay version.';
  if (!r.playerName || !r.events || !Array.isArray(r.events)) return 'Missing replay data.';
  _lastCompletedReplay = data as Replay;
  return null;
}
