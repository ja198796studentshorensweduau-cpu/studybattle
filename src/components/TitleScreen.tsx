import { useState, useRef } from 'react';
import { loadSaves, deleteSaveData, exportSaveToFile, importSaveFromJSON, SaveData } from '../hooks/useGameState';
import { studymons } from '../data/pokemon';
import { loadQuestionsFromJSON, isQuestionsLoaded, getQuestions } from '../data/questions';
import { setHfApiKey, getHfApiKey, validateApiKey, ValidationResult } from '../utils/hfApi';

interface TitleScreenProps {
  onLoadGame: (slot: number) => void;
  onNewGame: (slot: number, name: string, starterIndex: number) => void;
}

export default function TitleScreen({ onLoadGame, onNewGame }: TitleScreenProps) {
  const [view, setView] = useState<'main' | 'saves' | 'new_game'>('main');
  const [saves, setSaves] = useState<(SaveData | null)[]>(loadSaves());
  const [selectedSlot, setSelectedSlot] = useState<number>(0);
  const [playerName, setPlayerName] = useState('');
  const [starterIndex, setStarterIndex] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [saveImportError, setSaveImportError] = useState<string | null>(null);
  const [questionsReady, setQuestionsReady] = useState(isQuestionsLoaded());
  const [loadedCount, setLoadedCount] = useState(getQuestions().length);
  const [importSlot, setImportSlot] = useState<number>(0);
  const [showApiKeyPopup, setShowApiKeyPopup] = useState(false);
  const [apiKey, setApiKey] = useState(getHfApiKey());
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [keyTestState, setKeyTestState] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [keyTestResult, setKeyTestResult] = useState<ValidationResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const saveFileRef = useRef<HTMLInputElement>(null);

  const showApiPopupThen = (action: () => void) => {
    setPendingAction(() => action);
    setShowApiKeyPopup(true);
  };

  const dismissPopupAndRun = (saveKey: boolean) => {
    if (saveKey && apiKey.trim()) {
      setHfApiKey(apiKey);
    }
    setShowApiKeyPopup(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const starters = [
    { mon: studymons[0], desc: 'Tanky — long battles, very forgiving of mistakes' },
    { mon: studymons[1], desc: 'Balanced — medium battles, moderate mistake room' },
    { mon: studymons[2], desc: 'Glass cannon — fast battles, punishes mistakes' },
  ];

  const handleDelete = (slot: number) => {
    deleteSaveData(slot);
    setSaves(loadSaves());
    setConfirmDelete(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setJsonError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const data = JSON.parse(text);
        const err = loadQuestionsFromJSON(data);
        if (err) {
          setJsonError(err);
        } else {
          setQuestionsReady(true);
          setLoadedCount(getQuestions().length);
        }
      } catch {
        setJsonError('Invalid JSON file. Check the syntax and try again.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSaveImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaveImportError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const data = JSON.parse(text);
        const err = importSaveFromJSON(importSlot, data);
        if (err) {
          setSaveImportError(err);
        } else {
          setSaves(loadSaves());
          setSaveImportError(null);
        }
      } catch {
        setSaveImportError('Invalid save file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleTestKey = async () => {
    setKeyTestState('testing');
    setKeyTestResult(null);
    const result = await validateApiKey(apiKey);
    setKeyTestResult(result);
    setKeyTestState(result.ok ? 'success' : 'error');
  };

  // ---- API KEY POPUP (renders as overlay on any view) ----
  const apiKeyPopup = showApiKeyPopup ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => dismissPopupAndRun(false)}>
      <div className="bg-gray-900 border-2 border-indigo-500 rounded-xl p-6 max-w-md w-full shadow-2xl shadow-indigo-500/20" onClick={(e) => e.stopPropagation()} style={{ animation: 'bounceIn 0.4s ease-out' }}>
        <h3 className="text-indigo-300 font-mono font-bold text-lg mb-2 text-center">🤖 AI Marking Setup</h3>
        <p className="text-gray-400 font-mono text-xs mb-4 text-center">
          Paste your HuggingFace API key to enable AI-graded extended response questions. Without a key, these questions will use basic keyword matching instead.
        </p>

        <div className="mb-3">
          <label className="text-gray-300 font-mono text-xs block mb-1">HuggingFace API Token:</label>
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setKeyTestState('idle'); setKeyTestResult(null); }}
              placeholder="hf_xxxxxxxxxxxxxxxxxxxx"
              className="flex-1 bg-gray-800 border-2 border-gray-600 focus:border-indigo-400 rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:outline-none placeholder-gray-600"
              autoFocus
            />
            <button
              onClick={handleTestKey}
              disabled={!apiKey.trim() || keyTestState === 'testing'}
              className={`px-4 py-2.5 rounded-lg font-mono text-xs font-bold border transition-colors flex-shrink-0 ${
                keyTestState === 'testing' ? 'bg-indigo-800 border-indigo-600 text-indigo-300'
                : keyTestState === 'success' ? 'bg-green-800 border-green-600 text-green-300'
                : keyTestState === 'error' ? 'bg-red-800 border-red-600 text-red-300'
                : apiKey.trim() ? 'bg-indigo-700 hover:bg-indigo-600 border-indigo-500 text-white'
                : 'bg-gray-700 border-gray-600 text-gray-500 cursor-not-allowed'
              }`}
            >
              {keyTestState === 'testing' ? '⏳...' : keyTestState === 'success' ? '✅ OK' : keyTestState === 'error' ? '❌ Fail' : '🔍 TEST'}
            </button>
          </div>
        </div>

        {/* Test result feedback */}
        {keyTestResult && (
          <div className={`rounded-lg p-2.5 mb-3 border ${keyTestResult.ok ? 'bg-green-900/30 border-green-700' : 'bg-red-900/30 border-red-700'}`} style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <p className={`font-mono text-xs ${keyTestResult.ok ? 'text-green-400' : 'text-red-400'}`}>
              {keyTestResult.ok ? '✅' : '❌'} {keyTestResult.message}
            </p>
          </div>
        )}

        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-3 mb-4">
          <p className="text-gray-500 font-mono text-xs">
            💡 Get a free token at{' '}
            <span className="text-indigo-400">huggingface.co/settings/tokens</span>
          </p>
          <p className="text-gray-600 font-mono text-xs mt-1">
            The key is only stored in memory — never saved to disk or sent anywhere except the HuggingFace API.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => dismissPopupAndRun(false)}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 font-mono py-2.5 rounded-lg text-sm border border-gray-600"
          >
            SKIP
          </button>
          <button
            onClick={() => dismissPopupAndRun(true)}
            className={`flex-1 font-mono py-2.5 rounded-lg text-sm border ${
              apiKey.trim() && keyTestState === 'success'
                ? 'bg-green-600 hover:bg-green-500 text-white border-green-500'
                : apiKey.trim()
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500'
                : 'bg-gray-700 text-gray-500 border-gray-600 cursor-not-allowed'
            }`}
            disabled={!apiKey.trim()}
          >
            {keyTestState === 'success' ? '✅ SAVE & PLAY' : apiKey.trim() ? '💾 SAVE & PLAY' : '💾 SAVE & PLAY'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // ---- NEW GAME ----
  if (view === 'new_game') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
        {apiKeyPopup}
        <div className="bg-gray-900/90 border-4 border-indigo-500 rounded-xl p-6 max-w-lg w-full shadow-2xl shadow-indigo-500/20">
          <h2 className="text-2xl font-bold text-indigo-300 text-center mb-6 font-mono">NEW GAME</h2>

          <div className="mb-6">
            <label className="block text-indigo-200 font-mono mb-2 text-sm">YOUR NAME:</label>
            <input type="text" value={playerName} onChange={(e) => setPlayerName(e.target.value.slice(0, 12))} placeholder="Enter your name..." className="w-full bg-gray-800 border-2 border-indigo-600 rounded-lg px-4 py-3 text-white font-mono text-lg focus:outline-none focus:border-indigo-400 placeholder-gray-500" autoFocus />
          </div>

          <div className="mb-6">
            <p className="text-indigo-200 font-mono mb-3 text-sm">CHOOSE YOUR STARTER:</p>
            <div className="grid grid-cols-1 gap-3">
              {starters.map((s, i) => (
                <button key={s.mon.id} onClick={() => setStarterIndex(i)} className={`flex items-center gap-4 p-4 rounded-lg border-2 transition-all duration-200 text-left ${starterIndex === i ? 'border-yellow-400 bg-yellow-400/10 shadow-lg shadow-yellow-400/20' : 'border-gray-600 bg-gray-800/60 hover:border-indigo-500'}`}>
                  <span className="text-4xl">{s.mon.emoji}</span>
                  <div>
                    <div className="text-white font-bold font-mono">{s.mon.name}</div>
                    <div className="text-xs font-mono" style={{ color: s.mon.typeColor }}>{s.mon.type} Type</div>
                    <div className="text-gray-400 text-xs mt-1">{s.desc}</div>
                  </div>
                  {starterIndex === i && <span className="ml-auto text-yellow-400 text-2xl">✓</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setView('saves')} className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 font-mono py-3 rounded-lg transition-colors border border-gray-600">BACK</button>
            <button onClick={() => { if (playerName.trim() && starterIndex !== null) { const name = playerName.trim(); const si = starterIndex; const slot = selectedSlot; showApiPopupThen(() => onNewGame(slot, name, si)); } }} disabled={!playerName.trim() || starterIndex === null} className={`flex-1 font-mono py-3 rounded-lg transition-colors border ${playerName.trim() && starterIndex !== null ? 'bg-green-700 hover:bg-green-600 text-white border-green-500' : 'bg-gray-700 text-gray-500 border-gray-600 cursor-not-allowed'}`}>
              START!
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- SAVES ----
  if (view === 'saves') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-gray-900/90 border-4 border-indigo-500 rounded-xl p-6 max-w-lg w-full shadow-2xl shadow-indigo-500/20">
          <h2 className="text-2xl font-bold text-indigo-300 text-center mb-6 font-mono">SAVE FILES</h2>

          <div className="space-y-3 mb-6">
            {saves.map((save, i) => (
              <div key={i} className="bg-gray-800/80 border-2 border-gray-600 rounded-xl p-4">
                {save ? (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{save.activeMon.emoji}</span>
                        <div>
                          <div className="text-white font-mono font-bold text-sm">{save.playerName}</div>
                          <div className="text-indigo-400 font-mono text-xs">Lv.{save.level} {save.activeMon.name}</div>
                        </div>
                      </div>
                      <span className="text-gray-500 font-mono text-xs">Slot {i + 1}</span>
                    </div>
                    {save._tampered && (
                      <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-1.5 mb-2">
                        <p className="text-red-400 font-mono text-xs font-bold">⚠️ TAMPERED SAVE DETECTED</p>
                        <p className="text-red-400/70 font-mono text-[10px]">Stats were modified externally and have been corrected.</p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => { if (questionsReady) showApiPopupThen(() => onLoadGame(i)); }} disabled={!questionsReady} className={`flex-1 font-mono py-2 rounded-lg text-sm transition-colors ${questionsReady ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}>
                        {questionsReady ? 'PLAY' : 'LOAD Q\'s FIRST'}
                      </button>
                      <button onClick={() => exportSaveToFile(i)} className="bg-gray-700 hover:bg-gray-600 text-gray-300 font-mono py-2 px-3 rounded-lg text-sm transition-colors">📤</button>
                      {confirmDelete === i ? (
                        <button onClick={() => handleDelete(i)} className="bg-red-700 hover:bg-red-600 text-white font-mono py-2 px-3 rounded-lg text-sm transition-colors">CONFIRM</button>
                      ) : (
                        <button onClick={() => setConfirmDelete(i)} className="bg-gray-700 hover:bg-red-700 text-gray-400 hover:text-white font-mono py-2 px-3 rounded-lg text-sm transition-colors">🗑️</button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 font-mono text-sm">Slot {i + 1} — Empty</span>
                    <button onClick={() => { setSelectedSlot(i); setView('new_game'); }} disabled={!questionsReady} className={`font-mono py-2 px-4 rounded-lg text-sm transition-colors ${questionsReady ? 'bg-green-700 hover:bg-green-600 text-white' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}>
                      {questionsReady ? 'NEW GAME' : 'LOAD Q\'s FIRST'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Import save */}
          <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-3 mb-4">
            <p className="text-gray-400 font-mono text-xs mb-2">IMPORT SAVE FILE:</p>
            <div className="flex gap-2 items-center">
              <select value={importSlot} onChange={(e) => setImportSlot(Number(e.target.value))} className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white font-mono text-xs">
                <option value={0}>Slot 1</option>
                <option value={1}>Slot 2</option>
                <option value={2}>Slot 3</option>
              </select>
              <button onClick={() => saveFileRef.current?.click()} className="bg-indigo-700 hover:bg-indigo-600 text-white font-mono text-xs px-3 py-1 rounded transition-colors">📥 Import</button>
              <input ref={saveFileRef} type="file" accept=".json" onChange={handleSaveImport} className="hidden" />
            </div>
            {saveImportError && <p className="text-red-400 font-mono text-xs mt-2">{saveImportError}</p>}
          </div>

          <button onClick={() => setView('main')} className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-mono py-3 rounded-lg transition-colors border border-gray-600">BACK</button>
        </div>
        {apiKeyPopup}
      </div>
    );
  }

  // ---- MAIN TITLE ----
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <div className="text-center max-w-lg w-full space-y-8">
        {/* Title */}
        <div style={{ animation: 'bounceIn 0.8s ease-out' }}>
          <div className="text-6xl mb-4">⚔️</div>
          <h1 className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 font-mono tracking-wider">
            STUDY BATTLE
          </h1>
          <p className="text-indigo-400/60 font-mono text-sm mt-2">Learn by Battling</p>
        </div>

        {/* Question loader */}
        <div className="bg-gray-900/80 border-2 border-indigo-600 rounded-xl p-5 shadow-xl shadow-indigo-500/10" style={{ animation: 'fadeIn 0.6s ease-out 0.3s both' }}>
          <h3 className="text-indigo-300 font-mono font-bold mb-3 text-sm">📋 LOAD QUESTIONS</h3>
          <p className="text-gray-400 font-mono text-xs mb-3">Upload a JSON file with your questions to begin.</p>

          <button onClick={() => fileRef.current?.click()} className="w-full bg-indigo-700 hover:bg-indigo-600 text-white font-mono py-3 rounded-lg transition-colors border border-indigo-500 mb-2">
            📁 Choose JSON File
          </button>
          <input ref={fileRef} type="file" accept=".json" onChange={handleFileUpload} className="hidden" />

          {jsonError && (
            <div className="bg-red-900/40 border border-red-700 rounded-lg p-3 mt-2">
              <p className="text-red-400 font-mono text-xs">❌ {jsonError}</p>
            </div>
          )}

          {questionsReady && (
            <div className="bg-green-900/40 border border-green-700 rounded-lg p-3 mt-2" style={{ animation: 'bounceIn 0.5s ease-out' }}>
              <p className="text-green-400 font-mono text-xs">✅ {loadedCount} questions loaded!</p>
            </div>
          )}

          {/* Format help */}
          <details className="mt-3">
            <summary className="text-gray-500 font-mono text-xs cursor-pointer hover:text-gray-400">📖 JSON format guide</summary>
            <div className="mt-2 bg-gray-800/60 rounded-lg p-3 text-left">
              <pre className="text-gray-400 font-mono text-xs overflow-x-auto whitespace-pre-wrap">
{`[
  {
    "id": "q1",
    "category": "biology",
    "type": "multiple_choice",
    "difficulty": 1,
    "question": "What organelle produces energy?",
    "options": [
      "Mitochondria",
      "Nucleus",
      "Ribosome",
      "Golgi body"
    ],
    "answer": "Mitochondria",
    "explanation": "Mitochondria are the powerhouse of the cell."
  },
  {
    "id": "q2",
    "category": "biology",
    "type": "short_answer",
    "difficulty": 2,
    "question": "What gas do plants absorb?",
    "answer": "carbon dioxide",
    "explanation": "Plants absorb CO2 for photosynthesis."
  },
  {
    "id": "q3",
    "category": "map_skills",
    "type": "grid_click",
    "difficulty": 2,
    "question": "Click on grid square 2406.",
    "answer": "2406",
    "explanation": "Along the corridor then up the stairs.",
    "gridData": {
      "targetX": 4,
      "targetY": 6,
      "gridLabel": "2406",
      "tolerance": 0
    }
  },
  {
    "id": "q4",
    "category": "biology",
    "type": "extended_response",
    "difficulty": 3,
    "question": "Explain the process of photosynthesis.",
    "answer": "Plants use sunlight, CO2 and water to produce glucose and oxygen via chlorophyll in chloroplasts.",
    "explanation": "Photosynthesis converts light energy to chemical energy.",
    "extendedResponse": {
      "keyPoints": [
        "Uses sunlight/light energy",
        "Absorbs carbon dioxide (CO2)",
        "Absorbs water (H2O)",
        "Produces glucose/sugar",
        "Releases oxygen (O2)",
        "Occurs in chloroplasts"
      ],
      "markingScheme": "1 mark per key point correctly mentioned. Must be scientifically accurate.",
      "maxMarks": 6
    }
  }
]`}
              </pre>
              <div className="mt-2 text-gray-500 font-mono text-xs space-y-1">
                <p>type: "multiple_choice" | "short_answer" | "grid_click" | "extended_response"</p>
                <p>difficulty: 1, 2, or 3</p>
                <p>category: any string — used for grouping in stats</p>
                <p>options: required for multiple_choice only</p>
                <p>explanation: optional — shown after answering</p>
                <p>gridData: required for grid_click — gridLabel is the source of truth (e.g. "2406" = easting 24, northing 06). targetX/targetY are legacy fallbacks.</p>
                <p>extendedResponse: required for extended_response — {"{"}"keyPoints": ["point1", ...], "markingScheme": "description", "maxMarks": number{"}"}</p>
              </div>
            </div>
          </details>
        </div>

        {/* Play button */}
        <div style={{ animation: 'fadeIn 0.6s ease-out 0.6s both' }}>
          <button onClick={() => setView('saves')} className={`w-full font-mono py-5 rounded-2xl transition-all text-xl font-bold tracking-wider border-2 shadow-lg active:scale-[0.98] ${questionsReady ? 'bg-gradient-to-r from-green-700 to-emerald-600 hover:from-green-600 hover:to-emerald-500 text-white border-green-500 hover:border-green-400 hover:shadow-green-500/30' : 'bg-gradient-to-r from-gray-700 to-gray-600 text-gray-400 border-gray-500'}`}>
            {questionsReady ? '▶ PLAY' : '▶ LOAD QUESTIONS TO PLAY'}
          </button>
        </div>

        <p className="text-gray-600 font-mono text-xs">v2.0 — Answer questions to attack! 🎮</p>
      </div>
    </div>
  );
}
