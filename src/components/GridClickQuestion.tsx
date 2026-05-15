import { useState, useMemo } from 'react';
import { Question } from '../data/questions';

interface GridClickQuestionProps {
  question: Question;
  onAnswer: (correct: boolean) => void;
}

/**
 * Parse a grid reference label like "2406" into { easting, northing }.
 * Standard grid refs are even-length: 4-digit (2+2), 6-digit (3+3), etc.
 * "2406" → easting=24, northing=06
 * "243067" → easting=243, northing=067
 */
function parseGridLabel(label: string): { easting: number; northing: number } | null {
  const digits = label.replace(/\D/g, '');
  if (digits.length < 4 || digits.length % 2 !== 0) return null;
  const half = digits.length / 2;
  const easting = parseInt(digits.slice(0, half), 10);
  const northing = parseInt(digits.slice(half), 10);
  if (isNaN(easting) || isNaN(northing)) return null;
  return { easting, northing };
}

export default function GridClickQuestion({ question, onAnswer }: GridClickQuestionProps) {
  const [clicked, setClicked] = useState<{ easting: number; northing: number } | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [wasCorrect, setWasCorrect] = useState(false);

  const gridData = question.gridData;
  if (!gridData) return null;

  const { tolerance } = gridData;

  // Determine the actual target easting and northing VALUES.
  // Primary source of truth: parse from gridLabel.
  // Fallback: use targetX/targetY with the original convention (easting = 20 + targetX, northing = targetY).
  const { targetEasting, targetNorthing } = useMemo(() => {
    const parsed = parseGridLabel(gridData.gridLabel);
    if (parsed) {
      return { targetEasting: parsed.easting, targetNorthing: parsed.northing };
    }
    // Fallback: original convention
    return {
      targetEasting: 20 + gridData.targetX,
      targetNorthing: gridData.targetY,
    };
  }, [gridData]);

  // Build grid dimensions: 10×10 centered on the target
  const cols = 10;
  const rows = 10;

  // Center the grid on the target, but keep values ≥ 0
  const startEasting = Math.max(0, targetEasting - Math.floor(cols / 2));
  const startNorthing = Math.max(0, targetNorthing - Math.floor(rows / 2));
  const endNorthing = startNorthing + rows - 1;

  const handleCellClick = (easting: number, northing: number) => {
    if (submitted) return;
    setClicked({ easting, northing });
  };

  const handleSubmit = () => {
    if (!clicked || submitted) return;
    const correct =
      Math.abs(clicked.easting - targetEasting) <= tolerance &&
      Math.abs(clicked.northing - targetNorthing) <= tolerance;
    setWasCorrect(correct);
    setSubmitted(true);
    setTimeout(() => onAnswer(correct), 1500);
  };

  // Format a coordinate pair as a grid reference string matching gridLabel format
  const formatGridRef = (easting: number, northing: number): string => {
    const parsed = parseGridLabel(gridData.gridLabel);
    if (parsed) {
      const half = gridData.gridLabel.replace(/\D/g, '').length / 2;
      return String(easting).padStart(half, '0') + String(northing).padStart(half, '0');
    }
    return String(easting).padStart(2, '0') + String(northing).padStart(2, '0');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono px-2 py-0.5 rounded bg-green-900/40 text-green-400 uppercase tracking-wider">
          GRID REFERENCES
        </span>
        <span className="text-yellow-400 text-xs">
          {'⭐'.repeat(question.difficulty)}
        </span>
      </div>
      <p className="text-white font-mono text-sm mb-1">{question.question}</p>
      <p className="text-gray-500 font-mono text-xs italic mb-2">
        "Along the corridor, up the stairs" — Easting first, then Northing
      </p>

      <div className="overflow-x-auto">
        <table className="border-collapse mx-auto">
          <thead>
            <tr>
              <th className="w-8"></th>
              {Array.from({ length: cols }, (_, colIdx) => {
                const easting = startEasting + colIdx;
                return (
                  <th key={colIdx} className="text-center text-xs font-mono text-indigo-400 pb-1 w-8">
                    {String(easting).padStart(2, '0')}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, rowIdx) => {
              const northing = endNorthing - rowIdx; // top row = highest northing
              return (
                <tr key={rowIdx}>
                  <td className="text-right text-xs font-mono text-indigo-400 pr-1">
                    {String(northing).padStart(2, '0')}
                  </td>
                  {Array.from({ length: cols }, (_, colIdx) => {
                    const easting = startEasting + colIdx;

                    const isClicked = clicked?.easting === easting && clicked?.northing === northing;
                    const isTarget = targetEasting === easting && targetNorthing === northing;
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
                      <td
                        key={colIdx}
                        onClick={() => handleCellClick(easting, northing)}
                        className={`w-8 h-8 text-center text-xs cursor-pointer border border-green-900/30 transition-all ${cellBg}`}
                      >
                        {content}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Selected feedback */}
      {clicked && !submitted && (
        <div className="flex items-center justify-between mt-2">
          <p className="text-gray-400 font-mono text-xs">
            Selected:{' '}
            <span className="text-yellow-400 font-bold">
              {formatGridRef(clicked.easting, clicked.northing)}
            </span>
          </p>
          <button
            onClick={handleSubmit}
            className="bg-yellow-600 hover:bg-yellow-500 text-white font-mono text-sm px-4 py-2 rounded-lg transition-colors"
          >
            CONFIRM
          </button>
        </div>
      )}

      {/* Result */}
      {submitted && (
        <div className="mt-2">
          <p className={`font-mono text-sm ${wasCorrect ? 'text-green-400' : 'text-red-400'}`}>
            {wasCorrect
              ? '✅ Correct grid square!'
              : `❌ Wrong! The correct square was ${gridData.gridLabel || formatGridRef(targetEasting, targetNorthing)} (highlighted green above)`}
          </p>
        </div>
      )}
    </div>
  );
}
