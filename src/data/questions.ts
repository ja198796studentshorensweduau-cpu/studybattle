export type QuestionType = 'multiple_choice' | 'short_answer' | 'grid_click';

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

  const validTypes: QuestionType[] = ['multiple_choice', 'short_answer', 'grid_click'];
  const parsed: Question[] = [];
  const catSet = new Set<string>();

  for (let i = 0; i < data.length; i++) {
    const raw = data[i];
    if (!raw || typeof raw !== 'object') return `Item ${i} is not an object.`;

    const q = raw as Record<string, unknown>;

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
        return `Item ${i}: multiple_choice needs "options" array with at least 2 items.`;
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

export function getRandomQuestion(excludeIds: string[] = [], categories?: string[]): Question {
  let pool = _questions.filter((q) => !excludeIds.includes(q.id));
  if (categories && categories.length > 0) {
    pool = pool.filter((q) => categories.includes(q.category));
  }
  if (pool.length === 0) {
    pool = categories ? _questions.filter((q) => categories.includes(q.category)) : [..._questions];
  }
  if (pool.length === 0) pool = [..._questions]; // ultimate fallback
  return pool[Math.floor(Math.random() * pool.length)];
}
