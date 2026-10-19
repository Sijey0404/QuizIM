import { describe, expect, it } from 'vitest';
import { buildExamAttemptPayload, DEFAULT_EXAM_ID } from './supabase';

describe('buildExamAttemptPayload', () => {
  it('maps student details and scores to the database row format', () => {
    const payload = buildExamAttemptPayload(
      {
        fullName: 'Maria Dela Cruz',
        studentId: '2024-001',
        course: 'BSIT',
        section: 'A',
      },
      42,
      84,
      DEFAULT_EXAM_ID,
    );

    expect(payload).toEqual({
      exam_id: DEFAULT_EXAM_ID,
      student_name: 'Maria Dela Cruz',
      student_number: '2024-001',
      course_section: 'BSIT / A',
      total_score: 42,
      percentage: 84,
      status: 'submitted',
      submitted_at: expect.any(String),
    });
  });

  it('supports creating an in-progress exam attempt record with student metadata before the exam score is submitted', () => {
    const payload = buildExamAttemptPayload(
      {
        fullName: 'Jose Santos',
        studentId: '2024-007',
        course: 'BSIT',
        section: 'B',
      },
      0,
      0,
      DEFAULT_EXAM_ID,
      { id: 'test-attempt-id', status: 'in_progress' },
    );

    expect(payload).toEqual({
      id: 'test-attempt-id',
      exam_id: DEFAULT_EXAM_ID,
      student_name: 'Jose Santos',
      student_number: '2024-007',
      course_section: 'BSIT / B',
      total_score: 0,
      percentage: 0,
      status: 'in_progress',
      started_at: expect.any(String),
    });
  });
});
