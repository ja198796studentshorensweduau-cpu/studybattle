import { useState, useMemo, useRef } from 'react';
import { getQuestions, getCategoryNames, Question } from '../data/questions';
import { markExtendedResponse, MarkingResult, isHfApiKeySet, getLastApiError } from '../utils/hfApi';
import GridClickQuestion from './GridClickQuestion';

interface StudyModeProps {
  onBack: () => void;
  onRecordAnswer: (questionId: string, category: string, correct: boolean) => void;
}

interface TestAnswer {
  question: Question;
  userAnswer: string;
  correct: boolean;
  /** For extended_response questions — AI/fallback marking result */
  extendedResult?: MarkingResult;
  /** Partial credit score for extended response (0-1) */
  partialScore?: number;
}

type TestPhase = 'config' | 'testing' | 'awaiting_extended' | 'results';

function getEvenSplitQuestions(count: number, selectedCategories: string[]): Question[] {
  const questions = getQuestions();
  const categories = selectedCategories.length > 0 ? selectedCategories : [...new Set(questions.map(q => q.category))];
  const perCategory = Math.max(1, Math.floor(count / categories.length));
  const remainder = count - perCategory * categories.length;
  const selected: Question[] = [];
  const categoryPools = new Map<string, Question[]>();

  for (const cat of categories) {
    const pool = questions.filter(q => q.category === cat);
    categoryPools.set(cat, [...pool].sort(() => Math.random() - 0.5));
  }
  for (const cat of categories) {
    const pool = categoryPools.get(cat) || [];
    selected.push(...pool.slice(0, Math.min(perCategory, pool.length)));
  }
  if (remainder > 0) {
    const allRemaining: Question[] = [];
    for (const cat of categories) {
      const pool = categoryPools.get(cat) || [];
      allRemaining.push(...pool.slice(Math.min(perCategory, pool.length)));
    }
    selected.push(...allRemaining.sort(() => Math.random() - 0.5).slice(0, Math.max(0, remainder)));
  }
  if (selected.length < count) {
    const usedIds = new Set(selected.map(q => q.id));
    const unused = questions.filter(q => !usedIds.has(q.id)).sort(() => Math.random() - 0.5);
    selected.push(...unused.slice(0, count - selected.length));
  }
  return selected.sort(() => Math.random() - 0.5).slice(0, count);
}

function gradeTest(percent: number): { grade: string; color: string; emoji: string } {
  if (percent >= 95) return { grade: 'A+', color: 'text-yellow-400', emoji: '🌟' };
  if (percent >= 85) return { grade: 'A', color: 'text-green-400', emoji: '✅' };
  if (percent >= 75) return { grade: 'B', color: 'text-blue-400', emoji: '👍' };
  if (percent >= 65) return { grade: 'C', color: 'text-indigo-400', emoji: '📘' };
  if (percent >= 55) return { grade: 'D', color: 'text-orange-400', emoji: '📙' };
  if (percent >= 45) return { grade: 'E', color: 'text-red-400', emoji: '📕' };
  return { grade: 'F', color: 'text-red-500', emoji: '❌' };
}

