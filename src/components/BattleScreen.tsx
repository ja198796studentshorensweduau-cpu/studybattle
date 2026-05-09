import { useState, useEffect, useCallback, useRef } from 'react';
import { SaveData, PartyMember, CAPTURE_COST } from '../hooks/useGameState';
import {
  StudyMon,
  WildEncounter,
  calculateHp,
  calculateAtk,
  calculateDef,
  calculateDamage,
  xpGainFromBattle,
  getRandomWildEncounter,
} from '../data/pokemon';
import { Question, getRandomQuestion } from '../data/questions';
import GridClickQuestion from './GridClickQuestion';

interface BattleScreenProps {
  gameData: SaveData;
  onBattleEnd: (won: boolean, xpGained: number, captured?: StudyMon) => void;
  onRecordAnswer: (questionId: string, category: string, correct: boolean) => void;
  onSwapIn: (partyIndex: number) => StudyMon | null;
}

type AttackMode = 'full' | 'light';

type BattlePhase =
  | 'intro'
  | 'player_turn'
  | 'question'
  | 'answer_result'
  | 'player_attack'
  | 'enemy_attack'
  | 'victory'
  | 'defeat'
  | 'swap_select'
  | 'run';

export default function BattleScreen({ gameData, onBattleEnd, onRecordAnswer, onSwapIn }: BattleScreenProps) {
  const [encounter] = useState<WildEncounter>(() => getRandomWildEncounter(gameData.level));
  const [phase, setPhase] = useState<BattlePhase>('intro');
  const [activeMon, setActiveMon] = useState<StudyMon>(gameData.activeMon);
  const [playerHp, setPlayerHp] = useState(() => calculateHp(gameData.activeMon, gameData.level));
  const [playerMaxHp, setPlayerMaxHp] = useState(() => calculateHp(gameData.activeMon, gameData.level));
  const [enemyHp, setEnemyHp] = useState(() => calculateHp(encounter.mon, encounter.level));
  const [enemyMaxHp] = useState(() => calculateHp(encounter.mon, encounter.level));
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [, setIsCorrect] = useState<boolean | null>(null);
  const [message, setMessage] = useState('');
  const [shakePlayer, setShakePlayer] = useState(false);
  const [shakeEnemy, setShakeEnemy] = useState(false);
  const [flashPlayer, setFlashPlayer] = useState(false);
  const [flashEnemy, setFlashEnemy] = useState(false);
  const [usedQuestionIds, setUsedQuestionIds] = useState<string[]>([]);
  const [availableParty, setAvailableParty] = useState<PartyMember[]>([...gameData.party]);
  const [attackMode, setAttackMode] = useState<AttackMode>('full');
  const inputRef = useRef<HTMLInputElement>(null);

  const playerHpRef = useRef(playerHp);
  const enemyHpRef = useRef(enemyHp);
  playerHpRef.current = playerHp;
  enemyHpRef.current = enemyHp;
  const attackModeRef = useRef(attackMode);
  attackModeRef.current = attackMode;

  const playerAtk = calculateAtk(activeMon, gameData.level);
  const playerDef = calculateDef(activeMon, gameData.level);
  const enemyAtk = calculateAtk(encounter.mon, encounter.level);
  const enemyDef = calculateDef(encounter.mon, encounter.level);

  const canCapture = enemyHp <= enemyMaxHp * 0.05 && enemyHp > 0;
  const canAffordCapture = gameData.xp >= CAPTURE_COST;
  const enemyHpPct = enemyHp / enemyMaxHp;

  useEffect(() => {
    if (phase === 'intro') {
      setMessage(`A wild ${encounter.mon.name} (Lv.${encounter.level}) appeared!`);
      const t = setTimeout(() => setPhase('player_turn'), 2000);
      return () => clearTimeout(t);
    }
  }, [phase, encounter]);

  useEffect(() => {
    if (phase === 'player_turn') {
      setMessage('What will you do?');
    }
  }, [phase]);

  const doEnemyAttack = useCallback(() => {
    const dmg = calculateDamage(enemyAtk, playerDef, encounter.level);
    setMessage(`${encounter.mon.name} attacks for ${dmg} damage!`);
    setShakePlayer(true);
    setFlashPlayer(true);
    setTimeout(() => { setShakePlayer(false); setFlashPlayer(false); }, 500);

    const newHp = Math.max(0, playerHpRef.current - dmg);
    setPlayerHp(newHp);
    playerHpRef.current = newHp;
    setPhase('enemy_attack');

    setTimeout(() => {
      if (newHp <= 0) {
        if (availableParty.length > 0) {
          setMessage(`${activeMon.name} fainted! Choose a replacement!`);
          setPhase('swap_select');
        } else {
          setMessage(`${activeMon.name} fainted... You have no more monsters!`);
          setPhase('defeat');
          setTimeout(() => onBattleEnd(false, 0), 2500);
        }
      } else {
        setPhase('player_turn');
      }
    }, 1500);
  }, [enemyAtk, playerDef, encounter, activeMon.name, onBattleEnd, availableParty.length]);

  const doPlayerAttack = useCallback(() => {
    const mode = attackModeRef.current;
    const baseDmg = calculateDamage(playerAtk, enemyDef, gameData.level);

    let dmg: number;
    let label: string;
    if (mode === 'light') {
      // Light attack: 25-75% of base damage — high variance for skill expression
      const mult = 0.25 + Math.random() * 0.5;
      dmg = Math.max(1, Math.floor(baseDmg * mult));
      label = `${activeMon.name} uses Light Attack for ${dmg} damage!`;
    } else {
      dmg = baseDmg;
      label = `${activeMon.name} attacks for ${dmg} damage!`;
    }

    setMessage(label);
    setShakeEnemy(true);
    setFlashEnemy(true);
    setTimeout(() => { setShakeEnemy(false); setFlashEnemy(false); }, 500);

    const newHp = Math.max(0, enemyHpRef.current - dmg);
    setEnemyHp(newHp);
    enemyHpRef.current = newHp;
    setPhase('player_attack');

    setTimeout(() => {
      if (newHp <= 0) {
        setMessage(`${encounter.mon.name} fainted! You win!`);
        setPhase('victory');
        const xp = xpGainFromBattle(encounter.level);
        setTimeout(() => onBattleEnd(true, xp), 2500);
      } else {
        doEnemyAttack();
      }
    }, 1500);
  }, [playerAtk, enemyDef, gameData.level, activeMon.name, encounter, onBattleEnd, doEnemyAttack]);

  const handleSwapIn = (index: number) => {
    const member = availableParty[index];
    if (!member) return;
    const newMon = member.mon;
    const newMaxHp = calculateHp(newMon, gameData.level);
    setActiveMon(newMon);
    setPlayerHp(newMaxHp);
    setPlayerMaxHp(newMaxHp);
    playerHpRef.current = newMaxHp;
    setAvailableParty(prev => prev.filter((_, i) => i !== index));
    onSwapIn(index);
    setMessage(`Go, ${newMon.name}!`);
    setTimeout(() => setPhase('player_turn'), 1500);
  };

  const pickQuestion = useCallback((mode: AttackMode) => {
    setAttackMode(mode);
    attackModeRef.current = mode;
    const q = getRandomQuestion(usedQuestionIds);
    setCurrentQuestion(q);
    setUsedQuestionIds((prev) => [...prev, q.id]);
    setSelectedAnswer('');
    setIsCorrect(null);
    setPhase('question');
  }, [usedQuestionIds]);

  const handleCapture = () => {
    if (!canCapture || !canAffordCapture) return;
    setMessage(`You rescued ${encounter.mon.name}!`);
    setPhase('victory');
    const xp = xpGainFromBattle(encounter.level) - CAPTURE_COST;
    setTimeout(() => onBattleEnd(true, xp, encounter.mon), 2500);
  };

  const handleRun = () => {
    if (Math.random() > 0.3) {
      setMessage('Got away safely!');
      setPhase('run');
      setTimeout(() => onBattleEnd(false, 0), 1500);
    } else {
      setMessage("Can't escape!");
      setTimeout(() => { doEnemyAttack(); }, 1200);
    }
  };

  const checkAnswer = (answer: string) => {
    if (!currentQuestion) return;
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    const correct = norm(answer) === norm(currentQuestion.answer);
    setIsCorrect(correct);
    setSelectedAnswer(answer);
    onRecordAnswer(currentQuestion.id, currentQuestion.category, correct);
    if (correct) {
      doPlayerAttack();
    } else {
      setPhase('answer_result');
    }
  };

  const handleGridClick = (correct: boolean) => {
    if (!currentQuestion) return;
    setIsCorrect(correct);
    onRecordAnswer(currentQuestion.id, currentQuestion.category, correct);
    if (correct) {
      doPlayerAttack();
    } else {
      doEnemyAttack();
    }
  };

  const handleContinue = () => {
    doEnemyAttack();
  };

  const hpColor = (cur: number, max: number) => {
    const p = cur / max;
    if (p > 0.5) return 'bg-green-500';
    if (p > 0.2) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const renderSprite = (mon: StudyMon, isPlayer: boolean, shake: boolean, flash: boolean) => (
    <div
      className={`text-6xl sm:text-7xl transition-all duration-200 ${isPlayer ? 'transform -scale-x-100' : ''}`}
      style={{
        filter: flash ? 'brightness(3) saturate(0)' : 'none',
        animation: shake ? 'shake 0.3s ease-in-out 2' : 'none',
      }}
    >
      {mon.emoji}
    </div>
  );

  // Estimate damage range for UI hints
  const fullDmgEst = calculateDamage(playerAtk, enemyDef, gameData.level);
  const lightMinEst = Math.max(1, Math.floor(fullDmgEst * 0.25));
  const lightMaxEst = Math.max(1, Math.floor(fullDmgEst * 0.75));
  const hpAfterFull = Math.max(0, enemyHp - fullDmgEst);
  const hpAfterLightMin = Math.max(0, enemyHp - lightMaxEst);
  const hpAfterLightMax = Math.max(0, enemyHp - lightMinEst);

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-400 via-sky-300 to-green-400 flex flex-col">
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
      `}</style>

      {/* Battle Scene */}
      <div className="flex-1 flex flex-col relative overflow-hidden" style={{ minHeight: '340px' }}>
        {/* Enemy */}
        <div className="flex justify-between items-start px-4 pt-4 sm:px-8 sm:pt-6">
          <div className="bg-gray-800/90 border-2 border-gray-600 rounded-xl px-4 py-2 shadow-lg min-w-[180px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-white font-mono font-bold text-sm">{encounter.mon.name}</span>
              <span className="text-xs font-mono text-gray-400">Lv.{encounter.level}</span>
            </div>
            <div className="mt-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 font-mono">HP</span>
                <div className="flex-1 bg-gray-700 rounded-full h-3 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${hpColor(enemyHp, enemyMaxHp)}`} style={{ width: `${(enemyHp / enemyMaxHp) * 100}%` }} />
                </div>
              </div>
              <div className="text-right text-xs font-mono text-gray-400 mt-0.5">{enemyHp}/{enemyMaxHp}</div>
            </div>
            {canCapture && (
              <div className="text-yellow-400 text-xs font-mono mt-1 animate-pulse">⚡ Can rescue!</div>
            )}
          </div>
          <div className="mt-6 mr-4">{renderSprite(encounter.mon, false, shakeEnemy, flashEnemy)}</div>
        </div>

        <div className="flex-1" />

        {/* Player */}
        <div className="flex justify-between items-end px-4 pb-2 sm:px-8">
          <div className="mb-4 ml-4">{renderSprite(activeMon, true, shakePlayer, flashPlayer)}</div>
          <div className="bg-gray-800/90 border-2 border-indigo-600 rounded-xl px-4 py-2 shadow-lg min-w-[180px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-white font-mono font-bold text-sm">{activeMon.name}</span>
              <span className="text-xs font-mono text-indigo-400">Lv.{gameData.level}</span>
            </div>
            <div className="mt-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 font-mono">HP</span>
                <div className="flex-1 bg-gray-700 rounded-full h-3 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${hpColor(playerHp, playerMaxHp)}`} style={{ width: `${(playerHp / playerMaxHp) * 100}%` }} />
                </div>
              </div>
              <div className="text-right text-xs font-mono text-gray-400 mt-0.5">{playerHp}/{playerMaxHp}</div>
            </div>
            <div className="mt-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-mono">XP</span>
                <div className="flex-1 bg-gray-700 rounded-full h-1.5 overflow-hidden">
                  <div className="h-full rounded-full bg-blue-400 transition-all duration-500" style={{ width: `${Math.min(100, (gameData.xp / (gameData.level * gameData.level * 10 + gameData.level * 25)) * 100)}%` }} />
                </div>
              </div>
            </div>
            {availableParty.length > 0 && (
              <div className="text-xs font-mono text-indigo-300 mt-1">Party: {availableParty.length} left</div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom panel */}
      <div className="bg-gray-900 border-t-4 border-gray-700">
        {phase === 'swap_select' ? (
          <div className="p-4">
            <div className="bg-gray-800 border-2 border-yellow-600 rounded-xl p-3 mb-3">
              <p className="text-yellow-300 font-mono text-sm">{message}</p>
            </div>
            <div className="space-y-2">
              {availableParty.map((member, i) => (
                <button key={i} onClick={() => handleSwapIn(i)} className="w-full bg-gray-800 hover:bg-indigo-800 border-2 border-gray-600 hover:border-indigo-400 rounded-lg p-3 text-left transition-all flex items-center gap-3">
                  <span className="text-3xl">{member.mon.emoji}</span>
                  <div>
                    <div className="text-white font-mono font-bold">{member.mon.name}</div>
                    <div className="text-xs font-mono" style={{ color: member.mon.typeColor }}>{member.mon.type}</div>
                  </div>
                  <div className="ml-auto text-indigo-400 font-mono text-sm">HP: {calculateHp(member.mon, gameData.level)}</div>
                </button>
              ))}
            </div>
          </div>
        ) : phase === 'question' && currentQuestion ? (
          <div className="p-4 max-h-[50vh] overflow-y-auto">
            {/* Show attack mode badge */}
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-mono px-2 py-0.5 rounded ${attackMode === 'light' ? 'bg-cyan-800 text-cyan-200' : 'bg-red-800 text-red-200'}`}>
                {attackMode === 'light' ? '🎯 Light Attack' : '⚔️ Full Attack'}
              </span>
            </div>
            {currentQuestion.type === 'grid_click' ? (
              <GridClickQuestion question={currentQuestion} onAnswer={handleGridClick} />
            ) : (
              <>
                <div className="bg-gray-800 border-2 border-indigo-600 rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-700 text-indigo-200">
                      {currentQuestion.category.replace(/_/g, ' ').toUpperCase()}
                    </span>
                    <span className="text-xs font-mono text-gray-500">{'⭐'.repeat(currentQuestion.difficulty)}</span>
                  </div>
                  <p className="text-white font-mono text-sm leading-relaxed">{currentQuestion.question}</p>
                </div>

                {currentQuestion.type === 'multiple_choice' && currentQuestion.options ? (
                  <div className="grid grid-cols-1 gap-2">
                    {currentQuestion.options.map((opt, i) => (
                      <button key={i} onClick={() => checkAnswer(opt)} className="bg-gray-800 hover:bg-indigo-800 border-2 border-gray-600 hover:border-indigo-400 rounded-lg px-4 py-3 text-left text-white font-mono text-sm transition-all active:scale-95">
                        <span className="text-indigo-400 mr-2">{['A', 'B', 'C', 'D', 'E', 'F'][i]}.</span>{opt}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input ref={inputRef} type="text" value={selectedAnswer} onChange={(e) => setSelectedAnswer(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && selectedAnswer.trim()) checkAnswer(selectedAnswer.trim()); }} placeholder="Type your answer..." className="flex-1 bg-gray-800 border-2 border-gray-600 focus:border-indigo-400 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none" autoFocus />
                    <button onClick={() => { if (selectedAnswer.trim()) checkAnswer(selectedAnswer.trim()); }} disabled={!selectedAnswer.trim()} className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 text-white font-mono px-6 py-3 rounded-lg transition-colors font-bold disabled:text-gray-500">GO</button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : phase === 'answer_result' ? (
          <div className="p-4">
            <div className="border-2 rounded-xl p-4 bg-red-900/50 border-red-500">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">❌</span>
                <span className="font-mono font-bold text-red-400">WRONG!</span>
              </div>
              {currentQuestion && <p className="text-yellow-300 font-mono text-sm mb-1">Answer: {currentQuestion.answer}</p>}
              {currentQuestion && currentQuestion.explanation && <p className="text-gray-300 font-mono text-xs leading-relaxed">{currentQuestion.explanation}</p>}
            </div>
            <button onClick={handleContinue} className="w-full mt-3 bg-indigo-700 hover:bg-indigo-600 text-white font-mono py-3 rounded-xl transition-all text-lg font-bold active:scale-95 border-2 border-indigo-500 hover:border-indigo-400">
              Continue ▶
            </button>
          </div>
        ) : phase === 'player_turn' ? (
          <div className="p-4">
            <div className="bg-gray-800 border-2 border-gray-600 rounded-xl p-3 mb-3">
              <p className="text-white font-mono text-sm">{message}</p>
            </div>

            {/* Attack buttons */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button onClick={() => pickQuestion('full')} className="bg-red-700 hover:bg-red-600 border-2 border-red-500 text-white font-mono py-3 rounded-xl transition-all font-bold active:scale-95 hover:shadow-lg hover:shadow-red-500/30">
                <div className="text-lg">⚔️ FIGHT</div>
                <div className="text-xs text-red-300 font-normal">~{fullDmgEst} dmg</div>
              </button>
              <button onClick={() => pickQuestion('light')} className="bg-cyan-800 hover:bg-cyan-700 border-2 border-cyan-500 text-white font-mono py-3 rounded-xl transition-all font-bold active:scale-95 hover:shadow-lg hover:shadow-cyan-500/30">
                <div className="text-lg">🎯 LIGHT</div>
                <div className="text-xs text-cyan-300 font-normal">~{lightMinEst}-{lightMaxEst} dmg</div>
              </button>
            </div>

            {/* Damage preview for rescue planning */}
            {enemyHpPct <= 0.30 && enemyHp > 0 && (
              <div className="bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 mb-2">
                <div className="text-gray-400 font-mono text-xs">
                  📊 After attack → 
                  <span className="text-red-400"> Full: {hpAfterFull <= 0 ? '💀 KO' : `${hpAfterFull} HP`}</span>
                  <span className="text-gray-600"> | </span>
                  <span className="text-cyan-400">Light: ~{hpAfterLightMin}-{hpAfterLightMax} HP</span>
                </div>
                {enemyHp <= enemyMaxHp * 0.05 ? (
                  <div className="text-yellow-400 font-mono text-xs mt-1">⚡ Rescue zone! ({CAPTURE_COST} XP)</div>
                ) : (
                  <div className="text-gray-500 font-mono text-xs mt-1">🎣 Rescue at ≤{Math.ceil(enemyMaxHp * 0.05)} HP ({Math.round(enemyHpPct * 100)}% → need ≤5%)</div>
                )}
              </div>
            )}

            {/* Rescue + Run row */}
            <div className="grid grid-cols-2 gap-2">
              {canCapture ? (
                <button
                  onClick={handleCapture}
                  disabled={!canAffordCapture}
                  className={`border-2 text-white font-mono py-2.5 rounded-xl transition-all text-sm font-bold active:scale-95 ${
                    canAffordCapture
                      ? 'bg-yellow-700 hover:bg-yellow-600 border-yellow-500 hover:shadow-lg hover:shadow-yellow-500/30 animate-pulse'
                      : 'bg-gray-700 border-gray-600 text-gray-500'
                  }`}
                >
                  🎣 RESCUE ({CAPTURE_COST} XP)
                </button>
              ) : (
                <div />
              )}
              <button onClick={handleRun} className="bg-gray-700 hover:bg-gray-600 border-2 border-gray-500 text-white font-mono py-2.5 rounded-xl transition-all text-sm active:scale-95">🏃 RUN</button>
            </div>
          </div>
        ) : (
          <div className="p-4">
            <div className={`border-2 rounded-xl p-4 ${phase === 'victory' ? 'bg-yellow-900/40 border-yellow-500' : phase === 'defeat' ? 'bg-red-900/40 border-red-500' : 'bg-gray-800 border-gray-600'}`}>
              <p className="text-white font-mono text-sm">{message}</p>
              {phase === 'victory' && <p className="text-yellow-300 font-mono text-sm mt-2">🎉 +{xpGainFromBattle(encounter.level)} XP gained!</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
