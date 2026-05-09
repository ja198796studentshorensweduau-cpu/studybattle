import { useState, useEffect } from 'react';
import { useGameState } from './hooks/useGameState';
import { isQuestionsLoaded } from './data/questions';
import { StudyMon } from './data/pokemon';
import TitleScreen from './components/TitleScreen';
import OverworldScreen from './components/OverworldScreen';
import BattleScreen from './components/BattleScreen';
import StatsPage from './components/StatsPage';
import PartyScreen from './components/PartyScreen';

function LevelUpOverlay({ level, monName, monEmoji, onClose }: { level: number; monName: string; monEmoji: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-[fadeIn_0.3s_ease-out]" onClick={onClose}>
      <div className="bg-gradient-to-b from-yellow-900/90 to-amber-900/90 border-4 border-yellow-400 rounded-2xl p-8 text-center shadow-2xl shadow-yellow-500/30 animate-[bounceIn_0.5s_ease-out]">
        <div className="text-6xl mb-3 animate-bounce">{monEmoji}</div>
        <div className="text-yellow-300 font-mono text-sm mb-1">🎉 Congratulations! 🎉</div>
        <div className="text-white font-mono font-black text-2xl mb-1">{monName}</div>
        <div className="text-yellow-400 font-mono text-xl">
          grew to <span className="text-3xl font-black text-yellow-300">Lv.{level}</span>!
        </div>
        <div className="text-gray-400 font-mono text-xs mt-4">Tap to continue</div>
      </div>
    </div>
  );
}

function CaptureOverlay({ mon, onClose }: { mon: StudyMon; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-[fadeIn_0.3s_ease-out]" onClick={onClose}>
      <div className="bg-gradient-to-b from-purple-900/90 to-indigo-900/90 border-4 border-purple-400 rounded-2xl p-8 text-center shadow-2xl shadow-purple-500/30 animate-[bounceIn_0.5s_ease-out]">
        <div className="text-6xl mb-3">{mon.emoji}</div>
        <div className="text-purple-300 font-mono text-sm mb-1">🎣 Rescued!</div>
        <div className="text-white font-mono font-black text-2xl mb-1">{mon.name}</div>
        <div className="text-purple-400 font-mono text-sm">joined your party!</div>
        <div className="text-gray-400 font-mono text-xs mt-4">Tap to continue</div>
      </div>
    </div>
  );
}

function BattleTransition({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 800);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-50 bg-black animate-[battleFlash_0.8s_ease-in-out]">
      <style>{`
        @keyframes battleFlash {
          0% { opacity: 0; }
          20% { opacity: 1; }
          40% { opacity: 0; }
          60% { opacity: 1; }
          80% { opacity: 0; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default function App() {
  const {
    screen,
    setScreen,
    gameData,
    loadGame,
    startNewGame,
    addXp,
    addToParty,
    setActiveMon,
    removeFromParty,
    recordAnswer,
    recordBattleResult,
  } = useGameState();

  const [levelUpInfo, setLevelUpInfo] = useState<{ level: number; name: string; emoji: string } | null>(null);
  const [capturedMon, setCapturedMon] = useState<StudyMon | null>(null);
  const [showTransition, setShowTransition] = useState(false);
  const [pendingScreen, setPendingScreen] = useState<'battle' | null>(null);

  const goToBattle = () => {
    setShowTransition(true);
    setPendingScreen('battle');
  };

  if (showTransition && pendingScreen) {
    return (
      <BattleTransition
        onDone={() => {
          setShowTransition(false);
          setScreen(pendingScreen);
          setPendingScreen(null);
        }}
      />
    );
  }

  if (capturedMon) {
    return (
      <CaptureOverlay
        mon={capturedMon}
        onClose={() => setCapturedMon(null)}
      />
    );
  }

  if (levelUpInfo) {
    return (
      <LevelUpOverlay
        level={levelUpInfo.level}
        monName={levelUpInfo.name}
        monEmoji={levelUpInfo.emoji}
        onClose={() => setLevelUpInfo(null)}
      />
    );
  }

  if (screen === 'title' || !gameData || !isQuestionsLoaded()) {
    return <TitleScreen onLoadGame={loadGame} onNewGame={startNewGame} />;
  }

  if (screen === 'battle') {
    return (
      <BattleScreen
        gameData={gameData}
        onBattleEnd={(won, xp, captured) => {
          const prevLevel = gameData.level;
          recordBattleResult(won);
          
          if (captured) {
            addToParty(captured, gameData.level);
            setCapturedMon(captured);
          }
          
          if (xp > 0) {
            addXp(xp);
            setTimeout(() => {
              let testXp = gameData.xp + xp;
              let testLevel = gameData.level;
              const xpForLvl = (l: number) => Math.floor(l * l * 10 + l * 25);
              while (testXp >= xpForLvl(testLevel) && testLevel < 100) {
                testXp -= xpForLvl(testLevel);
                testLevel++;
              }
              if (testLevel > prevLevel) {
                setLevelUpInfo({
                  level: testLevel,
                  name: gameData.activeMon.name,
                  emoji: gameData.activeMon.emoji,
                });
              }
            }, 100);
          }
          setScreen('overworld');
        }}
        onRecordAnswer={recordAnswer}
        onSwapIn={(partyIndex) => {
          const member = gameData.party[partyIndex];
          if (member) {
            setActiveMon(member.mon);
            removeFromParty(partyIndex);
            return member.mon;
          }
          return null;
        }}
      />
    );
  }

  if (screen === 'stats') {
    return <StatsPage gameData={gameData} onBack={() => setScreen('overworld')} />;
  }

  if (screen === 'party') {
    return (
      <PartyScreen
        gameData={gameData}
        onSetActive={(mon, partyIndex) => {
          // Swap: current active goes to party, selected becomes active
          const currentActive = gameData.activeMon;
          setActiveMon(mon);
          removeFromParty(partyIndex);
          addToParty(currentActive, gameData.level);
        }}
        onRelease={(partyIndex) => {
          removeFromParty(partyIndex);
        }}
        onBack={() => setScreen('overworld')}
      />
    );
  }

  return (
    <OverworldScreen
      gameData={gameData}
      onBattle={goToBattle}
      onStats={() => setScreen('stats')}
      onParty={() => setScreen('party')}
      onTitle={() => setScreen('title')}
    />
  );
}
