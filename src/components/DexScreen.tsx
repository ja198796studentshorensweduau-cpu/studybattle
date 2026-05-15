import { useState } from 'react';
import { SaveData } from '../hooks/useGameState';
import { studymons, StudyMon } from '../data/pokemon';

interface DexScreenProps {
  gameData: SaveData;
  onBack: () => void;
}

type FilterType = 'all' | 'encountered' | 'captured' | 'unknown';
type SortType = 'id' | 'name' | 'type' | 'hp' | 'atk' | 'def';

const typeOrder = ['Earth', 'Water', 'Fire', 'Wind', 'Ice', 'Nature', 'Dark', 'Light'];

export default function DexScreen({ gameData, onBack }: DexScreenProps) {
  const [selectedMon, setSelectedMon] = useState<StudyMon | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortType>('id');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const encountered = new Set(gameData.encounteredMonIds || []);
  const captured = new Set(gameData.capturedMonIds || []);

  // Also count the active mon and party as captured + encountered
  const allOwned = new Set(captured);
  allOwned.add(gameData.activeMon.id);
  gameData.party.forEach(m => allOwned.add(m.mon.id));

  const allEncountered = new Set(encountered);
  allOwned.forEach(id => allEncountered.add(id));

  const totalSpecies = studymons.length;
  const encounteredCount = allEncountered.size;
  const capturedCount = allOwned.size;

  // Sorted & filtered list
  const allTypes = [...new Set(studymons.map(m => m.type))].sort((a, b) => {
    const ai = typeOrder.indexOf(a);
    const bi = typeOrder.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  let filtered = [...studymons];

  if (typeFilter) {
    filtered = filtered.filter(m => m.type === typeFilter);
  }

  if (filter === 'encountered') {
    filtered = filtered.filter(m => allEncountered.has(m.id));
  } else if (filter === 'captured') {
    filtered = filtered.filter(m => allOwned.has(m.id));
  } else if (filter === 'unknown') {
    filtered = filtered.filter(m => !allEncountered.has(m.id));
  }

  filtered.sort((a, b) => {
    switch (sort) {
      case 'name': return a.name.localeCompare(b.name);
      case 'type': {
        const ta = typeOrder.indexOf(a.type);
        const tb = typeOrder.indexOf(b.type);
        return (ta === -1 ? 99 : ta) - (tb === -1 ? 99 : tb);
      }
      case 'hp': return b.baseHp - a.baseHp;
      case 'atk': return b.baseAtk - a.baseAtk;
      case 'def': return b.baseDef - a.baseDef;
      default: return a.id - b.id;
    }
  });

  const getStatus = (mon: StudyMon): 'captured' | 'encountered' | 'unknown' => {
    if (allOwned.has(mon.id)) return 'captured';
    if (allEncountered.has(mon.id)) return 'encountered';
    return 'unknown';
  };

  // Detail view
  if (selectedMon) {
    const status = getStatus(selectedMon);
    const isKnown = status !== 'unknown';
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900">
        <div className="bg-gray-900/80 border-b-2 border-amber-700 px-4 py-3">
          <div className="flex items-center justify-between max-w-lg mx-auto">
            <button onClick={() => setSelectedMon(null)} className="text-gray-400 hover:text-white font-mono text-sm transition-colors">← Back</button>
            <h1 className="text-amber-300 font-mono font-bold text-sm">#{String(selectedMon.id).padStart(3, '0')}</h1>
            <div></div>
          </div>
        </div>

        <div className="max-w-lg mx-auto p-4 space-y-4">
          {/* Mon card */}
          <div className="bg-gray-800/80 border-2 rounded-2xl p-6 text-center" style={{ borderColor: isKnown ? selectedMon.typeColor : '#374151' }}>
            <div className="text-8xl mb-4" style={{ filter: isKnown ? 'none' : 'brightness(0) invert(0.2)' }}>
              {isKnown ? selectedMon.emoji : '❓'}
            </div>
            <h2 className="text-2xl font-black font-mono text-white mb-1">
              {isKnown ? selectedMon.name : '???'}
            </h2>
            {isKnown && (
              <span className="inline-block text-sm font-mono px-3 py-1 rounded-full mt-1" style={{ backgroundColor: selectedMon.typeColor + '25', color: selectedMon.typeColor }}>
                {selectedMon.type}
              </span>
            )}

            {/* Status badge */}
            <div className="mt-3">
              {status === 'captured' && (
                <span className="text-xs font-mono px-3 py-1 rounded-full bg-green-900/40 text-green-400 border border-green-700">🎣 CAPTURED</span>
              )}
              {status === 'encountered' && (
                <span className="text-xs font-mono px-3 py-1 rounded-full bg-yellow-900/40 text-yellow-400 border border-yellow-700">👁️ ENCOUNTERED</span>
              )}
              {status === 'unknown' && (
                <span className="text-xs font-mono px-3 py-1 rounded-full bg-gray-800 text-gray-500 border border-gray-600">❓ NOT YET MET</span>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
            <h3 className="text-gray-400 font-mono text-xs uppercase tracking-wider mb-2">Description</h3>
            <p className="text-gray-300 font-mono text-sm leading-relaxed">
              {isKnown ? selectedMon.description : 'You haven\'t encountered this creature yet. Keep exploring!'}
            </p>
          </div>

          {/* Base Stats */}
          <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
            <h3 className="text-gray-400 font-mono text-xs uppercase tracking-wider mb-3">Base Stats</h3>
            {isKnown ? (
              <div className="space-y-3">
                {[
                  { label: 'HP', value: selectedMon.baseHp, max: 75, color: '#22C55E' },
                  { label: 'ATK', value: selectedMon.baseAtk, max: 10, color: '#EF4444' },
                  { label: 'DEF', value: selectedMon.baseDef, max: 12, color: '#3B82F6' },
                ].map(stat => (
                  <div key={stat.label}>
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-400 font-mono text-xs font-bold w-10">{stat.label}</span>
                      <span className="font-mono text-sm font-bold" style={{ color: stat.color }}>{stat.value}</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(100, (stat.value / stat.max) * 100)}%`, backgroundColor: stat.color }}
                      />
                    </div>
                  </div>
                ))}
                <div className="border-t border-gray-700 pt-2 mt-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-mono text-xs">TOTAL</span>
                    <span className="text-white font-mono text-sm font-bold">{selectedMon.baseHp + selectedMon.baseAtk + selectedMon.baseDef}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {['HP', 'ATK', 'DEF'].map(label => (
                  <div key={label}>
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-500 font-mono text-xs font-bold w-10">{label}</span>
                      <span className="font-mono text-sm text-gray-600">???</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
                      <div className="h-full rounded-full bg-gray-600 w-0" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Type matchup info */}
          {isKnown && (
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
              <h3 className="text-gray-400 font-mono text-xs uppercase tracking-wider mb-2">Battle Profile</h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-lg mb-1">
                    {selectedMon.baseAtk >= 7 ? '⚔️' : selectedMon.baseAtk >= 5 ? '🗡️' : '🔨'}
                  </div>
                  <div className="text-gray-400 font-mono text-xs">
                    {selectedMon.baseAtk >= 7 ? 'Heavy Hitter' : selectedMon.baseAtk >= 5 ? 'Moderate' : 'Weak Atk'}
                  </div>
                </div>
                <div>
                  <div className="text-lg mb-1">
                    {selectedMon.baseDef >= 8 ? '🛡️' : selectedMon.baseDef >= 5 ? '🔰' : '💔'}
                  </div>
                  <div className="text-gray-400 font-mono text-xs">
                    {selectedMon.baseDef >= 8 ? 'Tank' : selectedMon.baseDef >= 5 ? 'Moderate' : 'Fragile'}
                  </div>
                </div>
                <div>
                  <div className="text-lg mb-1">
                    {selectedMon.baseHp >= 50 ? '💖' : selectedMon.baseHp >= 35 ? '❤️' : '💢'}
                  </div>
                  <div className="text-gray-400 font-mono text-xs">
                    {selectedMon.baseHp >= 50 ? 'High HP' : selectedMon.baseHp >= 35 ? 'Medium HP' : 'Low HP'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900">
      <div className="bg-gray-900/80 border-b-2 border-amber-700 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button onClick={onBack} className="text-gray-400 hover:text-white font-mono text-sm transition-colors">← Back</button>
          <h1 className="text-amber-300 font-mono font-bold">📖 STUDYDEX</h1>
          <div></div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Progress summary */}
        <div className="bg-gray-800/80 border-2 border-amber-700 rounded-2xl p-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-amber-400 font-mono text-2xl font-bold">{encounteredCount}</div>
              <div className="text-gray-400 font-mono text-xs">Seen</div>
            </div>
            <div>
              <div className="text-green-400 font-mono text-2xl font-bold">{capturedCount}</div>
              <div className="text-gray-400 font-mono text-xs">Captured</div>
            </div>
            <div>
              <div className="text-white font-mono text-2xl font-bold">{totalSpecies}</div>
              <div className="text-gray-400 font-mono text-xs">Total</div>
            </div>
          </div>
          <div className="mt-3 bg-gray-700 rounded-full h-2.5 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-green-400 transition-all duration-500" style={{ width: `${(capturedCount / totalSpecies) * 100}%` }} />
          </div>
          <div className="text-center mt-1 text-gray-500 font-mono text-xs">
            {Math.round((capturedCount / totalSpecies) * 100)}% captured
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {([['all', 'All'], ['encountered', '👁️ Seen'], ['captured', '🎣 Caught'], ['unknown', '❓ Unknown']] as [FilterType, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)} className={`flex-shrink-0 font-mono text-xs px-3 py-1.5 rounded-lg border transition-all ${filter === key ? 'bg-amber-700 border-amber-500 text-white' : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-amber-600'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <button onClick={() => setTypeFilter(null)} className={`flex-shrink-0 font-mono text-xs px-2.5 py-1 rounded border transition-all ${typeFilter === null ? 'bg-gray-600 border-gray-400 text-white' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>
            All Types
          </button>
          {allTypes.map(type => {
            const typeMon = studymons.find(m => m.type === type);
            return (
              <button key={type} onClick={() => setTypeFilter(typeFilter === type ? null : type)} className={`flex-shrink-0 font-mono text-xs px-2.5 py-1 rounded border transition-all ${typeFilter === type ? 'border-white/40 text-white' : 'border-gray-700 hover:border-gray-500'}`} style={{ color: typeFilter === type ? typeMon?.typeColor : undefined, backgroundColor: typeFilter === type ? (typeMon?.typeColor || '') + '20' : undefined }}>
                {type}
              </button>
            );
          })}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <span className="text-gray-500 font-mono text-xs">Sort:</span>
          {([['id', '#'], ['name', 'Name'], ['hp', 'HP'], ['atk', 'ATK'], ['def', 'DEF']] as [SortType, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setSort(key)} className={`font-mono text-xs px-2 py-0.5 rounded transition-all ${sort === key ? 'bg-amber-700/40 text-amber-400' : 'text-gray-500 hover:text-gray-300'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Mon grid */}
        <div className="grid grid-cols-2 gap-2">
          {filtered.map(mon => {
            const status = getStatus(mon);
            const isKnown = status !== 'unknown';
            return (
              <button
                key={mon.id}
                onClick={() => setSelectedMon(mon)}
                className={`rounded-xl p-3 text-left transition-all active:scale-[0.97] border ${
                  status === 'captured'
                    ? 'bg-gray-800/80 border-green-800/40 hover:border-green-600'
                    : status === 'encountered'
                    ? 'bg-gray-800/60 border-yellow-800/30 hover:border-yellow-600'
                    : 'bg-gray-800/30 border-gray-700/50 hover:border-gray-500'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl" style={{ filter: isKnown ? 'none' : 'brightness(0) invert(0.15)' }}>
                    {isKnown ? mon.emoji : '❓'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500 font-mono text-xs">#{String(mon.id).padStart(3, '0')}</span>
                      {status === 'captured' && <span className="text-green-500 text-xs">✓</span>}
                      {status === 'encountered' && <span className="text-yellow-500 text-xs">👁️</span>}
                    </div>
                    <div className="text-white font-mono text-sm font-bold truncate">
                      {isKnown ? mon.name : '???'}
                    </div>
                    {isKnown && (
                      <div className="text-xs font-mono" style={{ color: mon.typeColor }}>{mon.type}</div>
                    )}
                  </div>
                </div>
                {isKnown && (
                  <div className="flex gap-2 mt-2 text-center">
                    <div className="flex-1 bg-gray-700/50 rounded px-1 py-0.5">
                      <div className="text-green-400 font-mono text-xs font-bold">{mon.baseHp}</div>
                      <div className="text-gray-500 font-mono text-[9px]">HP</div>
                    </div>
                    <div className="flex-1 bg-gray-700/50 rounded px-1 py-0.5">
                      <div className="text-red-400 font-mono text-xs font-bold">{mon.baseAtk}</div>
                      <div className="text-gray-500 font-mono text-[9px]">ATK</div>
                    </div>
                    <div className="flex-1 bg-gray-700/50 rounded px-1 py-0.5">
                      <div className="text-blue-400 font-mono text-xs font-bold">{mon.baseDef}</div>
                      <div className="text-gray-500 font-mono text-[9px]">DEF</div>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">🔍</div>
            <p className="text-gray-500 font-mono text-sm">No monsters match this filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
