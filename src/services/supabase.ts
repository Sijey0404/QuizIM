import { createClient } from '@supabase/supabase-js';
import type { AttemptRecord, StudentProfile } from '../types';

export type AdminProfile = {
  id: string;
  full_name: string;
  role: 'admin';
};

export const DEFAULT_EXAM_ID = '11111111-1111-4111-8111-111111111111';

export const supabaseConfig = {
  url: import.meta.env.VITE_SUPABASE_URL ?? '',
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
};

export const isSupabaseConfigured = Boolean(supabaseConfig.url && supabaseConfig.anonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseConfig.url, supabaseConfig.anonKey)
  : null;

export type ExamAttemptStatus = 'in_progress' | 'submitted' | 'manual_review' | 'graded';

export function buildExamAttemptPayload(
  profile: StudentProfile,
  totalScore: number,
  percentage: number,
  examId = DEFAULT_EXAM_ID,
  options: {
    id?: string;
    status?: ExamAttemptStatus;
    startedAt?: string;
    submittedAt?: string;
  } = {},
) {
  const course = profile.course.trim();
  const section = profile.section.trim();
  const status = options.status ?? 'submitted';
  const payload: Record<string, string | number> = {
    exam_id: examId,
    student_name: profile.fullName.trim(),
    student_number: profile.studentId.trim(),
    course_section: [course, section].filter(Boolean).join(' / '),
    total_score: totalScore,
    percentage,
    status,
  };

  if (options.id) {
    payload.id = options.id;
  }

  if (status === 'in_progress') {
    payload.started_at = options.startedAt ?? new Date().toISOString();
  } else {
    payload.submitted_at = options.submittedAt ?? new Date().toISOString();
  }

  return payload;
}

export async function saveStudentAttemptToSupabase(
  profile: StudentProfile,
  totalScore: number,
  percentage: number,
  examId = DEFAULT_EXAM_ID,
  options: {
    id?: string;
    status?: ExamAttemptStatus;
    startedAt?: string;
    submittedAt?: string;
  } = {},
): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set the project URL and anon key.');
  }

  const payload = buildExamAttemptPayload(profile, totalScore, percentage, examId, options);
  const { error } = await supabase
    .from('exam_attempts')
    .insert([payload]);

  if (error) {
    throw error;
  }
}

export function mapSupabaseAttemptRow(row: Record<string, unknown>): AttemptRecord {
  const courseSection = String(row.course_section ?? '').split(' / ');
  const course = courseSection[0] ?? '';
  const section = courseSection.slice(1).join(' / ');

  return {
    id: String(row.id ?? ''),
    createdAt: String(row.submitted_at ?? row.created_at ?? row.started_at ?? new Date().toISOString()),
    student: {
      fullName: String(row.student_name ?? ''),
      studentId: String(row.student_number ?? ''),
      course,
      section,
    },
    answers: {},
    status: (String(row.status ?? 'submitted') as AttemptRecord['status']),
    totalScore: Number(row.total_score ?? 0),
    percentage: Number(row.percentage ?? 0),
    correctCount: Number(row.total_score ?? 0),
    incorrectCount: 0,
    unansweredCount: 0,
    submittedAt: row.submitted_at ? String(row.submitted_at) : undefined,
    flaggedForReview: false,
  };
}

export async function getAllExamAttemptsFromSupabase(): Promise<AttemptRecord[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('exam_attempts')
    .select('*')
    .order('submitted_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => mapSupabaseAttemptRow(row as Record<string, unknown>));
}

export async function getAdminProfile(userId: string): Promise<AdminProfile> {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set the project URL and anon key.');
  }

  const { data: currentUser, error: currentUserError } = await supabase.auth.getUser();
  if (currentUserError) throw currentUserError;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const userRole = String(
      currentUser?.user?.app_metadata?.role ?? currentUser?.user?.user_metadata?.role ?? '',
    );

    if (userRole === 'admin') {
      const fallbackName =
        String(currentUser?.user?.user_metadata?.full_name ?? currentUser?.user?.email ?? 'Administrator') || 'Administrator';

      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert(
          { id: userId, full_name: fallbackName, role: 'admin' },
          { onConflict: 'id' },
        );

      if (upsertError) throw upsertError;

      return {
        id: userId,
        full_name: fallbackName,
        role: 'admin',
      };
    }

    throw new Error(
      'This Supabase auth user is not linked to an admin profile. Add a row in public.profiles with the same id as the auth user and role = "admin".',
    );
  }

  if (data.role !== 'admin') {
    throw new Error(
      'This Supabase auth user is not linked to an admin profile. Add a row in public.profiles with the same id as the auth user and role = "admin".',
    );
  }

  return data as AdminProfile;
}

export async function signInAdmin(email: string, password: string): Promise<AdminProfile> {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set the project URL and anon key.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  try {
    return await getAdminProfile(data.user.id);
  } catch (profileError) {
    await supabase.auth.signOut();
    throw new Error(
      profileError instanceof Error && profileError.message
        ? profileError.message
        : 'Unable to sign in. Please try again.',
    );
  }
}