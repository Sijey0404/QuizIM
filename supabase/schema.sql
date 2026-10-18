create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  role text not null default 'student' check (role in ('student', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  total_points integer not null default 50,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  question_number integer not null,
  section text not null,
  question_text text not null,
  points integer not null default 1,
  answer_key text,
  accepted_answers jsonb not null default '[]'::jsonb,
  requires_manual_review boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  student_name text not null,
  student_number text not null,
  course_section text not null,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  total_score integer not null default 0,
  percentage numeric not null default 0,
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'manual_review', 'graded')),
  created_at timestamptz not null default now(),
  unique (exam_id, student_number, started_at)
);

create table if not exists public.student_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  student_answer text,
  is_correct boolean not null default false,
  points_awarded integer not null default 0,
  feedback text,
  requires_manual_review boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_questions_exam on public.questions(exam_id);
create index if not exists idx_attempts_exam on public.exam_attempts(exam_id);
create index if not exists idx_attempts_student on public.exam_attempts(student_number);
create index if not exists idx_student_answers_attempt on public.student_answers(attempt_id);

alter table public.profiles enable row level security;
alter table public.exams enable row level security;
alter table public.questions enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.student_answers enable row level security;

create policy "Profiles are viewable by admins" on public.profiles
for select using (
  auth.uid() is not null and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy "Students can view their own profile" on public.profiles
for select using (auth.uid() = id);

create policy "Exam metadata is viewable to signed-in users" on public.exams
for select using (auth.uid() is not null);

create policy "Admin manages questions" on public.questions
for all using (
  auth.uid() is not null and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
) with check (
  auth.uid() is not null and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy "Students can insert attempts" on public.exam_attempts
for insert with check (auth.uid() is not null);

create policy "Students can view their own attempts" on public.exam_attempts
for select using (
  auth.uid() is not null and student_number = COALESCE((select student_number from public.exam_attempts where id = id), '')
);

create policy "Admins can manage all attempts" on public.exam_attempts
for all using (
  auth.uid() is not null and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
) with check (
  auth.uid() is not null and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy "Students can insert answers for own attempt" on public.student_answers
for insert with check (auth.uid() is not null);

create policy "Admins can read all student answers" on public.student_answers
for select using (
  auth.uid() is not null and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy "Students can read answers for their own attempt" on public.student_answers
for select using (
  auth.uid() is not null and exists (
    select 1
    from public.exam_attempts a
    where a.id = attempt_id
      and a.student_number = split_part((auth.jwt()->>'email'::text), '@', 1)
  )
);
