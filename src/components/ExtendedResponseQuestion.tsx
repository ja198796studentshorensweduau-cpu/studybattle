import { useState } from 'react';
import { Question } from '../data/questions';
import { markExtendedResponse, MarkingResult, isHfApiKeySet, getLastApiError } from '../utils/hfApi';

interface ExtendedResponseQuestionProps {
  question: Question;
  onAnswer: (correct: boolean, damageMultiplier: number) => void;
}

export default function ExtendedResponseQuestion({ question, onAnswer }: ExtendedResponseQuestionProps) {
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<MarkingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const er = question.extendedResponse;
  if (!er) return null;

  const handleSubmit = async () => {
    if (!answer.trim() || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const markResult = await markExtendedResponse(
        question.question,
        answer.trim(),
        er.keyPoints,
        er.markingScheme,
        er.maxMarks,
      );
      setResult(markResult);

      const percent = (markResult.score / er.maxMarks) * 100;
      const isCorrect = percent >= 50;
      const multiplier = (markResult.score / er.maxMarks) * 2;

      setTimeout(() => {
        onAnswer(isCorrect, multiplier);
      }, 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setSubmitting(false);
    }
  };

  const apiAvailable = isHfApiKeySet();

  // ── Result view ──
  if (result) {
    const percent = Math.round((result.score / er.maxMarks) * 100);
    const isGood = percent >= 70;
    const isOk = percent >= 50;
    const apiError = result.source === 'fallback' ? getLastApiError() : '';

    return (
      <div className="space-y-3" style={{ animation: 'fadeIn 0.4s ease-out' }}>
        {/* Source badge */}
        <div className="text-center">
          <span className={`text-xs font-mono px-2 py-0.5 rounded ${result.source === 'ai' ? 'bg-green-900/40 text-green-400' : 'bg-yellow-900/40 text-yellow-400'}`}>
            {result.source === 'ai' ? '🤖 AI Marked' : '⚙️ Keyword Matching (offline)'}
          </span>
        </div>

        {/* Score banner */}
        <div className={`text-center p-4 rounded-xl border-2 ${isGood ? 'bg-green-900/30 border-green-600' : isOk ? 'bg-yellow-900/30 border-yellow-600' : 'bg-red-900/30 border-red-600'}`}>
          <div className="text-3xl mb-1">{isGood ? '🌟' : isOk ? '👍' : '📝'}</div>
          <div className={`text-2xl font-black font-mono ${isGood ? 'text-green-400' : isOk ? 'text-yellow-400' : 'text-red-400'}`}>
            {result.score}/{er.maxMarks} marks ({percent}%)
          </div>
          <p className={`text-sm font-mono mt-1 ${isGood ? 'text-green-300' : isOk ? 'text-yellow-300' : 'text-red-300'}`}>
            {isGood ? 'Strong answer!' : isOk ? 'Decent — your attack lands!' : 'Needs work — the enemy strikes back!'}
          </p>
          <p className="text-xs font-mono text-gray-500 mt-1">
            Damage: {(result.score / er.maxMarks * 2).toFixed(1)}x multiplier
          </p>
        </div>

        {/* Overall teacher feedback */}
        <div className="bg-indigo-900/20 border border-indigo-700/40 rounded-lg p-3">
          <p className="text-indigo-300 font-mono text-xs font-bold mb-1">🎓 Feedback:</p>
          <p className="text-indigo-200/90 font-mono text-xs leading-relaxed">{result.overallFeedback}</p>
        </div>

        {/* What you did well */}
        {result.whatWentWell.length > 0 && (
          <div className="bg-green-900/20 border border-green-800/40 rounded-lg p-3">
            <p className="text-green-400 font-mono text-xs font-bold mb-1.5">✅ What you did well:</p>
            <div className="space-y-1.5">
              {result.whatWentWell.map((point, i) => (
                <p key={i} className="text-green-300/80 font-mono text-xs leading-relaxed ml-2">• {point}</p>
              ))}
            </div>
          </div>
        )}

        {/* What to improve */}
        {result.whatToImprove.length > 0 && (
          <div className="bg-amber-900/20 border border-amber-800/40 rounded-lg p-3">
            <p className="text-amber-400 font-mono text-xs font-bold mb-1.5">💡 What to improve:</p>
            <div className="space-y-1.5">
              {result.whatToImprove.map((point, i) => (
                <p key={i} className="text-amber-300/80 font-mono text-xs leading-relaxed ml-2">• {point}</p>
              ))}
            </div>
          </div>
        )}

        {/* API error details (if fallback was used) */}
        {apiError && (
          <details className="bg-red-900/10 border border-red-800/30 rounded-lg">
            <summary className="text-red-400/60 font-mono text-xs cursor-pointer p-2 hover:text-red-400">
              ⚠️ Why wasn't AI used? (tap to see)
            </summary>
            <div className="px-2 pb-2">
              <p className="text-red-400/50 font-mono text-[10px] break-all">{apiError}</p>
            </div>
          </details>
        )}

        {/* Model answer */}
        <details className="bg-gray-800/40 border border-gray-700/50 rounded-lg">
          <summary className="text-gray-500 font-mono text-xs cursor-pointer p-3 hover:text-gray-400">
            📖 Show model answer for comparison
          </summary>
          <div className="px-3 pb-3">
            <p className="text-gray-400 font-mono text-xs leading-relaxed">{question.answer}</p>
          </div>
        </details>
      </div>
    );
  }

  // ── Input view ──
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono px-2 py-0.5 rounded bg-purple-900/40 text-purple-400 uppercase tracking-wider">
          {question.category.replace(/_/g, ' ')} — Extended
        </span>
        <span className="text-yellow-400 text-xs">{'⭐'.repeat(question.difficulty)}</span>
      </div>

      <p className="text-white font-mono text-sm leading-relaxed">{question.question}</p>

      <div className="bg-gray-800/40 border border-gray-700/50 rounded-lg p-2">
        <p className="text-gray-500 font-mono text-xs">
          📝 {er.maxMarks} marks • {er.keyPoints.length} key points
          {apiAvailable ? ' • 🤖 AI marking enabled' : ' • ⚠️ No API key — keyword matching only'}
        </p>
      </div>

      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Write your answer here... The better your response, the more damage you deal!"
        rows={5}
        className="w-full bg-gray-800 border-2 border-gray-600 focus:border-purple-500 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none resize-none"
        disabled={submitting}
        autoFocus
      />

      <div className="flex items-center justify-between">
        <span className="text-gray-500 font-mono text-xs">{answer.length} chars</span>
        <button
          onClick={handleSubmit}
          disabled={!answer.trim() || submitting}
          className={`font-mono text-sm px-6 py-2.5 rounded-lg transition-colors font-bold ${
            answer.trim() && !submitting
              ? 'bg-purple-600 hover:bg-purple-500 text-white'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin">⏳</span> Marking...
            </span>
          ) : (
            'SUBMIT ANSWER'
          )}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-2">
          <p className="text-red-400 font-mono text-xs">❌ {error}</p>
        </div>
      )}
    </div>
  );
}
