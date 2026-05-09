import { SaveData } from '../hooks/useGameState';
import { xpForLevel, calculateHp } from '../data/pokemon';
import { getQuestions } from '../data/questions';

interface OverworldScreenProps {
  gameData: SaveData;
  onBattle: () => void;
  onStats: () => void;
  onParty: () => void;
  onTitle: () => void;
}

export default function OverworldScreen({ gameData, onBattle, onStats, onParty, onTitle }: OverworldScreenProps) {
  const xpNeeded = xpForLevel(gameData.level);
  const xpPercent = Math.min(100, (gameData.xp / xpNeeded) * 100);
  const totalCorrect = gameData.questionsAnswered.filter((q) => q.correct).length;
  const totalAnswered = gameData.questionsAnswered.length;
  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  const qCount = getQuestions().length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900">
      {/* Top bar */}
      <div className="bg-gray-900/80 border-b-2 border-indigo-700 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{gameData.activeMon.emoji}</span>
            <div>
              <div className="text-white font-mono font-bold text-sm">{gameData.playerName}</div>
              <div className="text-indigo-400 font-mono text-xs">Lv.{gameData.level} {gameData.activeMon.name}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-yellow-400 font-mono text-xs">🔥 Streak: {gameData.streak}</div>
            <div className="text-gray-400 font-mono text-xs">Best: {gameData.bestStreak}</div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Active Mon Card */}
        <div className="bg-gray-800/80 border-2 border-indigo-600 rounded-2xl p-5 shadow-xl shadow-indigo-500/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="text-6xl p-2 bg-gray-700/50 rounded-xl">{gameData.activeMon.emoji}</div>
              <div>
                <h2 className="text-white font-mono font-bold text-xl">{gameData.activeMon.name}</h2>
                <div className="text-sm font-mono px-2 py-0.5 rounded inline-block mt-1" style={{ backgroundColor: gameData.activeMon.typeColor + '30', color: gameData.activeMon.typeColor }}>
                  {gameData.activeMon.type}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-indigo-400 font-mono text-2xl font-bold">Lv.{gameData.level}</div>
              {gameData.level >= 100 && <div className="text-yellow-400 font-mono text-xs">MAX LEVEL!</div>}
            </div>
          </div>

          {gameData.level < 100 && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-gray-400 font-mono text-xs">XP</span>
                <span className="text-gray-400 font-mono text-xs">{gameData.xp}/{xpNeeded}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-700" style={{ width: `${xpPercent}%` }} />
              </div>
            </div>
          )}

          {/* HP preview */}
          <div className="mt-3 text-gray-400 font-mono text-xs">
            Battle HP: {calculateHp(gameData.activeMon, gameData.level)}
          </div>
        </div>

        {/* Party Preview */}
        {gameData.party.length > 0 && (
          <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 font-mono text-xs">PARTY ({gameData.party.length})</span>
              <button onClick={onParty} className="text-indigo-400 hover:text-indigo-300 font-mono text-xs">Manage →</button>
            </div>
            <div className="flex gap-2 overflow-x-auto">
              {gameData.party.map((member, i) => (
                <div key={i} className="flex-shrink-0 bg-gray-700/50 rounded-lg p-2 text-center min-w-[60px]">
                  <span className="text-2xl">{member.mon.emoji}</span>
                  <div className="text-gray-400 font-mono text-xs truncate">{member.mon.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-3 text-center">
            <div className="text-green-400 font-mono text-2xl font-bold">{gameData.battlesWon}</div>
            <div className="text-gray-400 font-mono text-xs">Wins</div>
          </div>
          <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-3 text-center">
            <div className="text-blue-400 font-mono text-2xl font-bold">{accuracy}%</div>
            <div className="text-gray-400 font-mono text-xs">Accuracy</div>
          </div>
          <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-3 text-center">
            <div className="text-yellow-400 font-mono text-2xl font-bold">{totalAnswered}</div>
            <div className="text-gray-400 font-mono text-xs">Answered</div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <button onClick={onBattle} className="w-full bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white font-mono py-5 rounded-2xl transition-all text-xl font-bold tracking-wider border-2 border-red-500 hover:border-red-400 shadow-lg hover:shadow-red-500/30 active:scale-[0.98] flex items-center justify-center gap-3">
            <span className="text-2xl">⚔️</span>FIND BATTLE<span className="text-2xl">⚔️</span>
          </button>
          
          <div className="grid grid-cols-2 gap-3">
            <button onClick={onParty} className="bg-gradient-to-r from-purple-700 to-purple-600 hover:from-purple-600 hover:to-purple-500 text-white font-mono py-4 rounded-2xl transition-all text-lg border-2 border-purple-500 hover:border-purple-400 shadow-lg hover:shadow-purple-500/20 active:scale-[0.98] flex items-center justify-center gap-2">
              <span className="text-xl">👥</span>PARTY
            </button>
            <button onClick={onStats} className="bg-gradient-to-r from-indigo-700 to-indigo-600 hover:from-indigo-600 hover:to-indigo-500 text-white font-mono py-4 rounded-2xl transition-all text-lg border-2 border-indigo-500 hover:border-indigo-400 shadow-lg hover:shadow-indigo-500/20 active:scale-[0.98] flex items-center justify-center gap-2">
              <span className="text-xl">📊</span>STATS
            </button>
          </div>
          
          <button onClick={onTitle} className="w-full bg-gray-800/60 hover:bg-gray-700/60 text-gray-400 hover:text-gray-300 font-mono py-3 rounded-xl transition-all border border-gray-700 active:scale-[0.98] text-sm">
            ← BACK TO TITLE
          </button>
        </div>

        {/* Tip */}
        <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4 mt-4">
          <p className="text-indigo-400/60 font-mono text-xs text-center">
            💡 Rescue enemies at ≤5% HP for 30 XP! {qCount} questions loaded.
          </p>
        </div>
      </div>
    </div>
  );
}
