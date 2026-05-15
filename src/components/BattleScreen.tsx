import { useState, useEffect, useCallback, useRef } from 'react';
import { SaveData, CAPTURE_COST } from '../hooks/useGameState';
import {
  StudyMon,
  WildEncounter,
  calculateHp,
  calculateAtk,
  calculateDef,
  calculateDamage,
  xpGainFromBattle,
  getRandomWildEncounter,
  getDisplayName,
  getTypeMultiplier,
  getEffectivenessLabel,
} from '../data/pokemon';
import { Question, getRandomQuestion } from '../data/questions';
import GridClickQuestion from './GridClickQuestion';
import ExtendedResponseQuestion from './ExtendedResponseQuestion';
import { startReplay, recordEvent as _recordEvent, nextTurn, finishReplay, ReplayEvent, BattleSnapshot } from '../utils/replay';

interface BattleScreenProps {
  gameData: SaveData;
  onBattleEnd: (won: boolean, xpGained: number, captured?: StudyMon) => void;
  onRecordAnswer: (questionId: string, category: string, correct: boolean) => void;
  onRecordEncounter: (monId: number) => void;
}

/** Party member with battle HP tracking */
interface BattlePartyMember {
  mon: StudyMon;
  hp: number;
  maxHp: number;
}

type AttackMode = 'full' | 'light';

type BattlePhase =
  | 'choose_encounter'
  | 'intro'
  | 'player_turn'
  | 'question'
  | 'answer_result'
  | 'player_attack'
  | 'enemy_attack'
  | 'enemy_fainted'
  | 'next_party_member'
  | 'victory'
  | 'defeat'
  | 'swap_select'
  | 'swap_voluntary'
  | 'run';

/** Generate the enemy's party (0-2 backup mons behind the lead) */
function generateEnemyParty(playerLevel: number): WildEncounter[] {
  const party: WildEncounter[] = [];
  // ~35% chance of 1 backup
  if (Math.random() < 0.35) {
    party.push(getRandomWildEncounter(playerLevel));
  }
  // ~10% chance of a 2nd backup (only if first exists)
  if (party.length > 0 && Math.random() < 0.10) {
    party.push(getRandomWildEncounter(playerLevel));
  }
  return party;
}

