# MySQL Examination and Automatic Grading System

A complete React + TypeScript + Vite examination platform for a 50-point MySQL exam with secure student submission, automatic grading, and an admin dashboard.

## Features

- Student registration form with validation
- 50-question SQL exam with progress tracking and review page
- Automated normalization and grading of SQL answers
- Local persistence for accidental refresh recovery
- Student registration details and final scores saved to Supabase in `exam_attempts` on submission
- Admin authentication and dashboard with search, filtering, export, and score summaries
- Supabase-ready schema and RLS policies for production deployment
- Vercel deployment compatibility

## Tech Stack

- Frontend: React + TypeScript + Vite
- Styling: Tailwind CSS
- Database: Supabase (PostgreSQL)
- Admin auth: Supabase Auth
- Deployment: Vercel

## Local Setup

1. Install dependencies:
   npm install
2. Copy `.env.example` to `.env` and add your Supabase project URL and anon key.
3. Run the app:
   npm run dev

## Required Environment Variables

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

The browser uses only the public anon key. Never add a service-role key to a `VITE_` variable or frontend code.

## Supabase Schema

The project includes a schema and seed script under `supabase/`:

- `supabase/schema.sql`
- `supabase/seed.sql`

The schema is designed for tables: `profiles`, `exams`, `questions`, `exam_attempts`, and `student_answers` along with row-level security rules.
Run both `supabase/schema.sql` and `supabase/seed.sql` in the Supabase SQL editor before accepting exam submissions. A completed submission stores the student's name, ID, course/section, score, percentage, and submission status in `exam_attempts`; a failed database save is shown to the student and does not mark the exam as submitted.

## Grading Logic

The grading engine performs the following:

- trims whitespace
- normalizes whitespace and line breaks
- removes semicolons, comments, and backticks
- compares against accepted SQL variants
- assigns 1 point for valid answers and 0 otherwise

This logic lives in `src/lib/grading.ts`.

## Production Deployment

### Supabase

1. Create a Supabase project.
2. Run the contents of `supabase/schema.sql` in the SQL editor.
3. Run `supabase/seed.sql` to populate the exam and question bank.
4. For an existing database, run `supabase/migrations/20261019_profiles_auth.sql` to allow each signed-in user to read only their own profile without recursive RLS.
5. Create the administrator account in Supabase Authentication, then add a matching profile row using that Auth user's UUID:

   ```sql
   insert into public.profiles (id, full_name, role)
   values ('AUTH_USER_UUID', 'Administrator Name', 'admin');
   ```

   The profile `id` must match the Auth user's `id`. Passwords belong in Supabase Auth, not in `profiles`.

### Vercel

1. Import the repository into Vercel.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from your Supabase project settings.
3. Deploy the app.

## Security Notes

- Never expose the service-role key to the browser.
- Keep answer keys in Supabase and retrieve them only from server-side or Edge Function logic.
- Use RLS to restrict access to student attempts and grading data.
- Do not execute student SQL against your live production database.

## Acknowledgements

This project is designed as an academic grade-management application for a MySQL exam.
