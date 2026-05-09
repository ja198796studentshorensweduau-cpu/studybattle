import { useState } from 'react';
import { Question } from '../data/questions';

interface GridClickQuestionProps {
  question: Question;
  onAnswer: (correct: boolean) => void;
}

export default function GridClickQuestion({ question, onAnswer }: GridClickQuestionProps) {
  const [clicked, setClicked] = useState<{ x: number; y: number } | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [wasCorrect, setWasCorrect] = useState(false);

  if (!question.gridData) return null;

  const cols = 10; // eastings 20–29
  const rows = 10; // northings 03–12
  const startEasting = 20;
  const startNorthing = 3;
  const endNorthing = startNorthing + rows - 1; // 12

  const { targetX, targetY } = question.gridData;

  const handleCellClick = (colIdx: number, northing: number) => {
    if (submitted) return;
    setClicked({ x: colIdx, y: northing });
  };

  const handleSubmit = () => {
    if (!clicked || submitted) return;
    setSubmitted(true);
    const correct = clicked.x === targetX && clicked.y === targetY;
    setWasCorrect(correct);
  };

  const handleContinue = () => {
    onAnswer(wasCorrect);
  };

  return (
    <div>
      <div className="bg-gray-800 border-2 border-indigo-600 rounded-xl p-4 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-700 text-indigo-200">GRID REFERENCES</span>
          <span className="text-xs font-mono text-gray-500">{'⭐'.repeat(question.difficulty)}</span>
        </div>
        <p className="text-white font-mono text-sm leading-relaxed">{question.question}</p>
        <p className="text-indigo-400 font-mono text-xs mt-1">"Along the corridor, up the stairs" — Easting first, then Northing</p>
      </div>

      {/* Grid Map */}
      <div className="bg-green-900/40 border-2 border-green-700 rounded-xl p-2 mb-3 overflow-x-auto">
        <div className="min-w-[340px]">
          {/* Easting labels across the top */}
          <div className="flex">
            <div className="w-9 h-6 flex-shrink-0" />
            {Array.from({ length: cols }, (_, colIdx) => (
              <div key={colIdx} className="flex-1 h-6 flex items-center justify-center text-xs font-mono text-indigo-300 font-bold">
                {startEasting + colIdx}
              </div>
            ))}
          </div>

          {/* Grid rows — top row = highest northing */}
          {Array.from({ length: rows }, (_, rowIdx) => {
            const northing = endNorthing - rowIdx; // 12, 11, 10, ... 3
            return (
              <div key={rowIdx} className="flex">
                {/* Northing label */}
                <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center text-xs font-mono text-indigo-300 font-bold">
                  {String(northing).padStart(2, '0')}
                </div>
                {/* Cells */}
                {Array.from({ length: cols }, (_, colIdx) => {
                  const isClicked = clicked?.x === colIdx && clicked?.y === northing;
                  const isTarget = targetX === colIdx && targetY === northing;
                  const showTarget = submitted && isTarget;
                  const showWrong = submitted && isClicked && !isTarget;

                  let cellBg = 'bg-green-800/30 hover:bg-green-600/50';
                  if (showTarget) cellBg = 'bg-green-500/70 ring-2 ring-green-400';
                  else if (showWrong) cellBg = 'bg-red-500/70 ring-2 ring-red-400';
                  else if (isClicked && !submitted) cellBg = 'bg-yellow-500/50 ring-2 ring-yellow-400';
                  else if (submitted) cellBg = 'bg-green-800/20';

                  // Terrain decoration
                  const seed = (colIdx * 7 + rowIdx * 13) % 10;
                  let terrain = '';
                  if (seed === 0) terrain = '🌲';
                  else if (seed === 3) terrain = '🏠';
                  else if (seed === 5) terrain = '⛰️';
                  else if (seed === 7) terrain = '🌊';

                  let content = terrain;
                  if (showTarget) content = '✅';
                  else if (showWrong) content = '❌';
                  else if (isClicked && !submitted) content = '📍';

                  return (
                    <button
                      key={colIdx}
                      onClick={() => handleCellClick(colIdx, northing)}
                      disabled={submitted}
                      className={`flex-1 h-9 border border-green-700/50 ${cellBg} flex items-center justify-center text-xs transition-all ${!submitted ? 'cursor-pointer active:scale-90' : ''}`}
                    >
                      {content}
                    </button>
                  );
                })}
              </div>
            );

            // helper aliases scoped per row — moved inside the map to avoid issues
            // Actually, let's use a cleaner approach with variables from closure
          })}
        </div>
      </div>

      {/* Selected feedback */}
      {clicked && !submitted && (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2">
            <span className="text-gray-400 font-mono text-xs">Selected: </span>
            <span className="text-yellow-300 font-mono text-sm font-bold">
              {String(startEasting + clicked.x).padStart(2, '0')}{String(clicked.y).padStart(2, '0')}
            </span>
          </div>
          <button onClick={handleSubmit} className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono px-6 py-2 rounded-lg transition-colors font-bold">
            CONFIRM
          </button>
        </div>
      )}

      {/* Result */}
      {submitted && (
        <div>
          <div className={`text-center font-mono text-sm p-3 rounded-lg mb-3 ${wasCorrect ? 'text-green-400 bg-green-900/30 border border-green-700' : 'text-red-400 bg-red-900/30 border border-red-700'}`}>
            {wasCorrect
              ? '✅ Correct grid square!'
              : `❌ Wrong! The correct square was ${question.gridData.gridLabel} (highlighted green above)`}
          </div>
          <button
            onClick={handleContinue}
            className={`w-full font-mono py-3 rounded-xl transition-all text-lg font-bold active:scale-95 border-2 ${
              wasCorrect
                ? 'bg-green-700 hover:bg-green-600 text-white border-green-500'
                : 'bg-indigo-700 hover:bg-indigo-600 text-white border-indigo-500'
            }`}
          >
            Continue ▶
          </button>
        </div>
      )}
    </div>
  );
}
