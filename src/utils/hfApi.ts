/**
 * HuggingFace Inference API integration for marking extended responses.
 * Uses the official @huggingface/inference SDK with explicit provider routing.
 */

import { InferenceClient } from '@huggingface/inference';

let _apiKey: string = '';
let _lastError: string = '';
let _validated: boolean = false;
let _client: InferenceClient | null = null;

export function setHfApiKey(key: string) {
  _apiKey = key.trim();
  _validated = false;
  _client = _apiKey ? new InferenceClient(_apiKey) : null;
}

export function getHfApiKey(): string {
  return _apiKey;
}

export function isHfApiKeySet(): boolean {
  return _apiKey.length > 0;
}

export function isApiValidated(): boolean {
  return _validated;
}

export function getLastApiError(): string {
  return _lastError;
}

export interface MarkingResult {
  score: number;
  maxMarks: number;
  whatWentWell: string[];
  whatToImprove: string[];
  overallFeedback: string;
  source: 'ai' | 'fallback';
}

export interface ValidationResult {
  ok: boolean;
  message: string;
}

/** Model + provider combos to try, in priority order */
const MODEL_CONFIGS = [
  { model: 'Qwen/Qwen2.5-7B-Instruct', provider: 'novita' as const },
  { model: 'Qwen/Qwen2.5-7B-Instruct', provider: 'nebius' as const },
  { model: 'Qwen/Qwen2.5-7B-Instruct', provider: 'together' as const },
  { model: 'meta-llama/Llama-3.1-8B-Instruct', provider: 'sambanova' as const },
  { model: 'meta-llama/Llama-3.1-8B-Instruct', provider: 'novita' as const },
];

/**
 * Validate the API key by sending a tiny test request.
 */
export async function validateApiKey(key: string): Promise<ValidationResult> {
  if (!key?.trim()) {
    return { ok: false, message: 'No key entered.' };
  }

  const trimmed = key.trim();
  if (!trimmed.startsWith('hf_') && trimmed.length < 20) {
    return { ok: false, message: 'Key should start with "hf_" — check you copied the full token.' };
  }

  const testClient = new InferenceClient(trimmed);

  for (const { model, provider } of MODEL_CONFIGS) {
    try {
      const result = await testClient.chatCompletion({
        model,
        provider,
        messages: [{ role: 'user', content: 'Reply with just OK' }],
        max_tokens: 5,
      });

      if (result?.choices?.[0]?.message?.content) {
        return { ok: true, message: `Key works! ✅ (using ${model.split('/')[1]} via ${provider})` };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('401') || msg.includes('403') || msg.includes('Unauthorized')) {
        return { ok: false, message: 'Invalid or expired token. Generate a new one at huggingface.co/settings/tokens.' };
      }
      // Try next model/provider combo
      continue;
    }
  }

  // All combos failed but no auth error — key might be valid but models unavailable
  return { ok: false, message: 'Key format looks valid but no models responded. Check your HuggingFace account has API access enabled.' };
}

// ── Marking ──

function buildMessages(
  question: string,
  studentAnswer: string,
  keyPoints: string[],
  markingScheme: string,
  maxMarks: number,
): { role: 'system' | 'user'; content: string }[] {
  return [
    {
      role: 'system' as const,
      content: `You are a teacher marking a student's answer. Give specific feedback about what THEY wrote.

RULES:
- Respond ONLY with valid JSON, nothing else
- Reference the student's actual words in your feedback
- "whatWentWell": list specific correct things they said
- "whatToImprove": give actionable advice on what to add, fix, or explain better
- "overallFeedback": 1-2 sentence summary
- Score out of ${maxMarks}

Respond with ONLY this JSON:
{"score":0,"whatWentWell":["..."],"whatToImprove":["..."],"overallFeedback":"..."}`,
    },
    {
      role: 'user' as const,
      content: `QUESTION: ${question}

MARKING SCHEME (${maxMarks} marks): ${markingScheme}

KEY POINTS:
${keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

STUDENT WROTE:
"""
${studentAnswer}
"""

Mark this. What did they get right? What should they improve?`,
    },
  ];
}

