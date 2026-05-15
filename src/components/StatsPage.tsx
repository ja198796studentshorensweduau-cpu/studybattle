import { useState } from 'react';
import { SaveData, QuestionRecord } from '../hooks/useGameState';
import { getQuestions, getCategoryNames, Question } from '../data/questions';

interface StatsPageProps {
  gameData: SaveData;
  onBack: () => void;
  onStudyMode: () => void;
}

type TabType = 'overview' | 'categories' | 'weak_areas' | 'history';

interface CategoryStat {
  category: string;
  name: string;
  correct: number;
  wrong: number;
  total: number;
  accuracy: number;
  wrongQuestions: Question[];
}

function grade(accuracy: number): { g: string; color: string } {
  if (accuracy >= 90) return { g: '🌟 A+', color: 'text-yellow-400' };
  if (accuracy >= 80) return { g: '✅ A', color: 'text-green-400' };
  if (accuracy >= 70) return { g: '👍 B', color: 'text-blue-400' };
  if (accuracy >= 60) return { g: '📘 C', color: 'text-indigo-400' };
  if (accuracy >= 50) return { g: '📙 D', color: 'text-orange-400' };
  return { g: '📕 F', color: 'text-red-400' };
}

export default function StatsPage({ gameData, onBack, onStudyMode }: StatsPageProps) {
  const [tab, setTab] = useState<TabType>('overview');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const questions = getQuestions();
  const categoryNames = getCategoryNames();

  const totalAnswered = gameData.questionsAnswered.length;
  const totalCorrect = gameData.questionsAnswered.filter((q) => q.correct).length;
  const totalWrong = totalAnswered - totalCorrect;
  const overallAccuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  // Build category stats
  const catMap = new Map<string, { correct: number; wrong: number; wrongIds: string[] }>();
  for (const record of gameData.questionsAnswered) {
    const cat = record.category;
    if (!catMap.has(cat)) catMap.set(cat, { correct: 0, wrong: 0, wrongIds: [] });
    const entry = catMap.get(cat)!;
    if (record.correct) entry.correct++;
    else {
      entry.wrong++;
      entry.wrongIds.push(record.questionId);
    }
  }

  // Also include categories with no attempts
  const allCats = new Set([...catMap.keys(), ...Object.keys(categoryNames)]);

  const categoryStats: CategoryStat[] = [];
  const notAttempted: CategoryStat[] = [];

  for (const cat of allCats) {
    const entry = catMap.get(cat);
    const total = entry ? entry.correct + entry.wrong : 0;
    const accuracy = total > 0 ? Math.round((entry!.correct / total) * 100) : -1;
    const wrongQuestions = entry
      ? [...new Set(entry.wrongIds)].map((id) => questions.find((q) => q.id === id)).filter(Boolean) as Question[]
      : [];
    const name = categoryNames[cat] || cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    const stat: CategoryStat = {
      category: cat,
      name,
      correct: entry?.correct || 0,
      wrong: entry?.wrong || 0,
      total,
      accuracy,
      wrongQuestions,
    };

    if (total === 0) notAttempted.push(stat);
    else categoryStats.push(stat);
  }

  categoryStats.sort((a, b) => a.accuracy - b.accuracy);

  const weakAreas = categoryStats.filter((s) => s.accuracy < 70 && s.total >= 2);
  const strongAreas = categoryStats.filter((s) => s.accuracy >= 70);

  const allRecords = gameData.questionsAnswered;

  const displayName = (cat: string) =>
    categoryNames[cat] || cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const tabs: { key: TabType; label: string }[] = [
    { key: 'overview', label: '📊 Overview' },
    { key: 'categories', label: '📁 Categories' },
    { key: 'weak_areas', label: '🎯 Focus' },
    { key: 'history', label: '📜 History' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900">
      {/* Top bar */}
      <div className="bg-gray-900/80 border-b-2 border-indigo-700 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button onClick={onBack} className="text-gray-400 hover:text-white font-mono text-sm transition-colors">← Back</button>
          <h1 className="text-indigo-300 font-mono font-bold">STATS</h1>
          <div></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-gray-900/60 border-b border-gray-700 px-2">
        <div className="max-w-lg mx-auto flex">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`flex-1 py-2 text-center font-mono text-xs transition-colors ${tab === t.key ? 'text-indigo-300 border-b-2 border-indigo-400' : 'text-gray-500 hover:text-gray-400'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Study Mode Banner */}
      <div className="max-w-lg mx-auto px-4 pt-4">
        <button onClick={onStudyMode} className="w-full bg-gradient-to-r from-emerald-800 to-emerald-700 hover:from-emerald-700 hover:to-emerald-600 text-white font-mono py-3 rounded-xl text-sm font-bold border border-emerald-600 shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2">
          <span className="text-lg">📝</span> SERIOUS STUDY MODE
          <span className="text-emerald-400 text-xs ml-1">— Take a graded test</span>
        </button>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div className="space-y-4" style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <div className="bg-gray-800/80 border-2 border-indigo-600 rounded-2xl p-6 text-center">
              {totalAnswered > 0 ? (
                <>
                  <div className={`text-5xl mb-2 ${grade(overallAccuracy).color}`}>{grade(overallAccuracy).g}</div>
                  <div className="text-gray-400 font-mono text-sm">Overall Grade</div>
                  <div className="text-white font-mono text-3xl font-bold mt-1">{overallAccuracy}%</div>
                </>
              ) : (
                <>
                  <div className="text-5xl mb-2">🤔</div>
                  <div className="text-gray-400 font-mono text-sm">No questions answered yet! Start a battle to begin.</div>
                </>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-3 text-center">
                <div className="text-green-400 font-mono text-2xl font-bold">{totalCorrect}</div>
                <div className="text-gray-400 font-mono text-xs">Correct</div>
              </div>
              <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-3 text-center">
                <div className="text-red-400 font-mono text-2xl font-bold">{totalWrong}</div>
                <div className="text-gray-400 font-mono text-xs">Wrong</div>
              </div>
              <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-3 text-center">
                <div className="text-yellow-400 font-mono text-2xl font-bold">{gameData.bestStreak}</div>
                <div className="text-gray-400 font-mono text-xs">Best Streak</div>
              </div>
              <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-3 text-center">
                <div className="text-blue-400 font-mono text-2xl font-bold">{gameData.battlesWon}/{gameData.battlesWon + gameData.battlesLost}</div>
                <div className="text-gray-400 font-mono text-xs">Battles Won</div>
              </div>
            </div>
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 flex items-center gap-3">
              <span className="text-3xl">{gameData.activeMon.emoji}</span>
              <div>
                <div className="text-white font-mono font-bold">{gameData.activeMon.name}</div>
                <div className="text-gray-400 font-mono text-xs">Level {gameData.level}</div>
                <div className="text-gray-500 font-mono text-xs">Total XP earned: {gameData.totalXp.toLocaleString()}</div>
                {gameData.party.length > 0 && <div className="text-gray-500 font-mono text-xs">Party: {gameData.party.length} reserve</div>}
              </div>
            </div>
          </div>
        )}

        {/* CATEGORIES */}
        {tab === 'categories' && (
          <div className="space-y-3" style={{ animation: 'fadeIn 0.3s ease-out' }}>
            {categoryStats.length === 0 && <p className="text-gray-500 font-mono text-sm text-center">No categories yet.</p>}
            {categoryStats.map((stat) => (
              <div key={stat.category} className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">
                <button onClick={() => setExpandedCategory(expandedCategory === stat.category ? null : stat.category)} className="w-full p-4 text-left">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white font-mono text-sm font-bold">{stat.name}</span>
                    <span className={`font-mono text-sm font-bold ${grade(stat.accuracy).color}`}>{stat.accuracy}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${stat.accuracy >= 70 ? 'bg-green-500' : stat.accuracy >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${stat.accuracy}%` }} />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-gray-500 font-mono text-xs">✅ {stat.correct} | ❌ {stat.wrong}</span>
                    <span className="text-gray-500 font-mono text-xs">{stat.total} answered</span>
                  </div>
                </button>
                {expandedCategory === stat.category && stat.wrongQuestions.length > 0 && (
                  <div className="border-t border-gray-700 p-3 bg-gray-900/40 space-y-2">
                    <p className="text-red-400 font-mono text-xs font-bold">❌ Questions to review:</p>
                    {stat.wrongQuestions.map((q) => (
                      <div key={q.id} className="bg-gray-800/60 rounded-lg p-2">
                        <p className="text-white font-mono text-xs">{q.question}</p>
                        <p className="text-green-400 font-mono text-xs mt-1">✅ Answer: {q.answer}</p>
                        {q.explanation && <p className="text-gray-500 font-mono text-xs italic">{q.explanation}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* WEAK AREAS */}
        {tab === 'weak_areas' && (
          <div className="space-y-4" style={{ animation: 'fadeIn 0.3s ease-out' }}>
            {weakAreas.length > 0 ? (
              <>
                <div className="bg-red-900/20 border border-red-800 rounded-xl p-4">
                  <h3 className="text-red-400 font-mono font-bold text-sm">🎯 Areas to Focus On</h3>
                  <p className="text-gray-400 font-mono text-xs mt-1">These topics need more practice. Keep battling!</p>
                </div>
                {weakAreas.map((stat) => (
                  <div key={stat.category} className="bg-gray-800/60 border border-red-800/40 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-mono text-sm font-bold">{stat.name}</span>
                      <span className="text-red-400 font-mono text-sm font-bold">{stat.accuracy}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden mb-2">
                      <div className="h-full rounded-full bg-red-500 transition-all duration-500" style={{ width: `${stat.accuracy}%` }} />
                    </div>
                    {stat.wrongQuestions.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-gray-500 font-mono text-xs">Review these:</p>
                        {stat.wrongQuestions.slice(0, 3).map((q) => (
                          <div key={q.id} className="bg-gray-900/40 rounded p-2">
                            <p className="text-white font-mono text-xs">{q.question}</p>
                            <p className="text-green-400 font-mono text-xs">Answer: {q.answer}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </>
            ) : totalAnswered > 0 ? (
              <div className="bg-green-900/20 border border-green-800 rounded-xl p-6 text-center">
                <div className="text-4xl mb-2">🎉</div>
                <h3 className="text-green-400 font-mono font-bold">Great Job!</h3>
                <p className="text-gray-400 font-mono text-xs mt-1">No weak areas! You're scoring above 70% everywhere.</p>
              </div>
            ) : (
              <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-6 text-center">
                <div className="text-4xl mb-2">🤷</div>
                <p className="text-gray-400 font-mono text-sm">Start battling to discover your weak areas!</p>
              </div>
            )}

            {strongAreas.length > 0 && (
              <>
                <div className="bg-green-900/20 border border-green-800 rounded-xl p-4">
                  <h3 className="text-green-400 font-mono font-bold text-sm">✅ Strong Areas</h3>
                  <p className="text-gray-400 font-mono text-xs mt-1">You know these well. Keep it up!</p>
                </div>
                {strongAreas.map((stat) => (
                  <div key={stat.category} className="bg-gray-800/60 border border-green-800/30 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white font-mono text-sm">{stat.name}</span>
                      <span className="text-green-400 font-mono text-sm font-bold">{stat.accuracy}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div className="h-full rounded-full bg-green-500 transition-all duration-500" style={{ width: `${stat.accuracy}%` }} />
                    </div>
                  </div>
                ))}
              </>
            )}

            {notAttempted.length > 0 && (
              <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-4">
                <p className="text-gray-400 font-mono text-xs font-bold mb-2">📝 Not Yet Attempted</p>
                <div className="flex flex-wrap gap-2">
                  {notAttempted.map((stat) => (
                    <span key={stat.category} className="bg-gray-700/60 text-gray-400 font-mono text-xs px-2 py-1 rounded">{stat.name}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* HISTORY */}
        {tab === 'history' && (
          <div className="space-y-2" style={{ animation: 'fadeIn 0.3s ease-out' }}>
            {allRecords.length > 0 ? (
              <>
                <p className="text-gray-500 font-mono text-xs">Last {Math.min(50, allRecords.length)} answers:</p>
                {allRecords.slice(-50).reverse().map((record: QuestionRecord, i: number) => {
                  const q = questions.find((qq: Question) => qq.id === record.questionId);
                  return (
                    <div key={i} className="bg-gray-800/60 border border-gray-700 rounded-lg p-3 flex items-start gap-2">
                      <span className="text-sm mt-0.5">{record.correct ? '✅' : '❌'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-mono text-xs truncate">{q?.question || 'Question #' + record.questionId}</p>
                        <p className="text-gray-500 font-mono text-xs">
                          {displayName(record.category)}
                          {!record.correct && q && <span className="text-green-400"> → {q.answer}</span>}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </>
            ) : (
              <div className="text-center py-8">
                <div className="text-3xl mb-2">📝</div>
                <p className="text-gray-500 font-mono text-sm">No history yet. Start battling!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
