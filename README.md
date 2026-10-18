# MySQL Examination and Automatic Grading System

A complete React + TypeScript + Vite examination platform for a 50-point MySQL exam with secure student submission, automatic grading, and an admin dashboard.

## Features

- Student registration form with validation
- 50-question SQL exam with progress tracking and review page
- Automated normalization and grading of SQL answers
- Local persistence for accidental refresh recovery
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
2. Copy the environment template:
   cp .env.example .env
3. Fill in your Supabase values.
4. Run the app:
   npm run dev

## Required Environment Variables

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
VITE_ADMIN_EMAIL=admin@college.edu
VITE_ADMIN_PASSWORD=change-me
VITE_APP_MODE=demo
```

> Do not expose the Supabase service-role key in frontend code. Use it only in server-side or Edge Function environments.

## Supabase Schema

The project includes a schema and seed script under `supabase/`:

- `supabase/schema.sql`
- `supabase/seed.sql`

The schema is designed for tables: `profiles`, `exams`, `questions`, `exam_attempts`, and `student_answers` along with row-level security rules.

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
4. Turn on Row Level Security and confirm the policies.
5. Create an admin user in the `profiles` table.

### Vercel

1. Import the repository into Vercel.
2. Set the environment variables from `.env.example`.
3. Deploy the app.

## Security Notes

- Never expose the service-role key to the browser.
- Keep answer keys in Supabase and retrieve them only from server-side or Edge Function logic.
- Use RLS to restrict access to student attempts and grading data.
- Do not execute student SQL against your live production database.

## Acknowledgements

This project is designed as a secure academic grade-management application for a MySQL exam while remaining easy to demo locally in a browser environment.
