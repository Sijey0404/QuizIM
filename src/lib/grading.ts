export type GradingResult = {
  correct: number;
  incorrect: number;
  unanswered: number;
  total: number;
  percentage: number;
};

export function normalizeSqlAnswer(raw: string): string {
  if (!raw) return '';

  const keywords = [
    'CREATE', 'DATABASE', 'USE', 'SHOW', 'DESCRIBE', 'DESC', 'TABLE', 'DROP', 'ALTER', 'ADD',
    'MODIFY', 'COLUMN', 'DELETE', 'FROM', 'SELECT', 'DISTINCT', 'WHERE', 'ORDER', 'BY', 'ASC',
    'DESC', 'LIKE', 'IN', 'BETWEEN', 'AND', 'OR', 'IS', 'NOT', 'NULL', 'COUNT', 'AVG', 'MAX',
    'MIN', 'SUM', 'GROUP', 'HAVING', 'AS', 'VALUES', 'SET', 'UPDATE', 'INSERT', 'INTO', 'PRIMARY',
    'KEY', 'REFERENCES', 'CHECK', 'UNIQUE', 'VARCHAR', 'INT', 'CHAR', 'DATE', 'DATETIME',
    'TIMESTAMP', 'TEXT', 'DECIMAL', 'FLOAT', 'DOUBLE', 'BOOL', 'BOOLEAN', 'TRUE', 'FALSE', 'JOIN',
    'LEFT', 'RIGHT', 'INNER', 'OUTER', 'CROSS', 'EXISTS', 'RENAME', 'TRUNCATE', 'ON', 'CASE', 'WHEN',
    'THEN', 'ELSE', 'END', 'LIMIT', 'TOP', 'ALL', 'ANY', 'SOME', 'CURRENT_DATE', 'CURRENT_TIMESTAMP'
  ];

  return raw
    .replace(/`/g, '')
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/;/g, ' ')
    .replace(/\r\n|\n|\r/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b[A-Za-z_]+\b/g, (match) => {
      return keywords.includes(match.toUpperCase()) ? match.toUpperCase() : match;
    });
}

export function gradeAnswer(answer: string, acceptedAnswers: string[]): boolean {
  const cleaned = normalizeSqlAnswer(answer);

  if (!cleaned) return false;

  return acceptedAnswers.some((candidate) => normalizeSqlAnswer(candidate) === cleaned);
}

export function calculateScore(entries: Array<{ isCorrect: boolean; answer?: string | null }>): GradingResult {
  const correct = entries.filter((entry) => entry.isCorrect).length;
  const incorrect = entries.filter((entry) => {
    if (entry.isCorrect !== false) return false;
    if (entry.answer === undefined || entry.answer === null) return true;
    return entry.answer.trim().length > 0;
  }).length;
  const unanswered = entries.filter((entry) => {
    if (entry.isCorrect !== false) return false;
    if (entry.answer === undefined || entry.answer === null) return false;
    return entry.answer.trim() === '';
  }).length;
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
