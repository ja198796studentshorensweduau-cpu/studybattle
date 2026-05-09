import { useState } from 'react';
import { SaveData, QuestionRecord } from '../hooks/useGameState';
import { getCategoryNames, getQuestions, Question } from '../data/questions';

interface StatsPageProps {
  gameData: SaveData;
  onBack: () => void;
}

type TabView = 'overview' | 'categories' | 'weak_areas' | 'history';

export default function StatsPage({ gameData, onBack }: StatsPageProps) {
  const [tab, setTab] = useState<TabView>('overview');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const categoryNames = getCategoryNames();
  const questions = getQuestions();

  const allRecords = gameData.questionsAnswered;
  const totalCorrect = allRecords.filter((r) => r.correct).length;
  const totalWrong = allRecords.filter((r) => !r.correct).length;
  const totalAnswered = allRecords.length;
  const overallAccuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  // Build the list of all categories: from loaded questions + from answer history
  const allCats = new Set<string>();
  Object.keys(categoryNames).forEach((c) => allCats.add(c));
  allRecords.forEach((r) => allCats.add(r.category));

  const displayName = (cat: string) =>
    categoryNames[cat] || cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const categoryStats = Array.from(allCats).map((cat) => {
    const catRecords = allRecords.filter((r) => r.category === cat);
    const correct = catRecords.filter((r) => r.correct).length;
    const total = catRecords.length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : -1;

    const attemptedIds = new Set(catRecords.map((r) => r.questionId));
    const totalQuestionsInCat = questions.filter((q: Question) => q.category === cat).length;

    const questionResults: Record<string, boolean> = {};
    catRecords.forEach((r) => { questionResults[r.questionId] = r.correct; });
    const wrongQuestions = Object.entries(questionResults)
      .filter(([, c]) => !c)
      .map(([id]) => questions.find((q: Question) => q.id === id))
      .filter((q): q is Question => !!q);

    return { category: cat, name: displayName(cat), correct, total, accuracy, attemptedIds, totalQuestionsInCat, wrongQuestions };
  });

  const weakAreas = categoryStats.filter((s) => s.total > 0 && s.accuracy < 70).sort((a, b) => a.accuracy - b.accuracy);
  const strongAreas = categoryStats.filter((s) => s.total > 0 && s.accuracy >= 70).sort((a, b) => b.accuracy - a.accuracy);
  const notAttempted = categoryStats.filter((s) => s.total === 0);

  const accColor = (a: number) => a >= 80 ? 'text-green-400' : a >= 60 ? 'text-yellow-400' : a >= 40 ? 'text-orange-400' : 'text-red-400';
  const accBg = (a: number) => a >= 80 ? 'bg-green-500' : a >= 60 ? 'bg-yellow-500' : a >= 40 ? 'bg-orange-500' : 'bg-red-500';
  const grade = (a: number) => {
    if (a >= 90) return { g: 'A+', c: 'text-green-300' };
    if (a >= 80) return { g: 'A', c: 'text-green-400' };
    if (a >= 70) return { g: 'B', c: 'text-emerald-400' };
    if (a >= 60) return { g: 'C', c: 'text-yellow-400' };
    if (a >= 50) return { g: 'D', c: 'text-orange-400' };
    return { g: 'F', c: 'text-red-400' };
  };

  const tabs: { key: TabView; label: string; emoji: string }[] = [
    { key: 'overview', label: 'Overview', emoji: '📊' },
    { key: 'categories', label: 'Topics', emoji: '📚' },
    { key: 'weak_areas', label: 'Focus', emoji: '🎯' },
    { key: 'history', label: 'History', emoji: '📜' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900">
      {/* Header */}
      <div className="bg-gray-900/80 border-b-2 border-indigo-700 px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <button onClick={onBack} className="text-indigo-400 hover:text-indigo-300 font-mono text-sm transition-colors">← Back</button>
          <h1 className="text-white font-mono font-bold">📊 Study Stats</h1>
          <div className="text-gray-400 font-mono text-xs">Lv.{gameData.level}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-gray-800/50 border-b border-gray-700">
        <div className="flex max-w-2xl mx-auto">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`flex-1 py-3 font-mono text-xs sm:text-sm transition-colors ${tab === t.key ? 'text-indigo-300 border-b-2 border-indigo-400 bg-indigo-900/20' : 'text-gray-500 hover:text-gray-300'}`}>
              <span className="mr-1">{t.emoji}</span>{t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div className="space-y-4">
            <div className="bg-gray-800/60 border-2 border-indigo-700 rounded-2xl p-6 text-center">
              {totalAnswered > 0 ? (
                <>
                  <div className={`text-6xl font-mono font-black ${grade(overallAccuracy).c}`}>{grade(overallAccuracy).g}</div>
                  <div className="text-gray-400 font-mono text-sm mt-2">Overall Grade</div>
                  <div className={`text-3xl font-mono font-bold mt-1 ${accColor(overallAccuracy)}`}>{overallAccuracy}%</div>
                </>
              ) : (
                <div className="text-gray-500 font-mono"><div className="text-4xl mb-2">🤔</div>No questions answered yet! Start a battle to begin.</div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 text-center"><div className="text-green-400 font-mono text-3xl font-bold">{totalCorrect}</div><div className="text-gray-400 font-mono text-xs mt-1">Correct</div></div>
              <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 text-center"><div className="text-red-400 font-mono text-3xl font-bold">{totalWrong}</div><div className="text-gray-400 font-mono text-xs mt-1">Wrong</div></div>
              <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 text-center"><div className="text-yellow-400 font-mono text-3xl font-bold">{gameData.bestStreak}</div><div className="text-gray-400 font-mono text-xs mt-1">Best Streak</div></div>
              <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 text-center"><div className="text-blue-400 font-mono text-3xl font-bold">{gameData.battlesWon}/{gameData.battlesWon + gameData.battlesLost}</div><div className="text-gray-400 font-mono text-xs mt-1">Battles Won</div></div>
            </div>
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-4">
                <span className="text-5xl">{gameData.activeMon.emoji}</span>
                <div className="flex-1">
                  <div className="text-white font-mono font-bold">{gameData.activeMon.name}</div>
                  <div className="text-indigo-400 font-mono text-sm">Level {gameData.level}</div>
                  <div className="text-gray-400 font-mono text-xs mt-1">Total XP earned: {gameData.totalXp.toLocaleString()}</div>
                  {gameData.party.length > 0 && <div className="text-purple-400 font-mono text-xs">Party: {gameData.party.length} reserve</div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CATEGORIES */}
        {tab === 'categories' && (
          <div className="space-y-2">
            {categoryStats.length === 0 && <p className="text-gray-500 font-mono text-center py-8">No categories yet.</p>}
            {categoryStats.map((stat) => (
              <div key={stat.category}>
                <button onClick={() => setExpandedCategory(expandedCategory === stat.category ? null : stat.category)} className="w-full bg-gray-800/60 border border-gray-700 hover:border-indigo-600 rounded-xl p-4 text-left transition-all">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white font-mono text-sm font-bold">{stat.name}</div>
                      <div className="text-gray-400 font-mono text-xs mt-0.5">{stat.total > 0 ? `${stat.correct}/${stat.total} correct • ${stat.attemptedIds.size}/${stat.totalQuestionsInCat} questions seen` : 'Not attempted yet'}</div>
                    </div>
                    <div className="text-right">
                      {stat.accuracy >= 0 ? (<><div className={`font-mono font-bold text-lg ${accColor(stat.accuracy)}`}>{stat.accuracy}%</div><div className={`font-mono text-xs ${grade(stat.accuracy).c}`}>{grade(stat.accuracy).g}</div></>) : (<div className="text-gray-600 font-mono text-sm">—</div>)}
                    </div>
                  </div>
                  {stat.total > 0 && <div className="mt-2 w-full bg-gray-700 rounded-full h-2 overflow-hidden"><div className={`h-full rounded-full transition-all duration-500 ${accBg(stat.accuracy)}`} style={{ width: `${stat.accuracy}%` }} /></div>}
                </button>
                {expandedCategory === stat.category && stat.wrongQuestions.length > 0 && (
                  <div className="ml-4 mt-1 mb-2 bg-red-900/20 border-l-2 border-red-500 rounded-r-xl p-3 space-y-2">
                    <div className="text-red-400 font-mono text-xs font-bold">❌ Questions to review:</div>
                    {stat.wrongQuestions.map((q) => (
                      <div key={q.id} className="bg-gray-800/50 rounded-lg p-3">
                        <p className="text-gray-300 font-mono text-xs">{q.question}</p>
                        <p className="text-green-400 font-mono text-xs mt-1">✅ Answer: {q.answer}</p>
                        {q.explanation && <p className="text-gray-500 font-mono text-xs mt-1">{q.explanation}</p>}
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
          <div className="space-y-4">
            {weakAreas.length > 0 ? (
              <>
                <div className="bg-red-900/20 border-2 border-red-700 rounded-xl p-4">
                  <h3 className="text-red-400 font-mono font-bold text-sm mb-1">🎯 Areas to Focus On</h3>
                  <p className="text-gray-400 font-mono text-xs">These topics need more practice. Keep battling!</p>
                </div>
                {weakAreas.map((stat) => (
                  <div key={stat.category} className="bg-gray-800/60 border-2 border-red-700/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-mono text-sm font-bold">{stat.name}</span>
                      <span className={`font-mono font-bold ${accColor(stat.accuracy)}`}>{stat.accuracy}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden mb-3"><div className={`h-full rounded-full ${accBg(stat.accuracy)}`} style={{ width: `${stat.accuracy}%` }} /></div>
                    {stat.wrongQuestions.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-gray-400 font-mono text-xs">Review these:</div>
                        {stat.wrongQuestions.slice(0, 3).map((q) => (
                          <div key={q.id} className="bg-gray-900/50 rounded-lg p-3">
                            <p className="text-gray-300 font-mono text-xs">{q.question}</p>
                            <p className="text-green-400 font-mono text-xs mt-1">Answer: {q.answer}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </>
            ) : totalAnswered > 0 ? (
              <div className="bg-green-900/20 border-2 border-green-700 rounded-xl p-6 text-center">
                <div className="text-4xl mb-3">🎉</div>
                <h3 className="text-green-400 font-mono font-bold text-lg">Great Job!</h3>
                <p className="text-gray-400 font-mono text-sm mt-2">No weak areas! You're scoring above 70% everywhere.</p>
              </div>
            ) : (
              <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-6 text-center">
                <div className="text-4xl mb-3">🤷</div>
                <p className="text-gray-400 font-mono text-sm">Start battling to discover your weak areas!</p>
              </div>
            )}

            {strongAreas.length > 0 && (
              <>
                <div className="bg-green-900/20 border-2 border-green-700 rounded-xl p-4">
                  <h3 className="text-green-400 font-mono font-bold text-sm mb-1">✅ Strong Areas</h3>
                  <p className="text-gray-400 font-mono text-xs">You know these well. Keep it up!</p>
                </div>
                {strongAreas.map((stat) => (
                  <div key={stat.category} className="bg-gray-800/40 border border-green-700/30 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-mono text-sm">{stat.name}</span>
                      <span className={`font-mono font-bold ${accColor(stat.accuracy)}`}>{stat.accuracy}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden mt-2"><div className={`h-full rounded-full ${accBg(stat.accuracy)}`} style={{ width: `${stat.accuracy}%` }} /></div>
                  </div>
                ))}
              </>
            )}

            {notAttempted.length > 0 && (
              <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-4">
                <h3 className="text-gray-400 font-mono font-bold text-sm mb-1">📝 Not Yet Attempted</h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  {notAttempted.map((stat) => (
                    <span key={stat.category} className="bg-gray-700/50 text-gray-400 font-mono text-xs px-3 py-1 rounded-lg">{stat.name}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* HISTORY */}
        {tab === 'history' && (
          <div className="space-y-2">
            {allRecords.length > 0 ? (
              <>
                <div className="text-gray-400 font-mono text-xs mb-2">Last {Math.min(50, allRecords.length)} answers:</div>
                {allRecords.slice(-50).reverse().map((record: QuestionRecord, i: number) => {
                  const q = questions.find((qq: Question) => qq.id === record.questionId);
                  return (
                    <div key={i} className={`bg-gray-800/50 border rounded-lg p-3 ${record.correct ? 'border-green-700/40' : 'border-red-700/40'}`}>
                      <div className="flex items-start gap-2">
                        <span className="text-lg mt-0.5">{record.correct ? '✅' : '❌'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-mono text-xs truncate">{q?.question || 'Question #' + record.questionId}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-gray-500 font-mono text-xs">{displayName(record.category)}</span>
                            {!record.correct && q && <span className="text-green-400/70 font-mono text-xs">→ {q.answer}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            ) : (
              <div className="text-center py-12"><div className="text-4xl mb-3">📝</div><p className="text-gray-400 font-mono text-sm">No history yet. Start battling!</p></div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
