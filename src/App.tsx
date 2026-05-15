import { useState, useEffect } from 'react';
import { useGameState } from './hooks/useGameState';
import { isQuestionsLoaded } from './data/questions';
import { StudyMon, getDisplayName } from './data/pokemon';
import TitleScreen from './components/TitleScreen';
import OverworldScreen from './components/OverworldScreen';
import BattleScreen from './components/BattleScreen';
import StatsPage from './components/StatsPage';
import PartyScreen from './components/PartyScreen';
import StudyMode from './components/StudyMode';
import DexScreen from './components/DexScreen';
import ReplayViewer from './components/ReplayViewer';
import { getLastReplay } from './utils/replay';

function LevelUpOverlay({ level, monName, monEmoji, onClose }: { level: number; monName: string; monEmoji: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onClose}>
      <div className="text-center" style={{ animation: 'bounceIn 0.6s ease-out' }}>
        <div className="text-7xl mb-4">{monEmoji}</div>
        <p className="text-yellow-400 font-mono text-xl font-bold mb-2">🎉 Congratulations! 🎉</p>
        <p className="text-white font-mono text-lg">
          {monName} grew to <span className="text-yellow-400 font-bold">Lv.{level}</span>!
        </p>
        <p className="text-gray-500 font-mono text-xs mt-4">Tap to continue</p>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onClose}>
      <div className="text-center" style={{ animation: 'bounceIn 0.6s ease-out' }}>
        <div className="text-7xl mb-4">{mon.emoji}</div>
        <p className="text-green-400 font-mono text-xl font-bold mb-2">🎣 Rescued!</p>
        <p className="text-white font-mono text-lg">{mon.name} joined your party!</p>
        <p className="text-gray-500 font-mono text-xs mt-4">Tap to continue</p>
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
    <div className="fixed inset-0 z-50 bg-black" style={{ animation: 'battleFlash 0.8s ease-in-out' }}>
      <style>
        {`
          @keyframes battleFlash {
            0% { opacity: 0; }
            20% { opacity: 1; }
            40% { opacity: 0; }
            60% { opacity: 1; }
            80% { opacity: 0; }
            100% { opacity: 1; }
          }
        `}
      </style>
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
    renameActiveMon,
    renamePartyMon,
    recordEncounter,
    recordCapture,
  } = useGameState();

  const [levelUpInfo, setLevelUpInfo] = useState<{ level: number; name: string; emoji: string } | null>(null);
  const [capturedMon, setCapturedMon] = useState<StudyMon | null>(null);
  const [showTransition, setShowTransition] = useState(false);
  const [pendingScreen, setPendingScreen] = useState<'battle' | null>(null);
  const [showStudyMode, setShowStudyMode] = useState(false);
  const [showDex, setShowDex] = useState(false);
  const [showReplay, setShowReplay] = useState(false);

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
    return <CaptureOverlay mon={capturedMon} onClose={() => setCapturedMon(null)} />;
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

  if (showStudyMode) {
    return (
      <StudyMode
        onBack={() => setShowStudyMode(false)}
        onRecordAnswer={recordAnswer}
      />
    );
  }

  if (showDex) {
    return (
      <DexScreen
        gameData={gameData}
        onBack={() => setShowDex(false)}
      />
    );
  }

  if (showReplay) {
    const replay = getLastReplay();
    if (replay) {
      return <ReplayViewer initialReplay={replay} onClose={() => setShowReplay(false)} />;
    }
    setShowReplay(false);
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
            recordCapture(captured.id);
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
                  name: getDisplayName(gameData.activeMon),
                  emoji: gameData.activeMon.emoji,
                });
              }
            }, 100);
          }
          setScreen('overworld');
        }}
        onRecordAnswer={recordAnswer}
        onRecordEncounter={recordEncounter}
      />
    );
  }

  if (screen === 'stats') {
    return (
      <StatsPage
        gameData={gameData}
        onBack={() => setScreen('overworld')}
        onStudyMode={() => setShowStudyMode(true)}
      />
    );
  }

  if (screen === 'party') {
    return (
      <PartyScreen
        gameData={gameData}
        onSwap={(mon, partyIndex) => {
          const currentActive = gameData.activeMon;
          setActiveMon(mon);
          removeFromParty(partyIndex);
          addToParty(currentActive, gameData.level);
        }}
        onRelease={(partyIndex) => {
          removeFromParty(partyIndex);
        }}
        onRenameActive={renameActiveMon}
        onRenameParty={renamePartyMon}
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
      onDex={() => setShowDex(true)}
      onReplay={() => setShowReplay(true)}
      onTitle={() => setScreen('title')}
    />
  );
}
