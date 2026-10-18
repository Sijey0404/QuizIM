import { describe, expect, it } from 'vitest';
import { normalizeSqlAnswer, gradeAnswer, calculateScore } from './grading';

describe('normalizeSqlAnswer', () => {
  it('trims whitespace and normalizes semicolons and line breaks', () => {
    expect(normalizeSqlAnswer('  CREATE DATABASE   scc_student_management ;  ')).toBe('CREATE DATABASE scc_student_management');
    expect(normalizeSqlAnswer('SELECT\n  *\nFROM students;')).toBe('SELECT * FROM students');
  });
});

describe('gradeAnswer', () => {
  it('recognizes valid SQL variants and rejects wrong syntax', () => {
    expect(gradeAnswer('CREATE DATABASE scc_student_management', ['CREATE DATABASE scc_student_management'])).toBe(true);
    expect(gradeAnswer('SELECT * FROM students', ['SELECT first_name, last_name FROM students'])).toBe(false);
  });
});

describe('calculateScore', () => {
  it('returns totals and percentage accurately', () => {
    const result = calculateScore([
      { isCorrect: true },
      { isCorrect: true },
      { isCorrect: false },
      { isCorrect: true },
    ]);

    expect(result.correct).toBe(3);
    expect(result.incorrect).toBe(1);
    expect(result.unanswered).toBe(0);
    expect(result.total).toBe(4);
    expect(result.percentage).toBe(75);
  });
});
