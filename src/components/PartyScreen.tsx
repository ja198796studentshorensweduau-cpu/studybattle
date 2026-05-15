import { useState } from 'react';
import { SaveData } from '../hooks/useGameState';
import { StudyMon, calculateHp, calculateAtk, calculateDef, getDisplayName } from '../data/pokemon';

interface PartyScreenProps {
  gameData: SaveData;
  onSwap: (mon: StudyMon, partyIndex: number) => void;
  onRelease: (partyIndex: number) => void;
  onRenameActive: (nickname: string) => void;
  onRenameParty: (partyIndex: number, nickname: string) => void;
  onBack: () => void;
}

export default function PartyScreen({ gameData, onSwap, onRelease, onRenameActive, onRenameParty, onBack }: PartyScreenProps) {
  const party = gameData.party;
  const [renamingActive, setRenamingActive] = useState(false);
  const [renamingParty, setRenamingParty] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmRelease, setConfirmRelease] = useState<number | null>(null);

  const startRenameActive = () => {
    setRenameValue(gameData.activeMon.nickname || '');
    setRenamingActive(true);
    setRenamingParty(null);
  };

  const startRenameParty = (i: number) => {
    setRenameValue(party[i].mon.nickname || '');
    setRenamingParty(i);
    setRenamingActive(false);
  };

  const saveRename = () => {
    if (renamingActive) {
      onRenameActive(renameValue);
      setRenamingActive(false);
    } else if (renamingParty !== null) {
      onRenameParty(renamingParty, renameValue);
      setRenamingParty(null);
    }
    setRenameValue('');
  };

  const cancelRename = () => {
    setRenamingActive(false);
    setRenamingParty(null);
    setRenameValue('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900">
      {/* Top bar */}
      <div className="bg-gray-900/80 border-b-2 border-purple-700 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button onClick={onBack} className="text-gray-400 hover:text-white font-mono text-sm transition-colors">← Back</button>
          <h1 className="text-purple-300 font-mono font-bold">PARTY</h1>
          <div></div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Active Mon */}
        <div className="bg-gray-800/80 border-2 border-blue-600 rounded-2xl p-5">
          <div className="text-xs text-blue-400 font-mono mb-2">ACTIVE</div>
          <div className="flex items-center gap-4">
            <span className="text-5xl">{gameData.activeMon.emoji}</span>
            <div className="flex-1">
              <h2 className="text-white font-mono font-bold text-lg">{getDisplayName(gameData.activeMon)}</h2>
              {gameData.activeMon.nickname && (
                <div className="text-gray-500 font-mono text-xs">({gameData.activeMon.name})</div>
              )}
              <div className="text-sm font-mono" style={{ color: gameData.activeMon.typeColor }}>{gameData.activeMon.type}</div>
              <div className="text-gray-400 font-mono text-xs mt-1">
                HP: {calculateHp(gameData.activeMon, gameData.level)}
                <span className="mx-2">|</span>
                ATK: {calculateAtk(gameData.activeMon, gameData.level)}
                <span className="mx-2">|</span>
                DEF: {calculateDef(gameData.activeMon, gameData.level)}
              </div>
            </div>
            <button onClick={startRenameActive} className="bg-indigo-700 hover:bg-indigo-600 text-white font-mono text-xs px-3 py-1.5 rounded transition-colors">
              ✏️ RENAME
            </button>
          </div>

          {/* Rename inline editor for active */}
          {renamingActive && (
            <div className="mt-3 flex gap-2 items-center" style={{ animation: 'fadeIn 0.2s ease-out' }}>
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value.slice(0, 16))}
                onKeyDown={(e) => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') cancelRename(); }}
                placeholder={gameData.activeMon.name}
                className="flex-1 bg-gray-700 border border-indigo-500 rounded px-3 py-1.5 text-white font-mono text-sm focus:outline-none"
                autoFocus
              />
              <button onClick={saveRename} className="bg-green-700 hover:bg-green-600 text-white font-mono text-xs px-3 py-1.5 rounded">SAVE</button>
              <button onClick={cancelRename} className="bg-gray-600 hover:bg-gray-500 text-gray-300 font-mono text-xs px-3 py-1.5 rounded">✕</button>
              {renameValue && (
                <button onClick={() => { setRenameValue(''); }} className="text-gray-500 font-mono text-xs hover:text-red-400">CLEAR</button>
              )}
            </div>
          )}
        </div>

        {/* Party */}
        {party.length === 0 ? (
          <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-6 text-center">
            <p className="text-gray-500 font-mono text-sm">No reserve monsters yet.</p>
            <p className="text-gray-600 font-mono text-xs mt-1">Rescue wild monsters in battle to add them here!</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-xs text-purple-400 font-mono">RESERVE ({party.length})</div>
            {party.map((member, i) => (
              <div key={i} className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
                <div className="flex items-center gap-4">
                  <span className="text-4xl">{member.mon.emoji}</span>
                  <div className="flex-1">
                    <div className="text-white font-mono font-bold text-sm">{getDisplayName(member.mon)}</div>
                    {member.mon.nickname && (
                      <div className="text-gray-500 font-mono text-xs">({member.mon.name})</div>
                    )}
                    <div className="text-xs font-mono" style={{ color: member.mon.typeColor }}>{member.mon.type}</div>
                    <div className="text-gray-500 font-mono text-xs">Caught at Lv.{member.capturedAtLevel}</div>
                    <div className="text-gray-400 font-mono text-xs mt-1">
                      HP: {calculateHp(member.mon, gameData.level)}
                      <span className="mx-1">|</span>
                      ATK: {calculateAtk(member.mon, gameData.level)}
                      <span className="mx-1">|</span>
                      DEF: {calculateDef(member.mon, gameData.level)}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button onClick={() => onSwap(member.mon, i)} className="bg-indigo-700 hover:bg-indigo-600 text-white font-mono text-xs px-3 py-1.5 rounded transition-colors">
                      SWAP IN
                    </button>
                    <button onClick={() => startRenameParty(i)} className="bg-gray-600 hover:bg-gray-500 text-gray-300 font-mono text-xs px-3 py-1.5 rounded transition-colors">
                      ✏️ RENAME
                    </button>
                    {confirmRelease === i ? (
                      <button onClick={() => { onRelease(i); setConfirmRelease(null); }} className="bg-red-700 hover:bg-red-600 text-white font-mono text-xs px-3 py-1.5 rounded transition-colors">
                        CONFIRM
                      </button>
                    ) : (
                      <button onClick={() => setConfirmRelease(i)} className="bg-gray-700 hover:bg-red-700 text-gray-400 hover:text-white font-mono text-xs px-3 py-1.5 rounded transition-colors">
                        RELEASE
                      </button>
                    )}
                  </div>
                </div>

                {/* Rename inline editor for party member */}
                {renamingParty === i && (
                  <div className="mt-3 flex gap-2 items-center" style={{ animation: 'fadeIn 0.2s ease-out' }}>
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value.slice(0, 16))}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') cancelRename(); }}
                      placeholder={member.mon.name}
                      className="flex-1 bg-gray-700 border border-indigo-500 rounded px-3 py-1.5 text-white font-mono text-sm focus:outline-none"
                      autoFocus
                    />
                    <button onClick={saveRename} className="bg-green-700 hover:bg-green-600 text-white font-mono text-xs px-3 py-1.5 rounded">SAVE</button>
                    <button onClick={cancelRename} className="bg-gray-600 hover:bg-gray-500 text-gray-300 font-mono text-xs px-3 py-1.5 rounded">✕</button>
                    {renameValue && (
                      <button onClick={() => setRenameValue('')} className="text-gray-500 font-mono text-xs hover:text-red-400">CLEAR</button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
