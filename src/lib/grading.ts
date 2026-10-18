export type GradingResult = {
  correct: number;
  incorrect: number;
  unanswered: number;
  total: number;
  percentage: number;
};

export function normalizeSqlAnswer(raw: string): string {
  if (!raw) return '';

  return raw
    .replace(/`/g, '')
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/;/g, ' ')
    .replace(/\r\n|\n|\r/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function gradeAnswer(answer: string, acceptedAnswers: string[]): boolean {
  const cleaned = normalizeSqlAnswer(answer);

  if (!cleaned) return false;

  return acceptedAnswers.some((candidate) => normalizeSqlAnswer(candidate) === cleaned);
}

export function calculateScore(entries: Array<{ isCorrect: boolean; answer?: string | null }>): GradingResult {
  const correct = entries.filter((entry) => entry.isCorrect).length;
  const incorrect = entries.filter((entry) => !entry.isCorrect && Boolean(entry.answer && entry.answer.trim())).length;
  const unanswered = entries.filter((entry) => !entry.answer || !entry.answer.trim()).length;
  const total = entries.length;
  const percentage = total === 0 ? 0 : Number(((correct / total) * 100).toFixed(2));

  return {
    correct,
    incorrect,
    unanswered,
    total,
    percentage,
  };
}
