# 6-Day Roadmap

Each day assumes ~1-1.5 hours. Bring this file back into the next session and
say "continue from Day X" — the codebase is structured so each day builds on
real, working code, not placeholders.

## ✅ Day 1-2 (done): Foundation + AI Tutor core
- Project scaffold, Firebase Auth, role-based routing, Firestore schema + rules
- AI Tutor: text + image + voice doubt-solving, 4 teaching levels, 3 languages
- Chapter notes generation, quiz generation, study plan generation (APIs done)
- Student dashboard wired to live data; teacher/parent dashboard shells

## ✅ Day 3 (done): Notes/quiz UI + streaming + session history
- `/notes` page — subject/chapter picker → generates and displays chapter
  notes, with a download-as-text button
- `/practice` page + `QuizRunner.tsx` — generates a quiz, takes it
  interactively, auto-grades mcq/true_false/fill_blank on submit, shows
  per-question explanations
- `/api/quiz/attempt` — new grading endpoint, saves `QuizAttempt` to Firestore
- `/api/tutor` now streams the response token-by-token instead of waiting for
  the full answer (Gemini `sendMessageStream`)
- `SessionSidebar.tsx` — live list of past tutor sessions, click to resume

**Known gap from Day 3:** `short_answer` and `long_answer` quiz questions are
NOT auto-scored — exact string matching doesn't work for free-text answers.
They're shown with the model's explanation so the student can self-check, but
excluded from the numeric score. Real auto-grading of these needs an AI
grading pass (send student's answer + correct answer to Gemini, ask if it's
semantically correct) — worth its own focused session before Day 4 if
long-answer scoring matters for your use case.

## ✅ Day 4 (done): Analytics pipeline + study plan UI
- `src/app/api/analytics/rollup/route.ts` — computes weekly
  `StudentAnalyticsSnapshot` docs from that week's `quizAttempts` +
  `tutorSessions`, per student. Triggered by **Vercel Cron** (see
  `vercel.json`, runs Sundays 00:10 UTC) — deliberately NOT a Firebase Cloud
  Function, since scheduled Cloud Functions need Firebase's Blaze
  (pay-as-you-go) billing tier even for trivial workloads, and you're
  already deploying this app to Vercel anyway. Can also be triggered
  manually by a teacher/school_admin's ID token, for testing without
  waiting for the weekly schedule.
- Student dashboard: "Generate my study plan" button wired to the existing
  `/api/study-plan` route, renders items with a tap-to-cycle status
  (pending → in progress → done) via the new `/api/study-plan/update-item`
  route (client can't write `studyPlans` directly — blocked by
  `firestore.rules` — so this goes through an authenticated server route)
- `src/lib/utils/date.ts` — shared week-boundary logic so the dashboard,
  study-plan API, and rollup route all agree on what "this week" means
- Concept mastery is smoothed week over week (60% this week's data / 40%
  prior history) so one unlucky quiz doesn't erase weeks of progress

**To actually test this end-to-end:** take a practice quiz on `/practice`
first (so there's a `QuizAttempt` to roll up), then manually trigger
`/api/analytics/rollup` with a teacher account's ID token (or wait for the
Sunday cron once deployed), THEN click "Generate my study plan" on the
student dashboard — it needs a snapshot to exist first, by design, so the
plan is always grounded in real data rather than the AI guessing.

**Known gaps from Day 4:**
- `timeSpentMinutes` in the analytics snapshot is a rough heuristic (based on
  doubt count and quizzes taken), not measured time. Real time-tracking needs
  a client-side session timer sent up with each message — worth adding if
  "time spent learning" needs to be accurate for parent/teacher reporting.
