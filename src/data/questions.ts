export type QuestionType = 'multiple_choice' | 'short_answer' | 'grid_click' | 'extended_response';

export interface ExtendedResponseData {
  keyPoints: string[];
  markingScheme: string;
  maxMarks: number;
}

export interface Question {
  id: string;
  category: string;
  subcategory?: string;
  type: QuestionType;
  difficulty: 1 | 2 | 3;
  question: string;
  options?: string[];
  answer: string;
  explanation: string;
  gridData?: {
    targetX: number;
    targetY: number;
    gridLabel: string;
    tolerance: number;
  };
  extendedResponse?: ExtendedResponseData;
}

// ---- runtime question store ----
let _questions: Question[] = [];
let _categoryNames: Record<string, string> = {};

export function getQuestions(): Question[] {
  return _questions;
}

export function getCategoryNames(): Record<string, string> {
  return _categoryNames;
}

export function isQuestionsLoaded(): boolean {
  return _questions.length > 0;
}

/** Validate & load a raw JSON array into the store. Returns error string or null. */
export function loadQuestionsFromJSON(data: unknown): string | null {
  if (!Array.isArray(data)) return 'JSON must be an array of question objects.';
  if (data.length === 0) return 'JSON array is empty – add at least one question.';

  const validTypes: QuestionType[] = ['multiple_choice', 'short_answer', 'grid_click', 'extended_response'];
  const parsed: Question[] = [];
  const catSet = new Set<string>();

  for (let i = 0; i < data.length; i++) {
    const q = data[i] as Record<string, unknown>;

    // id – auto-generate if missing
    const id = typeof q.id === 'string' && q.id.length > 0 ? q.id : `q${i + 1}`;

    // category
    if (typeof q.category !== 'string' || q.category.length === 0)
      return `Item ${i}: "category" must be a non-empty string.`;
    const category = q.category;
    catSet.add(category);

    // type
    if (!validTypes.includes(q.type as QuestionType))
      return `Item ${i}: "type" must be one of: ${validTypes.join(', ')}`;
    const type = q.type as QuestionType;

    // difficulty
    const diff = typeof q.difficulty === 'number' ? q.difficulty : 1;
    const difficulty = ([1, 2, 3].includes(diff) ? diff : 1) as 1 | 2 | 3;

    // question text
    if (typeof q.question !== 'string' || q.question.length === 0)
      return `Item ${i}: "question" must be a non-empty string.`;

    // answer
    if (typeof q.answer !== 'string' || q.answer.length === 0)
      return `Item ${i}: "answer" must be a non-empty string.`;

    // options for multiple choice
    if (type === 'multiple_choice') {
      if (!Array.isArray(q.options) || q.options.length < 2)
        return `Item ${i}: multiple_choice needs at least 2 "options".`;
      if (!q.options.every((o: unknown) => typeof o === 'string'))
        return `Item ${i}: all "options" must be strings.`;
    }

    // gridData for grid_click
    if (type === 'grid_click') {
      if (!q.gridData || typeof q.gridData !== 'object')
        return `Item ${i}: grid_click needs a "gridData" object.`;
      const gd = q.gridData as Record<string, unknown>;
      if (typeof gd.targetX !== 'number' || typeof gd.targetY !== 'number')
        return `Item ${i}: gridData needs numeric "targetX" and "targetY".`;
    }

    // extendedResponse for extended_response
    if (type === 'extended_response') {
      if (!q.extendedResponse || typeof q.extendedResponse !== 'object')
        return `Item ${i}: extended_response needs an "extendedResponse" object.`;
      const er = q.extendedResponse as Record<string, unknown>;
      if (!Array.isArray(er.keyPoints) || er.keyPoints.length === 0)
        return `Item ${i}: extendedResponse needs a non-empty "keyPoints" array.`;
      if (typeof er.markingScheme !== 'string' || er.markingScheme.length === 0)
        return `Item ${i}: extendedResponse needs a "markingScheme" string.`;
    }

    // explanation – optional, default ''
    const explanation = typeof q.explanation === 'string' ? q.explanation : '';

    parsed.push({
      id,
      category,
      subcategory: typeof q.subcategory === 'string' ? q.subcategory : undefined,
      type,
      difficulty,
      question: q.question as string,
      options: type === 'multiple_choice' ? (q.options as string[]) : undefined,
      answer: q.answer as string,
      explanation,
      gridData:
        type === 'grid_click' && q.gridData
          ? {
              targetX: (q.gridData as Record<string, number>).targetX,
              targetY: (q.gridData as Record<string, number>).targetY,
              gridLabel:
                typeof (q.gridData as Record<string, unknown>).gridLabel === 'string'
                  ? ((q.gridData as Record<string, unknown>).gridLabel as string)
                  : '',
              tolerance:
                typeof (q.gridData as Record<string, unknown>).tolerance === 'number'
                  ? ((q.gridData as Record<string, unknown>).tolerance as number)
                  : 0,
            }
          : undefined,
      extendedResponse:
        type === 'extended_response' && q.extendedResponse
          ? {
              keyPoints: (q.extendedResponse as Record<string, unknown>).keyPoints as string[],
              markingScheme: (q.extendedResponse as Record<string, unknown>).markingScheme as string,
              maxMarks: typeof (q.extendedResponse as Record<string, unknown>).maxMarks === 'number'
                ? ((q.extendedResponse as Record<string, unknown>).maxMarks as number)
                : (q.extendedResponse as Record<string, unknown> & { keyPoints: string[] }).keyPoints?.length || 3,
            }
          : undefined,
    });
  }

  // Build category display names from category keys
  const catNames: Record<string, string> = {};
  for (const cat of catSet) {
    catNames[cat] = cat
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  _questions = parsed;
  _categoryNames = catNames;
  return null;
}

/**
 * Pick a random question, weighted so that questions the player has
 * answered incorrectly (or never seen) are more likely to appear.
 *
 * @param excludeIds   IDs already used this battle (avoid repeats)
 * @param categories   optional category filter
 * @param answerHistory  the player's full questionsAnswered array —
 *                       used to compute per-question accuracy and bias
 *                       towards weaker questions
 */
export function getRandomQuestion(
  excludeIds: string[] = [],
  categories?: string[],
  answerHistory?: { questionId: string; correct: boolean }[],
): Question {
  let pool = _questions.filter((q) => !excludeIds.includes(q.id));
  if (categories && categories.length > 0) {
    pool = pool.filter((q) => categories.includes(q.category));
  }
  if (pool.length === 0) {
    pool = categories ? _questions.filter((q) => categories.includes(q.category)) : [..._questions];
  }
  if (pool.length === 0) pool = [..._questions]; // ultimate fallback

  // If no history, pure random
  if (!answerHistory || answerHistory.length === 0) {
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Build per-question accuracy map
  const stats = new Map<string, { correct: number; total: number }>();
  for (const r of answerHistory) {
    if (!stats.has(r.questionId)) stats.set(r.questionId, { correct: 0, total: 0 });
    const s = stats.get(r.questionId)!;
    s.total++;
    if (r.correct) s.correct++;
  }

  // Assign weights:
  //   never seen       → weight 3   (highest priority)
  //   0% accuracy      → weight 3
  //   50% accuracy     → weight 2
  //   100% accuracy    → weight 1   (lowest, but still possible)
  const weights = pool.map((q) => {
    const s = stats.get(q.id);
    if (!s) return 3;                          // never attempted
    const accuracy = s.correct / s.total;      // 0..1
    return 3 - accuracy * 2;                   // 3 → 1
  });

  // Weighted random pick
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * totalWeight;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}
