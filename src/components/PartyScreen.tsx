import { SaveData } from '../hooks/useGameState';
import { calculateHp, calculateAtk, calculateDef, StudyMon } from '../data/pokemon';

interface PartyScreenProps {
  gameData: SaveData;
  onSetActive: (mon: StudyMon, partyIndex: number) => void;
  onRelease: (partyIndex: number) => void;
  onBack: () => void;
}

export default function PartyScreen({ gameData, onSetActive, onRelease, onBack }: PartyScreenProps) {
  const activeMon = gameData.activeMon;
  const party = gameData.party;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-purple-950 to-slate-900">
      {/* Header */}
      <div className="bg-gray-900/80 border-b-2 border-purple-700 px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <button onClick={onBack} className="text-purple-400 hover:text-purple-300 font-mono text-sm transition-colors">← Back</button>
          <h1 className="text-white font-mono font-bold">👥 Party</h1>
          <div className="text-gray-400 font-mono text-xs">Lv.{gameData.level}</div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Active Mon */}
        <div className="bg-gray-800/80 border-2 border-purple-600 rounded-2xl p-5">
          <div className="text-purple-400 font-mono text-xs mb-3">⭐ ACTIVE</div>
          <div className="flex items-center gap-4">
            <div className="text-6xl p-3 bg-gray-700/50 rounded-xl">{activeMon.emoji}</div>
            <div className="flex-1">
              <h2 className="text-white font-mono font-bold text-xl">{activeMon.name}</h2>
              <div className="text-sm font-mono px-2 py-0.5 rounded inline-block mt-1" style={{ backgroundColor: activeMon.typeColor + '30', color: activeMon.typeColor }}>
                {activeMon.type}
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="text-center">
                  <div className="text-green-400 font-mono font-bold">{calculateHp(activeMon, gameData.level)}</div>
                  <div className="text-gray-500 font-mono text-xs">HP</div>
                </div>
                <div className="text-center">
                  <div className="text-red-400 font-mono font-bold">{calculateAtk(activeMon, gameData.level)}</div>
                  <div className="text-gray-500 font-mono text-xs">ATK</div>
                </div>
                <div className="text-center">
                  <div className="text-blue-400 font-mono font-bold">{calculateDef(activeMon, gameData.level)}</div>
                  <div className="text-gray-500 font-mono text-xs">DEF</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Party Members */}
        {party.length > 0 ? (
          <div className="space-y-3">
            <div className="text-gray-400 font-mono text-xs">RESERVE ({party.length})</div>
            {party.map((member, i) => (
              <div key={i} className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
                <div className="flex items-center gap-4">
                  <div className="text-5xl p-2 bg-gray-700/50 rounded-xl">{member.mon.emoji}</div>
                  <div className="flex-1">
                    <h3 className="text-white font-mono font-bold">{member.mon.name}</h3>
                    <div className="text-xs font-mono" style={{ color: member.mon.typeColor }}>{member.mon.type}</div>
                    <div className="text-gray-500 font-mono text-xs mt-1">Caught at Lv.{member.capturedAtLevel}</div>
                    <div className="flex gap-4 mt-2 text-xs font-mono">
                      <span className="text-green-400">HP: {calculateHp(member.mon, gameData.level)}</span>
                      <span className="text-red-400">ATK: {calculateAtk(member.mon, gameData.level)}</span>
                      <span className="text-blue-400">DEF: {calculateDef(member.mon, gameData.level)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => onSetActive(member.mon, i)}
                      className="bg-purple-700 hover:bg-purple-600 text-white font-mono text-xs px-3 py-2 rounded-lg transition-colors"
                    >
                      Set Active
                    </button>
                    <button
                      onClick={() => onRelease(i)}
                      className="bg-red-900/50 hover:bg-red-800 text-red-400 font-mono text-xs px-3 py-2 rounded-lg transition-colors border border-red-700"
                    >
                      Release
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-8 text-center">
            <div className="text-4xl mb-3">🎣</div>
            <p className="text-gray-400 font-mono text-sm">No reserve monsters yet!</p>
            <p className="text-gray-500 font-mono text-xs mt-2">Rescue wild monsters at ≤5% HP during battle for 30 XP.</p>
          </div>
        )}

        {/* Tips */}
        <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4">
          <p className="text-purple-400/60 font-mono text-xs text-center">
            💡 Reserve monsters swap in when your active one faints mid-battle!
          </p>
        </div>
      </div>
    </div>
  );
}
