import { useState, useEffect, useRef } from 'react';
import { Replay, BattleSnapshot, exportReplay, importReplay, hasReplay, getLastReplay } from '../utils/replay';

interface ReplayViewerProps {
  initialReplay: Replay | null;
  onClose: () => void;
}

const eventIcons: Record<string, string> = {
  encounter: '⚔️', attack: '💥', damage: '🩸', faint: '💀', swap: '🔄',
  question: '❓', answer: '📝', capture: '🎣', victory: '🏆', defeat: '😵',
  run: '🏃', enemy_party: '👥', type_bonus: '✨', info: 'ℹ️',
};

const typeColors: Record<string, string> = {
  Fire: '#EF4444', Water: '#3B82F6', Earth: '#A16207', Wind: '#06B6D4',
  Ice: '#93C5FD', Nature: '#16A34A', Dark: '#7C3AED', Light: '#FDE047',
};

export default function ReplayViewer({ initialReplay, onClose }: ReplayViewerProps) {
  const [replay, setReplay] = useState<Replay | null>(initialReplay);
  const [idx, setIdx] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [importError, setImportError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const events = replay?.events ?? [];

  // Find latest snapshot at or before current index
  const currentSnapshot: BattleSnapshot | null = (() => {
    if (!replay || idx < 0) return null;
    for (let i = idx; i >= 0; i--) {
      if (events[i].snapshot) return events[i].snapshot!;
    }
    return null;
  })();

  // Compute displayed HP after applying current event's damage
  const displayState = (() => {
    if (!currentSnapshot) return null;
    let pHp = currentSnapshot.playerHp;
    let eHp = currentSnapshot.enemyHp;
    const ev = events[idx];
    if (ev?.type === 'attack' && ev.data && typeof ev.data.dmg === 'number') {
      if (ev.actor === 'player') eHp = Math.max(0, eHp - ev.data.dmg);
      if (ev.actor === 'enemy') pHp = Math.max(0, pHp - ev.data.dmg);
    }
    return { ...currentSnapshot, playerHp: pHp, enemyHp: eHp };
  })();

  const currentEvent = idx >= 0 && idx < events.length ? events[idx] : null;
  const isAttack = currentEvent?.type === 'attack';
  const playerAttacking = isAttack && currentEvent?.actor === 'player';
  const enemyAttacking = isAttack && currentEvent?.actor === 'enemy';
  const isFaint = currentEvent?.type === 'faint' || currentEvent?.type === 'defeat';
  const isCapture = currentEvent?.type === 'capture';
  const isVictory = currentEvent?.type === 'victory';
  const finished = idx >= events.length - 1 && events.length > 0;

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current && idx >= 0) {
      const el = logRef.current.querySelector(`[data-idx="${idx}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [idx]);

  // Playback timer
  useEffect(() => {
    if (!playing || !replay || idx >= events.length - 1) {
      if (playing && idx >= events.length - 1) setPlaying(false);
      return;
    }
    const curr = events[idx]?.timestamp ?? replay.startTime;
    const next = events[idx + 1]?.timestamp ?? curr;
    const gap = Math.max(300, (next - curr) / speed);
    const delay = Math.min(gap, 2500 / speed);
    timerRef.current = setTimeout(() => setIdx(i => i + 1), delay);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [playing, idx, events, replay, speed]);

  const play = () => {
    if (idx >= events.length - 1) { setIdx(0); setPlaying(true); }
    else { if (idx < 0) setIdx(0); setPlaying(true); }
  };
  const pause = () => setPlaying(false);
  const reset = () => { setPlaying(false); setIdx(-1); };
  const skipEnd = () => { setPlaying(false); setIdx(events.length - 1); };
  const cycleSpeed = () => setSpeed(s => s >= 4 ? 1 : s * 2);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        const err = importReplay(data);
        if (err) { setImportError(err); }
        else { setReplay(getLastReplay()); setIdx(-1); setPlaying(false); }
      } catch { setImportError('Invalid JSON file.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const hpColor = (hp: number, max: number) => {
    const pct = max > 0 ? hp / max : 0;
    return pct > 0.5 ? 'bg-green-500' : pct > 0.2 ? 'bg-yellow-500' : 'bg-red-500';
  };

  const duration = replay ? Math.round((replay.endTime - replay.startTime) / 1000) : 0;
  const resultColor = !replay ? '' : replay.result === 'win' ? 'text-green-400' : replay.result === 'loss' ? 'text-red-400' : 'text-gray-400';
  const resultEmoji = !replay ? '' : replay.result === 'win' ? '🏆' : replay.result === 'loss' ? '💀' : '🏃';

  return (
    <div className="fixed inset-0 z-40 bg-slate-950 flex flex-col">
      <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />

      {/* ═══ TOP BAR ═══ */}
      <div className="bg-gray-900 border-b-2 border-cyan-700 px-4 py-2 flex items-center justify-between flex-shrink-0">
        <button onClick={onClose} className="text-gray-400 hover:text-white font-mono text-sm transition-colors">← Back</button>
        <h1 className="text-cyan-300 font-mono font-bold">📹 BATTLE REPLAY</h1>
        <div className="w-16" />
      </div>

      {/* ═══ BATTLE VISUALIZER — always visible ═══ */}
      <div className="flex-shrink-0 bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 p-4">
        <div className="max-w-lg mx-auto">
          <div className="bg-gray-800/80 border-2 border-cyan-800/60 rounded-2xl p-5">
            {displayState ? (
              <>
                {/* Enemy side */}
                <div className="flex items-center gap-4 mb-4">
                  <div className={`text-5xl transition-all duration-300 ${enemyAttacking ? 'animate-[enemyAttackLunge_0.6s_ease-in-out]' : ''} ${(isFaint || isCapture || isVictory) && displayState.enemyHp <= 0 ? 'opacity-20 scale-50 grayscale' : ''}`}>
                    {displayState.enemyHp <= 0 ? '💀' : displayState.enemyEmoji}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white font-mono text-sm font-bold">{displayState.enemyMon}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ color: typeColors[displayState.enemyType] || '#9CA3AF', backgroundColor: (typeColors[displayState.enemyType] || '#9CA3AF') + '20' }}>{displayState.enemyType}</span>
                        <span className="text-gray-500 font-mono text-xs">Lv.{displayState.enemyLevel}</span>
                      </div>
                    </div>
                    <div className="bg-gray-700 rounded-full h-3 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${hpColor(displayState.enemyHp, displayState.enemyMaxHp)}`} style={{ width: `${Math.max(0, (displayState.enemyHp / displayState.enemyMaxHp) * 100)}%` }} />
                    </div>
                    <div className="text-gray-500 font-mono text-xs mt-0.5 text-right">{displayState.enemyHp}/{displayState.enemyMaxHp}</div>
                  </div>
                </div>

                {/* Center message + damage */}
                <div className="text-center py-2 min-h-[50px] flex flex-col items-center justify-center" key={idx}>
                  {currentEvent && (
                    <>
                      <p className="font-mono text-sm text-white" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                        {currentEvent.message}
                      </p>
                      {isAttack && currentEvent.data && typeof currentEvent.data.dmg === 'number' && (
                        <span className="text-red-400 font-mono text-2xl font-black mt-1" style={{ animation: 'bounceIn 0.4s ease-out' }}>
                          -{currentEvent.data.dmg}
                        </span>
                      )}
                    </>
                  )}
                  {!currentEvent && !finished && (
                    <p className="text-gray-600 font-mono text-sm">Press ▶ PLAY to watch the battle</p>
                  )}
                  {finished && (
                    <div style={{ animation: 'bounceIn 0.5s ease-out' }}>
                      <span className="text-3xl">{resultEmoji}</span>
                      <p className={`font-mono font-bold text-lg ${resultColor}`}>{replay?.result.toUpperCase()}</p>
                      <p className="text-gray-500 font-mono text-xs">+{replay?.totalXp} XP • {duration}s</p>
                    </div>
                  )}
                </div>

                {/* Player side */}
                <div className="flex items-center gap-4 mt-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white font-mono text-sm font-bold">{displayState.playerMon}</span>
                      <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ color: typeColors[displayState.playerType] || '#9CA3AF', backgroundColor: (typeColors[displayState.playerType] || '#9CA3AF') + '20' }}>{displayState.playerType}</span>
                    </div>
                    <div className="bg-gray-700 rounded-full h-3 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${hpColor(displayState.playerHp, displayState.playerMaxHp)}`} style={{ width: `${Math.max(0, (displayState.playerHp / displayState.playerMaxHp) * 100)}%` }} />
                    </div>
                    <div className="text-gray-500 font-mono text-xs mt-0.5">{displayState.playerHp}/{displayState.playerMaxHp}</div>
                  </div>
                  <div className={`text-5xl transition-all duration-300 ${playerAttacking ? 'animate-[playerAttackLunge_0.6s_ease-in-out]' : ''} ${isFaint && displayState.playerHp <= 0 ? 'opacity-20 scale-50 grayscale' : ''}`}>
                    {displayState.playerHp <= 0 ? '💀' : displayState.playerEmoji}
                  </div>
                </div>
              </>
            ) : (
              /* Idle state before play or when no replay */
              <div className="text-center py-8">
                <div className="text-6xl mb-3">{replay ? '📹' : '📭'}</div>
                <p className="text-gray-400 font-mono text-sm mb-1">
                  {replay ? 'Ready to replay' : 'No replay loaded'}
                </p>
                {replay && (
                  <p className="text-gray-600 font-mono text-xs">
                    {replay.playerName} vs wild battle • {replay.events.length} events
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ CONTROLS ═══ */}
      <div className="flex-shrink-0 px-4 py-3 bg-gray-900/80 border-y border-gray-700">
        <div className="max-w-lg mx-auto">
          {replay ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <button onClick={reset} className="bg-gray-700 hover:bg-gray-600 text-gray-300 font-mono text-sm px-3 py-2 rounded-lg transition-colors">⏮</button>
                {playing ? (
                  <button onClick={pause} className="flex-1 bg-yellow-700 hover:bg-yellow-600 text-white font-mono py-2 rounded-lg text-base font-bold border-2 border-yellow-500 transition-colors">⏸ PAUSE</button>
                ) : (
                  <button onClick={play} className="flex-1 bg-cyan-700 hover:bg-cyan-600 text-white font-mono py-2 rounded-lg text-base font-bold border-2 border-cyan-500 transition-colors">
                    {idx >= events.length - 1 ? '🔄 REPLAY' : '▶ PLAY'}
                  </button>
                )}
                <button onClick={skipEnd} className="bg-gray-700 hover:bg-gray-600 text-gray-300 font-mono text-sm px-3 py-2 rounded-lg transition-colors">⏭</button>
                <button onClick={cycleSpeed} className={`font-mono text-sm px-3 py-2 rounded-lg transition-colors border ${speed > 1 ? 'bg-cyan-800 text-cyan-300 border-cyan-600' : 'bg-gray-700 text-gray-300 border-gray-600'}`}>{speed}x</button>
              </div>
              <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
                <div className="h-full rounded-full bg-cyan-500 transition-all duration-200" style={{ width: `${events.length > 0 ? ((idx + 1) / events.length) * 100 : 0}%` }} />
              </div>
              <div className="flex justify-between mt-1 text-gray-500 font-mono text-xs">
                <span>{Math.max(0, idx + 1)}/{events.length} events</span>
                <span className={resultColor}>{resultEmoji} {replay.result} • {duration}s • +{replay.totalXp} XP</span>
              </div>
            </>
          ) : (
            <p className="text-gray-500 font-mono text-sm text-center">Import a replay file to watch</p>
          )}
        </div>
      </div>

      {/* ═══ EVENT LOG + IMPORT/EXPORT ═══ */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="max-w-lg mx-auto w-full flex-1 flex flex-col overflow-hidden px-4 pt-3 pb-2 gap-2">
          {/* Import / Export buttons — always prominent */}
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => fileRef.current?.click()} className="flex-1 bg-cyan-700 hover:bg-cyan-600 text-white font-mono py-3 rounded-xl text-sm font-bold border-2 border-cyan-500 transition-colors flex items-center justify-center gap-2">
              📥 IMPORT REPLAY
            </button>
            {hasReplay() && (
              <button onClick={exportReplay} className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 font-mono py-3 rounded-xl text-sm font-bold border-2 border-gray-500 transition-colors flex items-center justify-center gap-2">
                📤 EXPORT REPLAY
              </button>
            )}
          </div>
          {importError && <p className="text-red-400 font-mono text-xs text-center flex-shrink-0">{importError}</p>}

          {/* Scrollable event log */}
          <div ref={logRef} className="flex-1 bg-gray-800/40 border border-gray-700 rounded-xl overflow-y-auto min-h-0">
            {events.map((ev, i) => {
              if (i > idx) return null;
              const isCurrent = i === idx;
              const borderColor = ev.actor === 'player' ? 'border-l-blue-600' : ev.actor === 'enemy' ? 'border-l-red-600' : 'border-l-gray-600';
              const bgColor = ev.actor === 'player' ? 'bg-blue-900/10' : ev.actor === 'enemy' ? 'bg-red-900/10' : 'bg-gray-800/20';
              return (
                <div key={i} data-idx={i} className={`px-3 py-1.5 border-l-2 ${borderColor} ${bgColor} ${isCurrent ? '' : 'opacity-40'}`} style={isCurrent ? { animation: 'fadeIn 0.2s ease-out' } : undefined}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs flex-shrink-0">{eventIcons[ev.type] || '•'}</span>
                    <span className={`font-mono text-[11px] flex-1 ${isCurrent ? 'text-white' : 'text-gray-400'}`}>{ev.message}</span>
                    <span className="text-gray-600 font-mono text-[9px] flex-shrink-0">T{ev.turn}</span>
                  </div>
                </div>
              );
            })}
            {idx < 0 && events.length > 0 && <div className="p-4 text-center text-gray-600 font-mono text-xs">Press ▶ PLAY to watch events appear</div>}
            {idx < 0 && events.length === 0 && <div className="p-6 text-center text-gray-600 font-mono text-xs">No events to show — import a replay</div>}
            {finished && (
              <div className={`p-3 text-center border-t border-gray-700 ${replay?.result === 'win' ? 'bg-green-900/20' : replay?.result === 'loss' ? 'bg-red-900/20' : 'bg-gray-800/40'}`}>
                <span className={`font-mono font-bold ${resultColor}`}>{resultEmoji} {replay?.result.toUpperCase()}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
