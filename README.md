# VidyaAI

An AI-powered student learning platform that teaches concepts deeply,
step-by-step — not a Q&A bot. Built for CBSE, ICSE, and State Board schools
in India.

## Status

This is the **Day 1–6 foundation** — feature-complete against the original
spec, not yet hardened for real student data at scale (see
`ROADMAP.md`'s Day 6 section and `DEPLOY_CHECKLIST.md` step 9 for what's
still missing before onboarding real schools).

⚠️ **If you deployed `firestore.rules` before Day 5**, redeploy them — a
cross-school data access bug was found and fixed during Day 5. Details in
`ROADMAP.md` under "Security fix applied during Day 5." Run:
`firebase deploy --only firestore:rules`

**Day 6 added:** a daily AI usage limit (20 questions/student/day) with
input validation, spam/greeting filtering, a subject-relevance check, and
answer caching to control Gemini cost and abuse — see `ROADMAP.md`'s Day 6
section for the full breakdown. Also added: curriculum-aligned chapter
pickers and `DEPLOY_CHECKLIST.md`. (A Razorpay billing integration was
built and then removed by request — no subscription/payment code exists
in this codebase.)

What's working right now:

- Firebase Auth (email/password) with role-based profiles: student, teacher,
  parent, school_admin
- Route protection by role (`AuthGuard`)
- Firestore data model + security rules, fully documented
- **AI Tutor** — the core feature — fully wired:
  - Text-based doubt solving with real conversation memory
  - Image-based doubt solving (photo of a textbook question) via Gemini Vision
  - Voice input via the browser's Web Speech API
  - Four teaching depths: Beginner / Intermediate / Advanced / "Explain like I'm 10"
  - Full responses in English, Hindi, or Gujarati
  - Step-by-step Socratic teaching method baked into the system prompt —
    see `src/lib/gemini/prompts.ts`
- Chapter notes generation (cached per board/grade/chapter so it's not
  regenerated per student)
- AI quiz/practice question generation
- Personalized weekly study plan generation (grounded in real quiz data)
- Student dashboard (recent sessions) wired to live Firestore data
- Teacher & parent dashboard shells, ready for Day 5's analytics build

## Getting started

```bash
npm install
cp .env.local.example .env.local
# fill in Firebase + Gemini keys, see below
npm run dev
```

### 1. Firebase setup

1. Create a project at https://console.firebase.google.com
2. Enable **Authentication** → Email/Password provider
3. Enable **Firestore Database** (production mode)
4. Enable **Storage** (for doubt-image uploads)
5. Project Settings → General → add a Web App → copy the config into the
   `NEXT_PUBLIC_FIREBASE_*` variables in `.env.local`
6. Project Settings → Service Accounts → Generate new private key → use the
   3 fields (`project_id`, `client_email`, `private_key`) for the
   `FIREBASE_ADMIN_*` variables. Keep the `\n` characters in the private key
   as literal `\n` — the code un-escapes them at runtime.
7. Deploy security rules: `firebase deploy --only firestore:rules`
   (install the Firebase CLI first: `npm i -g firebase-tools`, then
   `firebase login` and `firebase init` selecting this project)

### 1b. Weekly analytics rollup

This runs as a Next.js route (`/api/analytics/rollup`) triggered by Vercel
Cron — not a separate Firebase Cloud Function, so there's nothing to deploy
here beyond the app itself. Full setup is under **Deploying → Weekly
analytics rollup** below. Until that cron runs at least once (or you trigger
it manually as described there), the student dashboard's "Generate my study
plan" button will show "not enough quiz history" even after quizzes are
taken, because `analyticsSnapshots` won't exist yet.

### 2. Gemini setup

1. Get an API key at https://aistudio.google.com/app/apikey
2. Set `GEMINI_API_KEY` in `.env.local`
3. Default model is `gemini-1.5-pro` — swap to `gemini-1.5-flash` in
   `GEMINI_MODEL` if you want faster/cheaper responses for text tutoring and
   reserve `-pro` for `GEMINI_VISION_MODEL` (image doubt-solving benefits
   most from the stronger model).

### 3. Run it

```bash
npm run dev
```

Visit `http://localhost:3000`, sign up as a student (any `schoolId` string
works for now — school-code validation against a real `schools` collection
ships Day 6), and go to **AI Tutor**.

## Deploying

**For a full, ordered checklist, use `DEPLOY_CHECKLIST.md` instead of just
this section** — it covers seeding syllabus data and a smoke-test pass per
role that this README doesn't repeat.

Recommended: **Vercel** for the Next.js app (zero-config for this stack),
with Firebase for Auth/Firestore/Storage.

```bash
npm i -g vercel
vercel
```

Add all `.env.local` variables to the Vercel project's Environment Variables
settings before deploying.

### Weekly analytics rollup (Vercel Cron)

`vercel.json` already schedules `/api/analytics/rollup` to run every Sunday.
For it to authenticate correctly:

1. Generate a secret: `openssl rand -base64 32`
2. Add it as `CRON_SECRET` in Vercel's Environment Variables
3. Vercel automatically sends it as `Authorization: Bearer <CRON_SECRET>`
   on the scheduled request — no further setup needed

To test the rollup before the first Sunday, log in as a teacher/school_admin
account and call the route manually with that account's ID token:

```bash
curl -X POST https://your-app.vercel.app/api/analytics/rollup \
  -H "Authorization: Bearer <firebase-id-token>"
```

## Project structure

```
src/
  app/                       Next.js App Router pages + API routes
    api/tutor/                text doubt-solving endpoint (streaming)
    api/tutor/image/          image doubt-solving endpoint
    api/notes/generate/       chapter notes generation
    api/quiz/generate/        quiz generation
    api/quiz/attempt/         quiz grading + attempt storage
    api/study-plan/           personalized study plan generation
    api/study-plan/update-item/  toggle a plan item's status
    api/analytics/rollup/     weekly analytics rollup (Vercel Cron target)
    dashboard/                student/teacher/parent dashboards
    tutor/                    the AI Tutor chat page (with session sidebar)
    notes/                    chapter notes UI
    practice/                 quiz-taking UI
  components/
    tutor/                    chat UI, level/language selectors, voice/image
                              input, session sidebar
    quiz/QuizRunner.tsx       interactive quiz-taking + results view
    dashboard/                (Day 5)
    layout/                   navbar
    auth/                     route guard
  lib/
    firebase/                 client + admin SDK setup
    firestore/schema.md       data model documentation
    gemini/                   Gemini client + all teaching prompts
    types/                    shared TypeScript types (the data model backbone)
    hooks/useAuth.tsx         auth context provider
    utils/date.ts             shared week-boundary logic
firestore.rules               security rules (role-based access control)
vercel.json                   Vercel Cron schedule for the analytics rollup
```

## The teaching philosophy, in code

The single most important file in this repo is
`src/lib/gemini/prompts.ts` — specifically `buildTutorSystemPrompt()`. This
is what makes Vidya a *teacher* instead of a search engine wrapped in a chat
box: it enforces step-by-step explanation, a comprehension check-in, a
one-line takeaway, and calibrates vocabulary to the student's grade and
chosen depth. If you want to change how the tutor teaches, this is the file
to edit — not the API route logic.