- The rollup route does one Firestore read per unique quiz attempted that
  week (to fetch each quiz's subject for strong/weak subject calculation).
  Fine at current scale; if a school has thousands of attempts per week,
  denormalize `subject` onto `QuizAttempt` at write time (in
  `/api/quiz/attempt`) to cut this to zero extra reads.
- `CRON_SECRET` must be set in Vercel's environment variables AFTER first
  deploy for the cron job to authenticate — see README.md.

## ⚠️ Security fix applied during Day 5
While building the teacher dashboard, found that the Day 1 `firestore.rules`
had a real bug: the "is this teacher at the same school as the student"
check compared the teacher's own `schoolId` to itself — always true. That
meant any teacher account could read any student's doubt-history/quiz
attempts from ANY school, and quiz attempts/study plans/analytics snapshots
were even more open (any teacher or school_admin, unscoped by school
entirely). Fixed by:
- Denormalizing `schoolId` onto `TutorSession`, `QuizAttempt`, `StudyPlan`,
  and `StudentAnalyticsSnapshot` at write time
- Correcting the rules to compare against the resource's actual `schoolId`

**If you deployed rules before this fix, redeploy them:**
`firebase deploy --only firestore:rules`

## ✅ Day 5 (done): Teacher & parent dashboards
- `components/dashboard/ProgressChart.tsx` — Recharts bar chart, color-coded
  by mastery band (red/orange/green), weakest concepts shown first
- **Teacher dashboard**: class roster (avg score, doubts this week, weak
  subjects per student), click a row for that student's full mastery chart,
  and an "assign quiz to class" form that generates a quiz via the existing
  `/api/quiz/generate` and assigns it to selected students or the whole class
- **Parent dashboard**: link-a-child flow (`/api/family/link-child`, by
  email), weekly plain-language digest generated by Gemini
  (`/api/parent/digest` — deliberately avoids jargon like "concept mastery,"
  written like a note a teacher would send home), plus the same mastery chart
- `/api/quiz/generate` now checks that only a teacher/school_admin can set
  `assignedTo` — a student calling it for self-practice can't assign quizzes
  to other students

**Known gaps from Day 5:**
- **Parent-child linking trusts email match alone** — anyone who knows a
  student's email can currently link themselves as that student's parent.
  Fine for a small pilot with known families; a real deployment should route
  this through school admin approval or a one-time code instead. Flagged
  directly in `api/family/link-child/route.ts`.
- Teacher roster fetches one `analyticsSnapshot` read per student (N reads).
  Fine for classroom/school scale; would need a single aggregated
  "school-wide snapshot" doc if a school admin dashboard ever needs to show
  thousands of students at once.
- No way yet for a teacher to filter the roster by class/section — everyone
  in the school shows up. `classesTaught` exists on `UserProfile` but nothing
  writes to it yet (no UI to assign students to sections). Day 6 territory.
- Quiz auto-grading of long-answer questions is still unscored (unchanged
  from Day 3's known gap).

## ✅ Day 6 (done): Usage protection, curriculum alignment, deploy

### AI usage protection (cost + abuse control)
- **Daily limit**: 20 questions/student/day, enforced server-side in an
  atomic Firestore transaction (`src/lib/usage/dailyLimit.ts`) — resets
  automatically at midnight IST with zero cron job, since the counter's doc
  ID includes the date. Shared across text AND image doubts (one combined
  quota, not 20 of each).
- **5-second cooldown** between consecutive questions, enforced in the same
  transaction (client also shows a countdown on the send button, but that's
  cosmetic — the server is the real enforcement).
- **Input validation** (`src/lib/usage/validation.ts`): rejects empty input,
  <10 characters, <3 words, pure emoji/symbol spam, greetings ("hi", "thanks"),
  and gibberish (low vowel ratio, long repeated-character runs) — all
  free/instant, before any Firestore write or Gemini call. Shared verbatim
  between client (instant feedback) and server (real enforcement, since
  client-side checks alone can always be bypassed).
- **Subject-relevance check** (`src/lib/gemini/relevance.ts`): a cheap,
  separate Gemini Flash call classifies RELEVANT/NOT_RELEVANT before the
  main (expensive) tutor call runs — only on a fresh doubt, not every turn
  of an ongoing conversation. Toggle with `ENABLE_RELEVANCE_CHECK=false` if
  it ever proves too strict.
- **Answer caching** (`src/lib/cache/tutorCache.ts`): identical fresh
  questions (same board/grade/subject/chapter/level/language/question text)
  reuse a previously-generated answer instead of calling Gemini again.
  Deliberately scoped to first-message-of-a-session only — see the file's
  comments for why mid-conversation caching would be actively wrong.
- **"Questions Left Today: X/20"** display + **"Daily AI limit reached.
  Please try again tomorrow."** message, both wired into `ChatInterface.tsx`
  and backed by a real `/api/usage` read endpoint.
- Order of operations in `/api/tutor`, cheapest-first: format validation →
  daily limit/cooldown → cache lookup → relevance check → Gemini call. Each
  step can reject before the next (and more expensive) one runs.

**Known gaps in usage protection:**
- The gibberish/spam heuristics are regex-based, not ML — they'll have some
  false positives (an unusual but real question) and false negatives
  (creative spam that still trips the vowel-ratio check). Tune the word
  list and thresholds in `validation.ts` against real usage.
- The relevance check can occasionally misclassify a legitimate boundary
  question (e.g. a Science question that's really about math). It's a
  single Flash call with no retry/fallback nuance beyond "fail open" — flagged in the file.
- The 20/day limit is not currently configurable per school or per
  subscription tier — it's a flat constant in `dailyLimit.ts`. If different
  tiers should get different limits, that needs wiring to `SubscriptionPlan`.

### Curriculum alignment
- `syllabus` Firestore collection + `scripts/seedSyllabus.ts` (seeds CBSE
  Class 10 Science/Maths and GSEB Class 10 Science as a starting example —
  **extend this for your real subjects/grades**, it is not a complete
  curriculum)
- `ChapterPicker.tsx` — dropdown of real chapters when syllabus data exists
  for the selected board/grade/subject, falls back to free text otherwise.
  Wired into `/notes` and `/practice`. Not yet wired into the AI Tutor page,
  which doesn't currently have a chapter field at all (only subject) — would
  need a small addition to `ChatInterface.tsx` if per-chapter tutor context
  matters more than per-subject.

### Subscriptions/billing
**Removed by request.** A Razorpay-based subscription/billing feature (order
creation, webhook, checkout page) was built in an earlier pass and then
deliberately removed — no billing integration exists in the codebase right
now. The underlying `School.subscription` / `SubscriptionPlan` types in
`types/index.ts` remain (harmless, just data-model scaffolding for whenever
billing is actually wanted), with the Razorpay-specific field renamed to a
provider-neutral `paymentProviderRef`. If billing comes back later, it's a
fresh build against whatever payment provider makes sense then, not a
revival of the removed Razorpay code specifically.

### Deploy
- `DEPLOY_CHECKLIST.md` — full step-by-step, in dependency order, including
  a section explicitly separating "this gets it running" from "this makes
  it safe for real students" (the hardening gaps discussed earlier are
  listed there too, not just here)

## Not yet in scope (flag if you want these added to the plan)
- Push notifications for parents/teachers
- Offline/low-bandwidth mode (relevant for rural schools)
- Plagiarism-safe assignment grading (long-answer auto-grading is a deeper
  rabbit hole than MCQ grading — worth a dedicated session)
- Admin panel for uploading official textbook PDFs to ground notes generation
  in the exact textbook wording rather than general knowledge
- A real school-registration/admin-onboarding flow — "school code" at signup
  is still a free-text string anyone can type, with no `schools` document
  created or validated against it. This was going to matter more once
  billing existed; without billing, it's a lower-urgency gap, but still
  worth knowing about since it means "school" isn't really an enforced
  entity in the system yet.
- Billing/subscriptions (see above — removed, not currently planned)
- The full hardening pass discussed before Day 5: rate-limit monitoring
  dashboards, error tracking (Sentry), tested Firestore rules (emulator
  test suite), DPDP Act compliance review, email verification/password reset