function parseAiResponse(raw: string, maxMarks: number): MarkingResult | null {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);

    const score = Math.max(0, Math.min(maxMarks, Number(parsed.score) || 0));
    const whatWentWell = Array.isArray(parsed.whatWentWell)
      ? parsed.whatWentWell.filter((s: unknown) => typeof s === 'string' && s.length > 0)
      : [];
    const whatToImprove = Array.isArray(parsed.whatToImprove)
      ? parsed.whatToImprove.filter((s: unknown) => typeof s === 'string' && s.length > 0)
      : [];
    const overallFeedback = typeof parsed.overallFeedback === 'string' && parsed.overallFeedback.length > 0
      ? parsed.overallFeedback
      : null;

    if (whatWentWell.length === 0 && whatToImprove.length === 0 && !overallFeedback) return null;

    return {
      score,
      maxMarks,
      whatWentWell,
      whatToImprove,
      overallFeedback: overallFeedback || 'Answer marked.',
      source: 'ai',
    };
  } catch {
    return null;
  }
}

/**
 * Mark a student's extended response.
 * Tries multiple model/provider combos via the official HF client.
 */
export async function markExtendedResponse(
  question: string,
  studentAnswer: string,
  keyPoints: string[],
  markingScheme: string,
  maxMarks: number,
): Promise<MarkingResult> {
  _lastError = '';

  if (!_client || !_apiKey) {
    _lastError = 'No API key set';
    return fallbackMarking(studentAnswer, keyPoints, maxMarks);
  }

  const messages = buildMessages(question, studentAnswer, keyPoints, markingScheme, maxMarks);

  for (const { model, provider } of MODEL_CONFIGS) {
    try {
      const result = await _client.chatCompletion({
        model,
        provider,
        messages,
        temperature: 0.15,
        max_tokens: 600,
      });

      const content = result?.choices?.[0]?.message?.content;
      if (typeof content === 'string' && content.length > 0) {
        const parsed = parseAiResponse(content, maxMarks);
        if (parsed) {
          _lastError = '';
          _validated = true;
          return parsed;
        }
        _lastError = `${model} (${provider}): response wasn't valid JSON — ${content.slice(0, 80)}`;
      } else {
        _lastError = `${model} (${provider}): empty response`;
      }
    } catch (err) {
      _lastError = `${model} (${provider}): ${err instanceof Error ? err.message.slice(0, 100) : 'Unknown error'}`;
      console.warn('HF API error:', _lastError);
    }
  }

  console.warn('All AI attempts failed. Last error:', _lastError);
  return fallbackMarking(studentAnswer, keyPoints, maxMarks);
}

/**
 * Local keyword-based marking fallback.
 */
function fallbackMarking(
  studentAnswer: string,
  keyPoints: string[],
  maxMarks: number,
): MarkingResult {
  const lower = studentAnswer.toLowerCase();
  const words = lower.split(/\s+/);
  const wellDone: string[] = [];
  const toImprove: string[] = [];
  let hits = 0;

  const stopWords = new Set(['that', 'this', 'with', 'from', 'they', 'their', 'them', 'have', 'been', 'were', 'will', 'would', 'could', 'should', 'about', 'which', 'there', 'these', 'those', 'some', 'more', 'also', 'into', 'than', 'then', 'when', 'what', 'your', 'each', 'make', 'like', 'just', 'over', 'such', 'after', 'before', 'between', 'mention']);

  for (const point of keyPoints) {
    const keywords = point.toLowerCase()
      .replace(/[()\/]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 4 && !stopWords.has(w));

    if (keywords.length === 0) {
      hits++;
      wellDone.push(`Point noted: "${point}".`);
      continue;
    }

    const matched = keywords.filter(kw =>
      words.some(w => w.includes(kw) || kw.includes(w))
    );
    const ratio = matched.length / keywords.length;

    if (ratio >= 0.5) {
      hits++;
      wellDone.push(`Good — you covered "${point}" (keywords: ${matched.slice(0, 3).join(', ')}).`);
    } else if (ratio > 0) {
      const missing = keywords.filter(kw => !words.some(w => w.includes(kw) || kw.includes(w)));
      toImprove.push(`Partially addressed: "${point}". Also mention: ${missing.slice(0, 3).join(', ')}.`);
    } else {
      toImprove.push(`Missing: "${point}". Include this in your answer.`);
    }
  }

  const score = Math.round((hits / keyPoints.length) * maxMarks);
  const apiMsg = _lastError
    ? ` (AI error: ${_lastError})`
    : ' (No API key set)';

  return {
    score,
    maxMarks,
    whatWentWell: wellDone.length > 0 ? wellDone : ['Your answer was received but no key points were clearly matched.'],
    whatToImprove: toImprove.length > 0 ? toImprove : ['Try to be more specific and directly address each key point.'],
    overallFeedback: `Keyword matching: ${hits}/${keyPoints.length} key points.${apiMsg}`,
    source: 'fallback',
  };
}
