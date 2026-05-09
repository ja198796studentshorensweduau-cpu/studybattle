import { useState, useRef } from 'react';
import { loadSaves, deleteSaveData, exportSaveToFile, importSaveFromJSON, SaveData } from '../hooks/useGameState';
import { studymons } from '../data/pokemon';
import { loadQuestionsFromJSON, isQuestionsLoaded, getQuestions } from '../data/questions';

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
  const fileRef = useRef<HTMLInputElement>(null);
  const saveFileRef = useRef<HTMLInputElement>(null);

  const starters = [
    { mon: studymons[0], desc: 'Tanky – long battles, very forgiving of mistakes' },
    { mon: studymons[1], desc: 'Balanced – medium battles, moderate mistake room' },
    { mon: studymons[2], desc: 'Glass cannon – fast battles, punishes mistakes' },
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
    // reset so the same file can be re-uploaded
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

  // ---- NEW GAME ----
  if (view === 'new_game') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
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
            <button onClick={() => { if (playerName.trim() && starterIndex !== null) onNewGame(selectedSlot, playerName.trim(), starterIndex); }} disabled={!playerName.trim() || starterIndex === null} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-mono py-3 rounded-lg transition-colors font-bold border border-indigo-400 disabled:border-gray-600">START!</button>
          </div>
        </div>
      </div>
    );
  }

  // ---- SAVE FILES ----
  if (view === 'saves') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-gray-900/90 border-4 border-indigo-500 rounded-xl p-6 max-w-lg w-full shadow-2xl shadow-indigo-500/20">
          <h2 className="text-2xl font-bold text-indigo-300 text-center mb-6 font-mono">SAVE FILES</h2>

          <div className="space-y-3 mb-6">
            {[0, 1, 2].map((slot) => {
              const save = saves[slot];
              return (
                <div key={slot} className="relative">
                  {confirmDelete === slot ? (
                    <div className="bg-red-900/80 border-2 border-red-500 rounded-lg p-4">
                      <p className="text-red-200 font-mono text-sm mb-3">Delete this save file?</p>
                      <div className="flex gap-2">
                        <button onClick={() => handleDelete(slot)} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-mono py-2 rounded text-sm">DELETE</button>
                        <button onClick={() => setConfirmDelete(null)} className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-mono py-2 rounded text-sm">CANCEL</button>
                      </div>
                    </div>
                  ) : save ? (
                    <div>
                      <div className="flex items-stretch gap-2">
                        <button onClick={() => onLoadGame(slot)} className="flex-1 bg-gray-800/80 border-2 border-indigo-600 hover:border-indigo-400 rounded-lg p-4 text-left transition-all hover:bg-gray-700/80">
                          <div className="flex items-center gap-3">
                            <span className="text-3xl">{save.activeMon.emoji}</span>
                            <div>
                              <div className="text-white font-bold font-mono">File {slot + 1}: {save.playerName}</div>
                              <div className="text-indigo-400 text-xs font-mono">Lv.{save.level} {save.activeMon.name} • {save.battlesWon}W/{save.battlesLost}L</div>
                              <div className="text-gray-400 text-xs font-mono mt-1">{save.questionsAnswered.length} questions answered</div>
                            </div>
                          </div>
                        </button>
                        <div className="flex flex-col gap-1">
                          <button onClick={() => exportSaveToFile(slot)} className="flex-1 bg-indigo-900/60 hover:bg-indigo-800 border-2 border-indigo-700 rounded-lg px-2.5 transition-colors" title="Export save">
                            <span className="text-indigo-300 text-sm">📤</span>
                          </button>
                          <button onClick={() => setConfirmDelete(slot)} className="flex-1 bg-red-900/50 hover:bg-red-800 border-2 border-red-700 rounded-lg px-2.5 transition-colors" title="Delete save">
                            <span className="text-red-400 text-sm">✕</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-stretch gap-2">
                      <button onClick={() => { setSelectedSlot(slot); setView('new_game'); }} className="flex-1 bg-gray-800/40 border-2 border-dashed border-gray-600 hover:border-indigo-500 rounded-lg p-4 text-left transition-all hover:bg-gray-700/40">
                        <div className="text-gray-400 font-mono">File {slot + 1}: <span className="text-indigo-500">NEW GAME</span></div>
                      </button>
                      <button onClick={() => { setImportSlot(slot); saveFileRef.current?.click(); }} className="bg-indigo-900/40 hover:bg-indigo-800 border-2 border-dashed border-indigo-700 rounded-lg px-3 transition-colors" title="Import save file">
                        <span className="text-indigo-400 text-sm">📥</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <input ref={saveFileRef} type="file" accept=".json,application/json" onChange={handleSaveImport} className="hidden" />

          {saveImportError && (
            <div className="mb-4 bg-red-900/60 border border-red-500 rounded-lg p-3">
              <p className="text-red-300 font-mono text-xs">❌ {saveImportError}</p>
            </div>
          )}

          <button onClick={() => setView('main')} className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-mono py-3 rounded-lg transition-colors border border-gray-600">BACK</button>
        </div>
      </div>
    );
  }

  // ---- MAIN TITLE ----
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center justify-center p-4">
      <div className="text-center mb-10">
        <div className="text-7xl mb-4 animate-bounce">⚔️</div>
        <h1 className="text-5xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-purple-300 to-indigo-300 font-mono tracking-wider mb-2">
          StudyBattle
        </h1>
        <p className="text-indigo-400/80 font-mono text-sm tracking-widest">LEARN BY BATTLING</p>
      </div>

      {/* JSON Upload Area */}
      <div className="w-full max-w-md mb-8">
        <div className={`border-2 border-dashed rounded-xl p-5 text-center transition-all ${questionsReady ? 'border-green-500 bg-green-900/20' : 'border-indigo-500/50 bg-gray-800/40'}`}>
          {questionsReady ? (
            <div>
              <div className="text-green-400 font-mono text-sm font-bold mb-1">✅ {loadedCount} questions loaded</div>
              <p className="text-gray-400 font-mono text-xs mb-3">Upload a new file to replace them.</p>
              <button onClick={() => fileRef.current?.click()} className="bg-gray-700 hover:bg-gray-600 text-gray-300 font-mono text-xs px-4 py-2 rounded-lg transition-colors border border-gray-600">
                📄 Replace JSON
              </button>
            </div>
          ) : (
            <div>
              <div className="text-indigo-300 font-mono text-sm font-bold mb-1">📄 Load Questions</div>
              <p className="text-gray-400 font-mono text-xs mb-3">Upload a JSON file with your questions to start playing.</p>
              <button onClick={() => fileRef.current?.click()} className="bg-indigo-700 hover:bg-indigo-600 text-white font-mono text-sm px-5 py-2.5 rounded-lg transition-colors border border-indigo-500 font-bold">
                Choose JSON File
              </button>
            </div>
          )}
          <input ref={fileRef} type="file" accept=".json,application/json" onChange={handleFileUpload} className="hidden" />
        </div>
        {jsonError && (
          <div className="mt-3 bg-red-900/60 border border-red-500 rounded-lg p-3">
            <p className="text-red-300 font-mono text-xs">❌ {jsonError}</p>
          </div>
        )}
      </div>

      {/* Play button */}
      <div className="space-y-3 w-full max-w-xs">
        <button
          onClick={() => { if (questionsReady) setView('saves'); }}
          disabled={!questionsReady}
          className="w-full bg-indigo-700/80 hover:bg-indigo-600 disabled:bg-gray-800 disabled:border-gray-700 disabled:text-gray-600 text-white font-mono py-4 rounded-xl transition-all duration-200 text-lg tracking-wider border-2 border-indigo-500 disabled:hover:scale-100 hover:border-indigo-300 shadow-lg hover:shadow-indigo-500/30 hover:scale-[1.02] active:scale-95"
        >
          {questionsReady ? '▶ PLAY' : '▶ LOAD QUESTIONS FIRST'}
        </button>
      </div>

      {/* Format hint */}
      <div className="mt-10 w-full max-w-lg">
        <details className="bg-gray-800/40 border border-gray-700/50 rounded-xl">
          <summary className="px-4 py-3 text-gray-400 font-mono text-xs cursor-pointer hover:text-gray-300 select-none">
            📋 JSON format reference (click to expand)
          </summary>
          <div className="px-4 pb-4">
            <pre className="bg-gray-900 rounded-lg p-3 text-xs font-mono text-gray-300 overflow-x-auto whitespace-pre">{`[
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
  }
]`}</pre>
            <div className="mt-3 space-y-1.5 text-gray-400 font-mono text-xs">
              <p><span className="text-indigo-400">type</span>: <code className="text-gray-300">"multiple_choice"</code> | <code className="text-gray-300">"short_answer"</code> | <code className="text-gray-300">"grid_click"</code></p>
              <p><span className="text-indigo-400">difficulty</span>: <code className="text-gray-300">1</code>, <code className="text-gray-300">2</code>, or <code className="text-gray-300">3</code></p>
              <p><span className="text-indigo-400">category</span>: any string — used for grouping in stats</p>
              <p><span className="text-indigo-400">options</span>: required for multiple_choice only</p>
              <p><span className="text-indigo-400">explanation</span>: optional — shown after answering</p>
              <p><span className="text-indigo-400">gridData</span>: required for grid_click — the grid starts at easting 20 col 0, northing 3 row 0</p>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