export default function BattleScreen({ gameData, onBattleEnd, onRecordAnswer, onRecordEncounter }: BattleScreenProps) {
  // ── Encounter selection (3 choices) ──
  const [choices] = useState<WildEncounter[]>(() => {
    const c = [
      getRandomWildEncounter(gameData.level),
      getRandomWildEncounter(gameData.level),
      getRandomWildEncounter(gameData.level),
    ];
    c.forEach(e => onRecordEncounter(e.mon.id));
    return c;
  });

  // ── Active enemy state ──
  const [currentEnemy, setCurrentEnemy] = useState<WildEncounter | null>(null);
  const [enemyParty, setEnemyParty] = useState<WildEncounter[]>([]);
  const enemyPartyRef = useRef<WildEncounter[]>([]);
  const [enemyHp, setEnemyHp] = useState(0);
  const [enemyMaxHp, setEnemyMaxHp] = useState(0);
  const [defeatedCount, setDefeatedCount] = useState(0);
  const [pendingXp, _setPendingXp] = useState(0);
  const pendingXpRef = useRef(0);
  const setPendingXp = useCallback((updater: number | ((prev: number) => number)) => {
    _setPendingXp(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      pendingXpRef.current = next;
      return next;
    });
  }, []);

  // ── Player state ──
  const [phase, setPhase] = useState<BattlePhase>('choose_encounter');
  const [activeMon, setActiveMon] = useState<StudyMon>(gameData.activeMon);
  const [playerHp, setPlayerHp] = useState(() => calculateHp(gameData.activeMon, gameData.level));
  const [playerMaxHp, setPlayerMaxHp] = useState(() => calculateHp(gameData.activeMon, gameData.level));
  const [battleParty, setBattleParty] = useState<BattlePartyMember[]>(() =>
    gameData.party.map(m => {
      const hp = calculateHp(m.mon, gameData.level);
      return { mon: m.mon, hp, maxHp: hp };
    })
  );

  // ── Question state ──
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [, setIsCorrect] = useState<boolean | null>(null);
  const [message, setMessage] = useState('');
  const [usedQuestionIds, setUsedQuestionIds] = useState<string[]>([]);
  const [attackMode, setAttackMode] = useState<AttackMode>('full');
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Animation ──
  const [playerAnim, setPlayerAnim] = useState('');
  const [enemyAnim, setEnemyAnim] = useState('');
  const [playerFainted, setPlayerFainted] = useState(false);
  const [enemyFaintedAnim, setEnemyFaintedAnim] = useState(false);
  const [damagePopup, setDamagePopup] = useState<{ amount: number; target: 'player' | 'enemy'; key: number } | null>(null);
  const [impactTarget, setImpactTarget] = useState<'player' | 'enemy' | null>(null);
  const [swappingOut, setSwappingOut] = useState(false);
  const [swappingIn, setSwappingIn] = useState(false);
  const popupKey = useRef(0);

  const playerHpRef = useRef(playerHp);
  playerHpRef.current = playerHp;
  const enemyHpRef = useRef(enemyHp);
  enemyHpRef.current = enemyHp;
  const attackModeRef = useRef(attackMode);
  attackModeRef.current = attackMode;

  // ── Derived ──
  const playerAtk = calculateAtk(activeMon, gameData.level);
  const playerDef = calculateDef(activeMon, gameData.level);
  const playerName = getDisplayName(activeMon);
  const enemyAtk = currentEnemy ? calculateAtk(currentEnemy.mon, currentEnemy.level) : 0;
  const enemyDef = currentEnemy ? calculateDef(currentEnemy.mon, currentEnemy.level) : 0;
  const enemyName = currentEnemy?.mon.name || '';

  const canCapture = currentEnemy && enemyHp <= enemyMaxHp * 0.05 && enemyHp > 0;
  const canAffordCapture = gameData.xp >= CAPTURE_COST;
  const enemyHpPct = enemyMaxHp > 0 ? enemyHp / enemyMaxHp : 0;

  // Snapshot helper — captures current battle state into replay events
  const getSnapshot = useCallback((): BattleSnapshot | undefined => {
    if (!currentEnemy) return undefined;
    return {
      playerMon: getDisplayName(activeMon),
      playerEmoji: activeMon.emoji,
      playerHp: playerHpRef.current,
      playerMaxHp,
      playerType: activeMon.type,
      enemyMon: currentEnemy.mon.name,
      enemyEmoji: currentEnemy.mon.emoji,
      enemyHp: enemyHpRef.current,
      enemyMaxHp,
      enemyType: currentEnemy.mon.type,
      enemyLevel: currentEnemy.level,
    };
  }, [activeMon, currentEnemy, playerMaxHp, enemyMaxHp]);

  const recordEvent = useCallback((
    type: ReplayEvent['type'], actor: ReplayEvent['actor'], message: string, data?: Record<string, unknown>
  ) => {
    _recordEvent(type, actor, message, data, getSnapshot());
  }, [getSnapshot]);

  // ── Helpers ──
  const showDamagePopup = (amount: number, target: 'player' | 'enemy') => {
    popupKey.current++;
    setDamagePopup({ amount, target, key: popupKey.current });
    setTimeout(() => setDamagePopup(null), 1200);
  };
  const showImpact = (target: 'player' | 'enemy') => {
    setImpactTarget(target);
    setTimeout(() => setImpactTarget(null), 600);
  };

  // ── Choose encounter ──
  const pickEncounter = (choice: WildEncounter) => {
    const party = generateEnemyParty(gameData.level);
    party.forEach(e => onRecordEncounter(e.mon.id));
    setCurrentEnemy(choice);
    setEnemyParty(party);
    enemyPartyRef.current = party;
    const hp = calculateHp(choice.mon, choice.level);
    setEnemyHp(hp);
    setEnemyMaxHp(hp);
    enemyHpRef.current = hp;
    setPhase('intro');

    // Start replay
    startReplay(gameData.playerName, getDisplayName(activeMon), gameData.level);
    recordEvent('encounter', 'system', `Chose to battle ${choice.mon.name} (Lv.${choice.level})`, { monId: choice.mon.id, level: choice.level });
    if (party.length > 0) {
      recordEvent('enemy_party', 'system', `Enemy has ${party.length} backup(s): ${party.map(p => p.mon.name).join(', ')}`);
    }
  };

  // ── Intro ──
  useEffect(() => {
    if (phase === 'intro' && currentEnemy) {
      const partyCount = enemyParty.length;
      const partyMsg = partyCount > 0 ? ` (${partyCount + 1} in party!)` : '';
      setMessage(`A wild ${currentEnemy.mon.name} (Lv.${currentEnemy.level}) appeared!${partyMsg}`);
      const t = setTimeout(() => setPhase('player_turn'), 2000);
      return () => clearTimeout(t);
    }
  }, [phase, currentEnemy, enemyParty.length]);

  useEffect(() => {
    if (phase === 'player_turn') setMessage('What will you do?');
  }, [phase]);

  // ── Bring in next enemy party member (called directly, NOT via useEffect) ──
  const bringNextPartyMember = useCallback(() => {
    const party = enemyPartyRef.current;
    const xp = pendingXpRef.current;
    if (party.length > 0) {
      const [next, ...rest] = party;
      enemyPartyRef.current = rest;
      setEnemyParty(rest);
      setCurrentEnemy(next);
      const hp = calculateHp(next.mon, next.level);
      setEnemyHp(hp); setEnemyMaxHp(hp); enemyHpRef.current = hp;
      setEnemyFaintedAnim(false);
      recordEvent('enemy_party', 'system', `${next.mon.name} (Lv.${next.level}) steps up!`);
      setMessage(`${next.mon.name} (Lv.${next.level}) steps up to fight!`);
      setPhase('next_party_member');
      setTimeout(() => setPhase('player_turn'), 2000);
    } else {
      // Entire party defeated — victory!
      setPhase('victory');
      setMessage('You defeated the entire party!');
      recordEvent('victory', 'system', `Victory! ${xp} XP earned`, { xp });
      finishReplay('win', xp);
      setTimeout(() => onBattleEnd(true, xp), 2500);
    }
  }, [onBattleEnd]);

  // ── Enemy attack ──
  const doEnemyAttack = useCallback(() => {
    if (!currentEnemy) return;
    const typeMult = getTypeMultiplier(currentEnemy.mon.type, activeMon.type);
    const rawDmg = calculateDamage(enemyAtk, playerDef, currentEnemy.level);
    const dmg = Math.max(1, Math.floor(rawDmg * typeMult));
    let msg = `${currentEnemy.mon.name} attacks for ${dmg} damage!`;
    const eff = getEffectivenessLabel(typeMult);
    if (eff) msg += ` ${eff.text}`;
    setMessage(msg);
    recordEvent('attack', 'enemy', msg, { dmg, typeMult });

    setEnemyAnim('animate-[enemyAttackLunge_0.6s_ease-in-out]');
    setTimeout(() => {
      setEnemyAnim('');
      setPlayerAnim('animate-[hitRecoil_0.5s_ease-out]');
      showImpact('player');
      showDamagePopup(dmg, 'player');
      setTimeout(() => setPlayerAnim(''), 500);
    }, 300);

    const newHp = Math.max(0, playerHpRef.current - dmg);
    setPlayerHp(newHp); playerHpRef.current = newHp;
    setPhase('enemy_attack');

    setTimeout(() => {
      if (newHp <= 0) {
        setPlayerFainted(true);
        setTimeout(() => {
          if (battleParty.some(m => m.hp > 0)) {
            setMessage(`${getDisplayName(activeMon)} fainted! Choose a replacement!`);
            setPhase('swap_select');
          } else {
            setMessage(`${getDisplayName(activeMon)} fainted... You have no more monsters!`);
            setPhase('defeat');
            recordEvent('defeat', 'system', 'All player monsters fainted — defeat!');
            finishReplay('loss', 0);
            setTimeout(() => onBattleEnd(false, 0), 2500);
          }
        }, 800);
      } else {
        setPhase('player_turn');
      }
    }, 1500);
  }, [currentEnemy, enemyAtk, playerDef, onBattleEnd, battleParty, activeMon]);

  // ── Player attack ──
  const doPlayerAttackCore = useCallback((dmg: number, label: string) => {
    if (!currentEnemy) return;
    setMessage(label);

    setPlayerAnim('animate-[playerAttackLunge_0.6s_ease-in-out]');
    setTimeout(() => {
      setPlayerAnim('');
      setEnemyAnim('animate-[hitRecoil_0.5s_ease-out]');
      showImpact('enemy');
      showDamagePopup(dmg, 'enemy');
      setTimeout(() => setEnemyAnim(''), 500);
    }, 300);

    const newHp = Math.max(0, enemyHpRef.current - dmg);
    setEnemyHp(newHp); enemyHpRef.current = newHp;
    setPhase('player_attack');

    setTimeout(() => {
      if (newHp <= 0) {
        setEnemyFaintedAnim(true);
        const xp = xpGainFromBattle(currentEnemy.level);
        setPendingXp(prev => prev + xp);
        setDefeatedCount(prev => prev + 1);

        setTimeout(() => {
          setMessage(`${currentEnemy.mon.name} fainted! +${xp} XP pending`);
          setPhase('enemy_fainted');
          setTimeout(() => bringNextPartyMember(), 1500);
        }, 800);
      } else {
        doEnemyAttack();
      }
    }, 1500);
  }, [currentEnemy, doEnemyAttack]);

  const doPlayerAttack = useCallback(() => {
    if (!currentEnemy) return;
    const mode = attackModeRef.current;
    const typeMult = getTypeMultiplier(activeMon.type, currentEnemy.mon.type);
    const baseDmg = calculateDamage(playerAtk, enemyDef, gameData.level);
    let dmg: number, label: string;
    if (mode === 'light') {
      const mult = 0.25 + Math.random() * 0.5;
      dmg = Math.max(1, Math.floor(baseDmg * mult * typeMult));
      label = `${playerName} uses Light Attack for ${dmg}!`;
    } else {
      dmg = Math.max(1, Math.floor(baseDmg * typeMult));
      label = `${playerName} attacks for ${dmg}!`;
    }
    const eff = getEffectivenessLabel(typeMult);
    if (eff) label += ` ${eff.text}`;
    nextTurn();
    recordEvent('attack', 'player', label, { dmg, typeMult, mode });
    if (eff) recordEvent('type_bonus', 'system', `${activeMon.type} vs ${currentEnemy.mon.type}: ${typeMult}x`, { typeMult });
    doPlayerAttackCore(dmg, label);
  }, [playerAtk, enemyDef, gameData.level, playerName, doPlayerAttackCore, activeMon, currentEnemy]);

  const doPlayerAttackScaled = useCallback((multiplier: number) => {
    if (!currentEnemy) return;
    const typeMult = getTypeMultiplier(activeMon.type, currentEnemy.mon.type);
    const baseDmg = calculateDamage(playerAtk, enemyDef, gameData.level);
    const totalMult = multiplier * typeMult;
    const dmg = Math.max(1, Math.floor(baseDmg * totalMult));
    let label = `${playerName} attacks for ${dmg}! (${multiplier.toFixed(1)}x)`;
    const eff = getEffectivenessLabel(typeMult);
    if (eff) label += ` ${eff.text}`;
    nextTurn();
    recordEvent('attack', 'player', label, { dmg, multiplier, typeMult });
    doPlayerAttackCore(dmg, label);
  }, [playerAtk, enemyDef, gameData.level, playerName, doPlayerAttackCore, activeMon, currentEnemy]);

  // ── Questions ──
  const startQuestion = useCallback(() => {
    const q = getRandomQuestion(usedQuestionIds, undefined, gameData.questionsAnswered);
    setCurrentQuestion(q); setSelectedAnswer(''); setIsCorrect(null);
    setUsedQuestionIds(prev => [...prev, q.id]);
    setPhase('question');
  }, [usedQuestionIds, gameData.questionsAnswered]);

  const checkAnswer = useCallback((answer: string) => {
    if (!currentQuestion) return;
    const correct = answer.toLowerCase().trim() === currentQuestion.answer.toLowerCase().trim();
    setIsCorrect(correct);
    onRecordAnswer(currentQuestion.id, currentQuestion.category, correct);
    recordEvent('answer', correct ? 'player' : 'enemy', correct ? `Correct: "${answer}"` : `Wrong: "${answer}" (answer: ${currentQuestion.answer})`, { questionId: currentQuestion.id, correct });
    if (correct) {
      setMessage(`✅ Correct! ${playerName} attacks!`);
      setPhase('answer_result');
      setTimeout(() => doPlayerAttack(), 1500);
    } else {
      setMessage('❌ Wrong! The enemy attacks!');
      setPhase('answer_result');
      setTimeout(() => doEnemyAttack(), 1500);
    }
  }, [currentQuestion, playerName, doPlayerAttack, doEnemyAttack, onRecordAnswer]);

  const handleGridAnswer = useCallback((correct: boolean) => {
    if (!currentQuestion) return;
    onRecordAnswer(currentQuestion.id, currentQuestion.category, correct);
    if (correct) { setMessage(`✅ Correct! ${playerName} attacks!`); setPhase('answer_result'); setTimeout(() => doPlayerAttack(), 1500); }
    else { setMessage('❌ Wrong! The enemy attacks!'); setPhase('answer_result'); setTimeout(() => doEnemyAttack(), 1500); }
  }, [currentQuestion, playerName, doPlayerAttack, doEnemyAttack, onRecordAnswer]);

  const handleExtendedAnswer = useCallback((correct: boolean, multiplier: number) => {
    if (!currentQuestion) return;
    onRecordAnswer(currentQuestion.id, currentQuestion.category, correct);
    if (correct) { setMessage(`📝 Good! ${playerName} attacks at ${multiplier.toFixed(1)}x!`); setPhase('answer_result'); setTimeout(() => doPlayerAttackScaled(multiplier), 1500); }
    else { setMessage('📝 Weak answer... Enemy attacks!'); setPhase('answer_result'); setTimeout(() => doEnemyAttack(), 1500); }
  }, [currentQuestion, playerName, doPlayerAttackScaled, doEnemyAttack, onRecordAnswer]);

  // ── Capture — ends the battle immediately ──
  const handleCapture = () => {
    if (!currentEnemy || !canCapture || !canAffordCapture) return;
    const xp = pendingXpRef.current + xpGainFromBattle(currentEnemy.level) - CAPTURE_COST;
    setMessage(`🎣 You rescued ${currentEnemy.mon.name}!`);
    setEnemyFaintedAnim(true);
    recordEvent('capture', 'player', `Rescued ${currentEnemy.mon.name}! Battle over — +${xp} XP`, { monId: currentEnemy.mon.id });
    recordEvent('victory', 'system', `Victory by capture! ${xp} XP earned`);
    finishReplay('win', xp);
    setPhase('victory');
    setTimeout(() => onBattleEnd(true, xp, currentEnemy.mon), 2000);
  };

  const handleRun = () => {
    setMessage('Got away safely!');
    setPhase('run');
    recordEvent('run', 'player', 'Ran away from battle');
    finishReplay('run', 0);
    setTimeout(() => onBattleEnd(false, 0), 1500);
  };

  // ── Swap ──
  const handleSwap = (partyIndex: number, isVoluntary: boolean) => {
    const member = battleParty[partyIndex];
    if (!member || member.hp <= 0) return;

    if (!playerFainted) {
      setSwappingOut(true);
      setTimeout(() => { setSwappingOut(false); doSwapIn(member, partyIndex, isVoluntary); }, 400);
    } else {
      setPlayerFainted(false);
      doSwapIn(member, partyIndex, isVoluntary);
    }
  };

  const doSwapIn = (member: BattlePartyMember, partyIndex: number, isVoluntary: boolean) => {
    // Put current active mon back into party (with current HP), unless it fainted
    const currentHp = playerHpRef.current;
    const currentMon = activeMon;
    const currentMaxHp = playerMaxHp;

    // Swap: remove selected from party, add current back (if alive)
    setBattleParty(prev => {
      const newParty = prev.filter((_, i) => i !== partyIndex);
      if (currentHp > 0) {
        newParty.push({ mon: currentMon, hp: currentHp, maxHp: currentMaxHp });
      }
      return newParty;
    });

    // Set the new active mon
    setActiveMon(member.mon);
    setPlayerHp(member.hp);
    setPlayerMaxHp(member.maxHp);
    playerHpRef.current = member.hp;

    setSwappingIn(true);
    setMessage(`Go, ${getDisplayName(member.mon)}!`);
    setTimeout(() => {
      setSwappingIn(false);
      if (isVoluntary) setTimeout(() => doEnemyAttack(), 500);
      else setPhase('player_turn');
    }, 600);
  };

  // ── Derived styles ──
  const playerHpPct = playerHp / playerMaxHp;
  const playerHpColor = playerHpPct > 0.5 ? 'bg-green-500' : playerHpPct > 0.2 ? 'bg-yellow-500' : 'bg-red-500';
  const enemyHpColor = enemyHpPct > 0.5 ? 'bg-green-500' : enemyHpPct > 0.2 ? 'bg-yellow-500' : 'bg-red-500';

  let playerSpriteClass = 'transition-all duration-200';
  if (playerFainted) playerSpriteClass += ' animate-[faintSpin_0.8s_ease-in_forwards]';
  else if (swappingOut) playerSpriteClass += ' animate-[swapOut_0.4s_ease-in_forwards]';
  else if (swappingIn) playerSpriteClass += ' animate-[swapIn_0.5s_ease-out_forwards]';
  else if (playerAnim) playerSpriteClass += ` ${playerAnim}`;

  let enemySpriteClass = 'transition-all duration-200';
  if (enemyFaintedAnim) enemySpriteClass += ' animate-[faintFade_0.8s_ease-in_forwards]';
  else if (enemyAnim) enemySpriteClass += ` ${enemyAnim}`;

  // Damage preview
  const baseDmgPreview = currentEnemy ? calculateDamage(playerAtk, enemyDef, gameData.level) : 0;
  const hpAfterFull = Math.max(0, enemyHp - baseDmgPreview);

  // ════════════════════════════════════════════════════
  // RENDER: Encounter selection screen
  // ════════════════════════════════════════════════════
  if (phase === 'choose_encounter') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center justify-center p-4 no-select">
        <h2 className="text-white font-mono font-bold text-xl mb-2" style={{ animation: 'fadeIn 0.5s ease-out' }}>⚔️ Choose Your Battle!</h2>
        <p className="text-gray-400 font-mono text-xs mb-6">Tap an enemy to fight them</p>

        <div className="grid grid-cols-3 gap-3 max-w-lg w-full mb-8">
          {choices.map((choice, i) => {
            const hp = calculateHp(choice.mon, choice.level);
            return (
              <button
                key={i}
                onClick={() => pickEncounter(choice)}
                className="bg-gray-800/80 border-2 border-gray-600 hover:border-red-500 rounded-2xl p-4 transition-all hover:scale-[1.03] active:scale-[0.97]"
                style={{ animation: `fadeIn 0.4s ease-out ${i * 0.15}s both` }}
              >
                <div className="text-center text-5xl mb-3">{choice.mon.emoji}</div>
                <div className="text-white font-mono text-sm font-bold text-center truncate">{choice.mon.name}</div>
                <div className="text-center mt-1">
                  <span className="text-xs font-mono" style={{ color: choice.mon.typeColor }}>{choice.mon.type}</span>
                  <span className="text-gray-500 font-mono text-xs ml-1">Lv.{choice.level}</span>
                </div>
                <div className="mt-2 text-center text-gray-500 font-mono text-xs">HP: {hp}</div>
              </button>
            );
          })}
        </div>

        <button onClick={handleRun} className="bg-gray-700 hover:bg-gray-600 text-gray-300 font-mono py-2 px-8 rounded-lg text-sm border border-gray-600 transition-colors">
          🏃 Run Away
        </button>
      </div>
    );
  }

  // ════════════════════════════════════════════════════
  // RENDER: Main battle screen (1v1)
  // ════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 flex flex-col no-select">
      {/* Battle field */}
      <div className="flex-1 relative p-4 max-w-lg mx-auto w-full">
        {/* Enemy section */}
        {currentEnemy && (
          <div className="mb-8" style={{ animation: 'slideInRight 0.5s ease-out' }}>
            <div className="bg-gray-800/80 border-2 border-red-800 rounded-xl p-3 mb-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-white font-mono font-bold text-sm">{enemyName}</span>
                  <span className="text-gray-400 font-mono text-xs">Lv.{currentEnemy.level}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono" style={{ color: currentEnemy.mon.typeColor }}>{currentEnemy.mon.type}</span>
                  {/* Party indicator */}
                  {enemyParty.length > 0 && (
                    <span className="text-xs font-mono text-red-400 bg-red-900/30 px-1.5 py-0.5 rounded">
                      +{enemyParty.length} backup
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 font-mono text-xs">HP</span>
                <div className="flex-1 bg-gray-700 rounded-full h-3 overflow-hidden">
                  <div className={`h-full rounded-full ${enemyHpColor} transition-all duration-500`} style={{ width: `${enemyHpPct * 100}%` }} />
                </div>
                <span className="text-gray-400 font-mono text-xs w-16 text-right">{enemyHp}/{enemyMaxHp}</span>
              </div>
              {/* Enemy party dots */}
              {(enemyParty.length > 0 || defeatedCount > 0) && (
                <div className="flex items-center gap-1 mt-1.5 justify-center">
                  {/* Current (alive) */}
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" title="Current" />
                  {/* Backups */}
                  {enemyParty.map((_, i) => (
                    <div key={i} className="w-2.5 h-2.5 rounded-full bg-red-500/40 border border-red-500/60" title="Backup" />
                  ))}
                  {/* Defeated */}
                  {Array.from({ length: defeatedCount }).map((_, i) => (
                    <div key={`d${i}`} className="w-2.5 h-2.5 rounded-full bg-gray-600" title="Defeated" />
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <div className={`text-center text-7xl py-4 ${enemySpriteClass}`}>{currentEnemy.mon.emoji}</div>
              {impactTarget === 'enemy' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-5xl animate-[impactBurst_0.6s_ease-out_forwards]">💥</div>
                </div>
              )}
              {damagePopup?.target === 'enemy' && (
                <div key={damagePopup.key} className="absolute top-0 right-4 animate-[damageFloat_1.2s_ease-out_forwards] pointer-events-none">
                  <span className="text-2xl font-black font-mono text-red-400 drop-shadow-lg">-{damagePopup.amount}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Player section */}
        <div style={{ animation: 'slideInLeft 0.5s ease-out' }}>
          <div className="relative">
            <div className={`text-center text-6xl py-2 mb-3 ${playerSpriteClass}`}>{activeMon.emoji}</div>
            {impactTarget === 'player' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-5xl animate-[impactBurst_0.6s_ease-out_forwards]">💥</div>
              </div>
            )}
            {damagePopup?.target === 'player' && (
              <div key={damagePopup.key} className="absolute top-0 left-4 animate-[damageFloat_1.2s_ease-out_forwards] pointer-events-none">
                <span className="text-2xl font-black font-mono text-red-400 drop-shadow-lg">-{damagePopup.amount}</span>
              </div>
            )}
          </div>
          <div className="bg-gray-800/80 border-2 border-blue-800 rounded-xl p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-white font-mono font-bold text-sm">{playerName}</span>
                <span className="text-gray-400 font-mono text-xs">Lv.{gameData.level}</span>
              </div>
              <span className="text-xs font-mono" style={{ color: activeMon.typeColor }}>{activeMon.type}</span>
            </div>
            {activeMon.nickname && <div className="text-gray-500 font-mono text-xs mb-1">({activeMon.name})</div>}
            <div className="flex items-center gap-2">
              <span className="text-gray-400 font-mono text-xs">HP</span>
              <div className="flex-1 bg-gray-700 rounded-full h-3 overflow-hidden">
                <div className={`h-full rounded-full ${playerHpColor} transition-all duration-500`} style={{ width: `${playerHpPct * 100}%` }} />
              </div>
              <span className="text-gray-400 font-mono text-xs w-16 text-right">{playerHp}/{playerMaxHp}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Action area ── */}
      <div className="bg-gray-900/90 border-t-2 border-indigo-700 p-4 max-w-lg mx-auto w-full" style={{ animation: 'fadeIn 0.5s ease-out' }}>
        {phase === 'swap_select' || phase === 'swap_voluntary' ? (
          <div className="space-y-3">
            <p className="text-white font-mono text-sm text-center">{message}</p>
            {phase === 'swap_voluntary' && <p className="text-yellow-400/70 font-mono text-xs text-center">⚠️ Swapping costs your turn!</p>}
            <div className="space-y-2">
              {battleParty.map((member, i) => {
                const alive = member.hp > 0;
                const hpPct = member.hp / member.maxHp;
                const hpCol = hpPct > 0.5 ? 'text-green-400' : hpPct > 0.2 ? 'text-yellow-400' : 'text-red-400';
                return (
                  <button
                    key={i}
                    onClick={() => alive && handleSwap(i, phase === 'swap_voluntary')}
                    disabled={!alive}
                    className={`w-full flex items-center gap-3 p-3 bg-gray-800 border rounded-lg transition-colors ${alive ? 'border-gray-600 hover:border-indigo-400' : 'border-gray-700 opacity-40 cursor-not-allowed'}`}
                  >
                    <span className="text-2xl">{alive ? member.mon.emoji : '💀'}</span>
                    <div className="text-left flex-1">
                      <div className="text-white font-mono text-sm">{getDisplayName(member.mon)}</div>
                      {member.mon.nickname && <div className="text-gray-500 font-mono text-xs">({member.mon.name})</div>}
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`font-mono text-xs font-bold ${alive ? hpCol : 'text-gray-600'}`}>{member.hp}/{member.maxHp} HP</span>
                        <div className="flex-1 bg-gray-700 rounded-full h-1.5 overflow-hidden max-w-[80px]">
                          <div className={`h-full rounded-full ${hpPct > 0.5 ? 'bg-green-500' : hpPct > 0.2 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${hpPct * 100}%` }} />
                        </div>
                      </div>
                    </div>
                    {!alive && <span className="text-gray-600 font-mono text-xs">FAINTED</span>}
                  </button>
                );
              })}
            </div>
            {phase === 'swap_voluntary' && (
              <button onClick={() => setPhase('player_turn')} className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-mono py-2 rounded-lg text-sm border border-gray-600">← BACK</button>
            )}
          </div>

        ) : phase === 'question' && currentQuestion ? (
          <div className="space-y-3">
            <div className="text-center">
              <span className={`text-xs font-mono px-2 py-0.5 rounded ${attackMode === 'light' ? 'bg-cyan-900/40 text-cyan-400' : 'bg-red-900/40 text-red-400'}`}>
                {attackMode === 'light' ? '🎯 Light Attack' : '⚔️ Full Attack'}
              </span>
            </div>
            {currentQuestion.type === 'grid_click' ? (
              <GridClickQuestion question={currentQuestion} onAnswer={handleGridAnswer} />
            ) : currentQuestion.type === 'extended_response' ? (
              <ExtendedResponseQuestion question={currentQuestion} onAnswer={handleExtendedAnswer} />
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-900/40 text-indigo-400 uppercase tracking-wider">{currentQuestion.category.replace(/_/g, ' ').toUpperCase()}</span>
                  <span className="text-yellow-400 text-xs">{'⭐'.repeat(currentQuestion.difficulty)}</span>
                </div>
                <p className="text-white font-mono text-sm">{currentQuestion.question}</p>
                {currentQuestion.type === 'multiple_choice' && currentQuestion.options ? (
                  <div className="grid grid-cols-1 gap-2">
                    {currentQuestion.options.map((opt, i) => (
                      <button key={i} onClick={() => checkAnswer(opt)} className="w-full text-left bg-gray-800 hover:bg-indigo-900/40 border border-gray-600 hover:border-indigo-400 rounded-lg px-4 py-3 text-white font-mono text-sm transition-colors">{opt}</button>
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input ref={inputRef} type="text" value={selectedAnswer} onChange={(e) => setSelectedAnswer(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && selectedAnswer.trim()) checkAnswer(selectedAnswer.trim()); }} placeholder="Type your answer..." className="flex-1 bg-gray-800 border-2 border-gray-600 focus:border-indigo-400 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none" autoFocus />
                    <button onClick={() => { if (selectedAnswer.trim()) checkAnswer(selectedAnswer.trim()); }} className="bg-indigo-600 hover:bg-indigo-500 px-4 rounded-lg font-mono text-sm transition-colors text-white">GO</button>
                  </div>
                )}
              </>
            )}
          </div>

        ) : phase === 'answer_result' ? (
          <div className="text-center space-y-2" style={{ animation: 'bounceIn 0.5s ease-out' }}>
            <p className={`font-mono text-lg font-bold ${message.includes('✅') || message.includes('Good') ? 'text-green-400' : 'text-red-400'}`}>
              {message.includes('✅') || message.includes('Good') ? '✅' : '❌'}
              <span className="block text-sm mt-1">{message.includes('✅') || message.includes('Good') ? 'CORRECT!' : 'WRONG!'}</span>
            </p>
            {currentQuestion && !message.includes('✅') && !message.includes('Good') && <p className="text-gray-400 font-mono text-xs">Answer: {currentQuestion.answer}</p>}
            {currentQuestion?.explanation && <p className="text-gray-500 font-mono text-xs italic">{currentQuestion.explanation}</p>}
          </div>

        ) : phase === 'player_turn' ? (
          <div className="space-y-3">
            <p className="text-white font-mono text-sm text-center">{message}</p>
            {pendingXp > 0 && <p className="text-yellow-400/60 font-mono text-xs text-center">🏆 {pendingXp} XP pending (awarded on full party defeat)</p>}

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { setAttackMode('full'); startQuestion(); }} className="bg-red-700 hover:bg-red-600 text-white font-mono py-3 rounded-lg transition-colors border border-red-500 text-sm">⚔️ ATTACK</button>
              <button onClick={() => { setAttackMode('light'); startQuestion(); }} className="bg-cyan-700 hover:bg-cyan-600 text-white font-mono py-3 rounded-lg transition-colors border border-cyan-500 text-sm">🎯 LIGHT ATK</button>
            </div>

            {enemyHpPct <= 0.30 && enemyHp > 0 && (
              <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-2 space-y-1">
                <p className="text-gray-400 font-mono text-xs">📊 Full → {hpAfterFull <= 0 ? '💀 KO' : `${hpAfterFull} HP`}</p>
                {canCapture && <p className="text-yellow-400 font-mono text-xs">⚡ Rescue zone! ({CAPTURE_COST} XP)</p>}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              {battleParty.some(m => m.hp > 0) ? (
                <button onClick={() => { setMessage(`Swap ${playerName}:`); setPhase('swap_voluntary'); }} className="bg-purple-700 hover:bg-purple-600 text-white font-mono py-3 rounded-lg transition-colors text-sm border border-purple-500">🔄 SWAP</button>
              ) : (
                <button disabled className="bg-gray-700 text-gray-500 font-mono py-3 rounded-lg text-sm border border-gray-600 cursor-not-allowed">🔄 SWAP</button>
              )}
              {canCapture ? (
                <button onClick={handleCapture} disabled={!canAffordCapture} className={`font-mono py-3 rounded-lg transition-colors text-sm border ${canAffordCapture ? 'bg-yellow-700 hover:bg-yellow-600 text-white border-yellow-500' : 'bg-gray-700 text-gray-500 border-gray-600 cursor-not-allowed'}`}>🎣 RESCUE</button>
              ) : (
                <button disabled className="bg-gray-700 text-gray-500 font-mono py-3 rounded-lg text-sm border border-gray-600 cursor-not-allowed">🎣 RESCUE</button>
              )}
              <button onClick={handleRun} className="bg-gray-700 hover:bg-gray-600 text-gray-300 font-mono py-3 rounded-lg transition-colors text-sm border border-gray-600">🏃 RUN</button>
            </div>
          </div>

        ) : phase === 'enemy_fainted' || phase === 'next_party_member' ? (
          <div className="text-center space-y-2" style={{ animation: 'fadeIn 0.5s ease-out' }}>
            <p className="font-mono text-lg font-bold text-yellow-400">{message}</p>
            {enemyParty.length > 0 && <p className="text-gray-400 font-mono text-xs">Another enemy is stepping up...</p>}
          </div>

        ) : (
          <div className="text-center space-y-2" style={{ animation: 'fadeIn 0.5s ease-out' }}>
            <p className={`font-mono text-lg font-bold ${phase === 'victory' ? 'text-green-400' : phase === 'defeat' ? 'text-red-400' : 'text-white'}`}>{message}</p>
            {phase === 'victory' && <p className="text-yellow-400 font-mono text-sm">🎉 +{pendingXp} XP earned!</p>}
          </div>
        )}
      </div>
    </div>
  );
}