export default function StudyMode({ onBack, onRecordAnswer }: StudyModeProps) {
  const [phase, setPhase] = useState<TestPhase>('config');
  const [testLength, setTestLength] = useState(10);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [testQuestions, setTestQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<TestAnswer[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [extendedAnswer, setExtendedAnswer] = useState('');
  const [markingInProgress, setMarkingInProgress] = useState(false);
  const [currentExtendedResult, setCurrentExtendedResult] = useState<MarkingResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const allQuestions = getQuestions();
  const categoryNames = getCategoryNames();
  const allCategories = useMemo(() => [...new Set(allQuestions.map(q => q.category))], [allQuestions]);
  const maxQuestions = Math.min(50, allQuestions.length);

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

  const startTest = () => {
    setTestQuestions(getEvenSplitQuestions(testLength, selectedCategories));
    setCurrentIndex(0);
    setAnswers([]);
    setSelectedAnswer('');
    setExtendedAnswer('');
    setCurrentExtendedResult(null);
    setPhase('testing');
  };

  const advanceQuestion = () => {
    setSelectedAnswer('');
    setExtendedAnswer('');
    setCurrentExtendedResult(null);
    if (currentIndex < testQuestions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setPhase('testing');
    } else {
      setPhase('results');
    }
  };

  const submitStandardAnswer = (answer: string) => {
    const q = testQuestions[currentIndex];
    const correct = answer.toLowerCase().trim() === q.answer.toLowerCase().trim();
    onRecordAnswer(q.id, q.category, correct);
    setAnswers(prev => [...prev, { question: q, userAnswer: answer, correct }]);
    advanceQuestion();
  };

  const handleGridAnswer = (correct: boolean) => {
    const q = testQuestions[currentIndex];
    onRecordAnswer(q.id, q.category, correct);
    setAnswers(prev => [...prev, { question: q, userAnswer: correct ? q.answer : '(wrong grid square)', correct }]);
    // Short delay so the grid can show the result
    setTimeout(() => advanceQuestion(), 1800);
  };

  const submitExtendedAnswer = async () => {
    if (!extendedAnswer.trim() || markingInProgress) return;
    const q = testQuestions[currentIndex];
    const er = q.extendedResponse;
    if (!er) return;

    setMarkingInProgress(true);
    setPhase('awaiting_extended');

    const result = await markExtendedResponse(
      q.question, extendedAnswer.trim(), er.keyPoints, er.markingScheme, er.maxMarks,
    );
    setCurrentExtendedResult(result);
    setMarkingInProgress(false);

    const partialScore = result.score / er.maxMarks;
    const correct = partialScore >= 0.5;
    onRecordAnswer(q.id, q.category, correct);
    setAnswers(prev => [...prev, {
      question: q, userAnswer: extendedAnswer.trim(), correct,
      extendedResult: result, partialScore,
    }]);
  };

  const currentQ = testQuestions[currentIndex];

  // Scoring: extended responses contribute partial marks
  const totalScore = answers.reduce((sum, a) => {
    if (a.partialScore !== undefined) return sum + a.partialScore;
    return sum + (a.correct ? 1 : 0);
  }, 0);
  const percent = answers.length > 0 ? Math.round((totalScore / answers.length) * 100) : 0;

  // ═══════════ CONFIG ═══════════
  if (phase === 'config') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900">
        <div className="bg-gray-900/80 border-b-2 border-emerald-700 px-4 py-3">
          <div className="flex items-center justify-between max-w-lg mx-auto">
            <button onClick={onBack} className="text-gray-400 hover:text-white font-mono text-sm transition-colors">← Back</button>
            <h1 className="text-emerald-300 font-mono font-bold">📝 STUDY MODE</h1>
            <div></div>
          </div>
        </div>
        <div className="max-w-lg mx-auto p-4 space-y-6">
          <div className="bg-gray-800/80 border-2 border-emerald-600 rounded-2xl p-6 text-center">
            <div className="text-4xl mb-3">📝</div>
            <h2 className="text-white font-mono font-bold text-lg mb-1">Serious Study Test</h2>
            <p className="text-gray-400 font-mono text-xs">Graded test with full review. Extended response questions use {isHfApiKeySet() ? '🤖 AI marking' : '⚙️ keyword matching'}.</p>
          </div>
          <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
            <label className="text-white font-mono text-sm font-bold block mb-3">TEST LENGTH: {testLength} questions</label>
            <input type="range" min={5} max={maxQuestions} step={5} value={testLength} onChange={(e) => setTestLength(Number(e.target.value))} className="w-full accent-emerald-500" />
            <div className="flex justify-between text-gray-500 font-mono text-xs mt-1"><span>5</span><span>{Math.floor(maxQuestions / 2)}</span><span>{maxQuestions}</span></div>
          </div>
          <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
            <p className="text-white font-mono text-sm font-bold mb-2">CATEGORIES</p>
            <p className="text-gray-500 font-mono text-xs mb-3">Select specific categories or leave all unchecked for an even mix.</p>
            <div className="flex flex-wrap gap-2">
              {allCategories.map(cat => {
                const displayName = categoryNames[cat] || cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                const isSelected = selectedCategories.includes(cat);
                return (
                  <button key={cat} onClick={() => toggleCategory(cat)} className={`font-mono text-xs px-3 py-1.5 rounded-lg border transition-all ${isSelected ? 'bg-emerald-700 border-emerald-500 text-white' : 'bg-gray-700/60 border-gray-600 text-gray-400 hover:border-emerald-600'}`}>
                    {displayName}{isSelected && ' ✓'}
                  </button>
                );
              })}
            </div>
          </div>
          <button onClick={startTest} className="w-full bg-gradient-to-r from-emerald-700 to-emerald-600 hover:from-emerald-600 hover:to-emerald-500 text-white font-mono py-4 rounded-2xl text-lg font-bold border-2 border-emerald-500 shadow-lg active:scale-[0.98] transition-all">📝 START TEST</button>
        </div>
      </div>
    );
  }

  // ═══════════ TESTING / EXTENDED MARKING ═══════════
  if ((phase === 'testing' || phase === 'awaiting_extended') && currentQ) {
    const isExtended = currentQ.type === 'extended_response';
    const isGrid = currentQ.type === 'grid_click';

    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900">
        <div className="bg-gray-900/80 border-b-2 border-emerald-700 px-4 py-3">
          <div className="flex items-center justify-between max-w-lg mx-auto">
            <span className="text-gray-400 font-mono text-sm">Q {currentIndex + 1}/{testQuestions.length}</span>
            <h1 className="text-emerald-300 font-mono font-bold text-sm">STUDY TEST</h1>
            <span className="text-gray-400 font-mono text-xs">{Math.round((totalScore / Math.max(1, answers.length)) * 100)}%</span>
          </div>
        </div>
        <div className="max-w-lg mx-auto px-4 pt-4">
          <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden mb-6">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-300" style={{ width: `${(currentIndex / testQuestions.length) * 100}%` }} />
          </div>
        </div>

        <div className="max-w-lg mx-auto p-4 space-y-4">
          <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-900/40 text-emerald-400 uppercase tracking-wider">
                {currentQ.category.replace(/_/g, ' ')}
                {isExtended && ' — Extended'}
              </span>
              <span className="text-yellow-400 text-xs">{'⭐'.repeat(currentQ.difficulty)}</span>
            </div>

            {/* ── Grid click ── */}
            {isGrid ? (
              <div>
                <GridClickQuestion question={currentQ} onAnswer={handleGridAnswer} />
              </div>

            /* ── Extended response: awaiting result ── */
            ) : isExtended && phase === 'awaiting_extended' ? (
              <div className="space-y-4">
                <p className="text-white font-mono text-sm mb-2">{currentQ.question}</p>

                {markingInProgress ? (
                  <div className="text-center py-8">
                    <div className="text-4xl animate-spin mb-3">⏳</div>
                    <p className="text-gray-400 font-mono text-sm">Marking your answer...</p>
                  </div>
                ) : currentExtendedResult ? (
                  <div className="space-y-3" style={{ animation: 'fadeIn 0.4s ease-out' }}>
                    {/* Source badge */}
                    <div className="text-center">
                      <span className={`text-xs font-mono px-2 py-0.5 rounded ${currentExtendedResult.source === 'ai' ? 'bg-green-900/40 text-green-400' : 'bg-yellow-900/40 text-yellow-400'}`}>
                        {currentExtendedResult.source === 'ai' ? '🤖 AI Marked' : '⚙️ Keyword Matching'}
                      </span>
                    </div>

                    {/* Score */}
                    <div className={`text-center p-3 rounded-xl border ${currentExtendedResult.score >= currentExtendedResult.maxMarks * 0.7 ? 'bg-green-900/20 border-green-700' : currentExtendedResult.score >= currentExtendedResult.maxMarks * 0.5 ? 'bg-yellow-900/20 border-yellow-700' : 'bg-red-900/20 border-red-700'}`}>
                      <div className={`text-xl font-black font-mono ${currentExtendedResult.score >= currentExtendedResult.maxMarks * 0.7 ? 'text-green-400' : currentExtendedResult.score >= currentExtendedResult.maxMarks * 0.5 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {currentExtendedResult.score}/{currentExtendedResult.maxMarks} marks
                      </div>
                    </div>

                    {/* Feedback */}
                    <div className="bg-indigo-900/20 border border-indigo-700/40 rounded-lg p-3">
                      <p className="text-indigo-300 font-mono text-xs font-bold mb-1">🎓 Feedback:</p>
                      <p className="text-indigo-200/90 font-mono text-xs leading-relaxed">{currentExtendedResult.overallFeedback}</p>
                    </div>

                    {currentExtendedResult.whatWentWell.length > 0 && (
                      <div className="bg-green-900/20 border border-green-800/40 rounded-lg p-3">
                        <p className="text-green-400 font-mono text-xs font-bold mb-1">✅ What you did well:</p>
                        {currentExtendedResult.whatWentWell.map((p, i) => (
                          <p key={i} className="text-green-300/80 font-mono text-xs leading-relaxed ml-2">• {p}</p>
                        ))}
                      </div>
                    )}
                    {currentExtendedResult.whatToImprove.length > 0 && (
                      <div className="bg-amber-900/20 border border-amber-800/40 rounded-lg p-3">
                        <p className="text-amber-400 font-mono text-xs font-bold mb-1">💡 What to improve:</p>
                        {currentExtendedResult.whatToImprove.map((p, i) => (
                          <p key={i} className="text-amber-300/80 font-mono text-xs leading-relaxed ml-2">• {p}</p>
                        ))}
                      </div>
                    )}

                    {/* API error if fallback */}
                    {currentExtendedResult.source === 'fallback' && getLastApiError() && (
                      <details className="bg-red-900/10 border border-red-800/30 rounded-lg">
                        <summary className="text-red-400/60 font-mono text-xs cursor-pointer p-2">⚠️ Why wasn't AI used?</summary>
                        <p className="px-2 pb-2 text-red-400/50 font-mono text-[10px] break-all">{getLastApiError()}</p>
                      </details>
                    )}

                    <details className="bg-gray-800/40 border border-gray-700/50 rounded-lg">
                      <summary className="text-gray-500 font-mono text-xs cursor-pointer p-3 hover:text-gray-400">📖 Model answer</summary>
                      <div className="px-3 pb-3"><p className="text-gray-400 font-mono text-xs leading-relaxed">{currentQ.answer}</p></div>
                    </details>

                    <button onClick={advanceQuestion} className="w-full bg-emerald-700 hover:bg-emerald-600 text-white font-mono py-3 rounded-xl text-sm font-bold border border-emerald-500 transition-colors">
                      {currentIndex < testQuestions.length - 1 ? 'NEXT QUESTION →' : 'VIEW RESULTS'}
                    </button>
                  </div>
                ) : null}
              </div>

            /* ── Extended response: input ── */
            ) : isExtended ? (
              <div className="space-y-3">
                <p className="text-white font-mono text-sm mb-2">{currentQ.question}</p>
                <div className="bg-gray-800/40 border border-gray-700/50 rounded-lg p-2">
                  <p className="text-gray-500 font-mono text-xs">
                    📝 {currentQ.extendedResponse!.maxMarks} marks • {currentQ.extendedResponse!.keyPoints.length} key points
                    {isHfApiKeySet() ? ' • 🤖 AI marking' : ' • ⚙️ Keyword matching'}
                  </p>
                </div>
                <textarea
                  value={extendedAnswer}
                  onChange={(e) => setExtendedAnswer(e.target.value)}
                  placeholder="Write your answer here..."
                  rows={6}
                  className="w-full bg-gray-700 border-2 border-gray-600 focus:border-emerald-500 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none resize-none"
                  autoFocus
                />
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 font-mono text-xs">{extendedAnswer.length} chars</span>
                  <button
                    onClick={submitExtendedAnswer}
                    disabled={!extendedAnswer.trim()}
                    className={`font-mono text-sm px-6 py-2.5 rounded-lg font-bold ${extendedAnswer.trim() ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                  >
                    SUBMIT
                  </button>
                </div>
              </div>

            /* ── Standard question types ── */
            ) : (
              <div>
                <p className="text-white font-mono text-base mb-6">{currentQ.question}</p>
                {currentQ.type === 'multiple_choice' && currentQ.options ? (
                  <div className="space-y-2">
                    {currentQ.options.map((opt, i) => (
                      <button key={i} onClick={() => submitStandardAnswer(opt)} className="w-full text-left bg-gray-700/60 hover:bg-emerald-900/30 border border-gray-600 hover:border-emerald-500 rounded-lg px-4 py-3 text-white font-mono text-sm transition-colors">
                        <span className="text-emerald-400 font-bold mr-2">{String.fromCharCode(65 + i)}.</span>{opt}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input ref={inputRef} type="text" value={selectedAnswer} onChange={(e) => setSelectedAnswer(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && selectedAnswer.trim()) submitStandardAnswer(selectedAnswer.trim()); }} placeholder="Type your answer..." className="flex-1 bg-gray-700 border-2 border-gray-600 focus:border-emerald-500 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none" autoFocus />
                    <button onClick={() => { if (selectedAnswer.trim()) submitStandardAnswer(selectedAnswer.trim()); }} className="bg-emerald-600 hover:bg-emerald-500 px-6 rounded-lg font-mono text-sm transition-colors text-white font-bold">GO</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ═══════════ RESULTS ═══════════
  const gradeInfo = gradeTest(percent);
  const catBreakdown = new Map<string, { score: number; total: number }>();
  for (const a of answers) {
    const cat = a.question.category;
    if (!catBreakdown.has(cat)) catBreakdown.set(cat, { score: 0, total: 0 });
    const entry = catBreakdown.get(cat)!;
    entry.total++;
    entry.score += a.partialScore !== undefined ? a.partialScore : (a.correct ? 1 : 0);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900">
      <div className="bg-gray-900/80 border-b-2 border-emerald-700 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button onClick={onBack} className="text-gray-400 hover:text-white font-mono text-sm transition-colors">← Back</button>
          <h1 className="text-emerald-300 font-mono font-bold">TEST RESULTS</h1>
          <div></div>
        </div>
      </div>
      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Grade */}
        <div className="bg-gray-800/80 border-2 border-emerald-600 rounded-2xl p-6 text-center" style={{ animation: 'bounceIn 0.6s ease-out' }}>
          <div className="text-6xl mb-2">{gradeInfo.emoji}</div>
          <div className={`text-5xl font-black font-mono mb-1 ${gradeInfo.color}`}>{gradeInfo.grade}</div>
          <div className="text-white font-mono text-2xl font-bold">{percent}%</div>
          <div className="text-gray-400 font-mono text-sm mt-2">{Math.round(totalScore)} / {answers.length} marks</div>
        </div>

        {/* Category breakdown */}
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
          <h3 className="text-white font-mono text-sm font-bold mb-3">📊 Category Breakdown</h3>
          <div className="space-y-2">
            {[...catBreakdown.entries()].map(([cat, stats]) => {
              const catPercent = Math.round((stats.score / stats.total) * 100);
              const displayName = categoryNames[cat] || cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
              return (
                <div key={cat}>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-gray-300">{displayName}</span>
                    <span className={catPercent >= 70 ? 'text-green-400' : catPercent >= 50 ? 'text-yellow-400' : 'text-red-400'}>{catPercent}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
                    <div className={`h-full rounded-full ${catPercent >= 70 ? 'bg-green-500' : catPercent >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${catPercent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Full review */}
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
          <h3 className="text-white font-mono text-sm font-bold mb-3">📋 Full Review</h3>
          <div className="space-y-3">
            {answers.map((a, i) => (
              <div key={i} className={`rounded-lg p-3 border ${a.correct ? 'bg-green-900/20 border-green-800/40' : 'bg-red-900/20 border-red-800/40'}`}>
                <div className="flex items-start gap-2 mb-1">
                  <span className="text-sm mt-0.5">
                    {a.extendedResult
                      ? (a.partialScore! >= 0.7 ? '🌟' : a.partialScore! >= 0.5 ? '👍' : '📝')
                      : (a.correct ? '✅' : '❌')}
                  </span>
                  <div className="flex-1">
                    <p className="text-white font-mono text-xs mb-1"><span className="text-gray-500">Q{i + 1}.</span> {a.question.question}</p>

                    {/* Extended response review */}
                    {a.extendedResult ? (
                      <div className="space-y-1.5 mt-2">
                        <p className={`font-mono text-xs font-bold ${a.partialScore! >= 0.5 ? 'text-green-400' : 'text-red-400'}`}>
                          {a.extendedResult.score}/{a.extendedResult.maxMarks} marks
                          <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded ${a.extendedResult.source === 'ai' ? 'bg-green-900/40 text-green-400' : 'bg-yellow-900/40 text-yellow-400'}`}>
                            {a.extendedResult.source === 'ai' ? 'AI' : 'Keywords'}
                          </span>
                        </p>
                        <p className="text-indigo-300/80 font-mono text-xs">{a.extendedResult.overallFeedback}</p>
                        {a.extendedResult.whatWentWell.length > 0 && (
                          <div>{a.extendedResult.whatWentWell.map((p, j) => <p key={j} className="text-green-400/70 font-mono text-xs ml-1">✅ {p}</p>)}</div>
                        )}
                        {a.extendedResult.whatToImprove.length > 0 && (
                          <div>{a.extendedResult.whatToImprove.map((p, j) => <p key={j} className="text-amber-400/70 font-mono text-xs ml-1">💡 {p}</p>)}</div>
                        )}
                        <details className="mt-1">
                          <summary className="text-gray-600 font-mono text-[10px] cursor-pointer">Your answer / Model answer</summary>
                          <p className="text-gray-500 font-mono text-[10px] mt-1">You: {a.userAnswer}</p>
                          <p className="text-gray-500 font-mono text-[10px]">Model: {a.question.answer}</p>
                        </details>
                      </div>
                    ) : (
                      /* Standard question review */
                      <>
                        {!a.correct && (
                          <>
                            <p className="text-red-400 font-mono text-xs">Your answer: {a.userAnswer}</p>
                            <p className="text-green-400 font-mono text-xs">Correct: {a.question.answer}</p>
                          </>
                        )}
                        {a.correct && <p className="text-green-400 font-mono text-xs">✓ {a.userAnswer}</p>}
                        {a.question.explanation && <p className="text-gray-500 font-mono text-xs italic mt-1">💡 {a.question.explanation}</p>}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button onClick={startTest} className="w-full bg-emerald-700 hover:bg-emerald-600 text-white font-mono py-3 rounded-xl text-sm font-bold border border-emerald-500 transition-colors">🔄 RETAKE TEST</button>
          <button onClick={() => setPhase('config')} className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-mono py-3 rounded-xl text-sm border border-gray-600 transition-colors">⚙️ NEW TEST SETTINGS</button>
          <button onClick={onBack} className="w-full bg-gray-800/60 hover:bg-gray-700/60 text-gray-400 font-mono py-3 rounded-xl text-sm border border-gray-700 transition-colors">← BACK TO STATS</button>
        </div>
      </div>
    </div>
  );
}
