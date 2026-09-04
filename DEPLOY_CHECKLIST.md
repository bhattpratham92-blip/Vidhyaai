# Deploy Checklist

Go through this in order. Each step depends on the ones before it.

## 1. Firebase project
- [ ] Create the Firebase project, enable Authentication (Email/Password),
      Firestore (production mode), and Storage
- [ ] Deploy security rules: `firebase deploy --only firestore:rules`
- [ ] Deploy indexes: `firebase deploy --only firestore:indexes`
- [ ] (Recommended) Set a Firestore TTL policy on `usageCounters.expireAt` —
      Firebase Console → Firestore → TTL Policies — so daily quota counters
      don't accumulate forever

## 2. Seed data
- [ ] Run `npm run seed:syllabus` to load the starter curriculum data (see
      `scripts/seedSyllabus.ts` — extend this with your school's actual
      subjects/chapters before relying on it)

## 3. Gemini
- [ ] Get a `GEMINI_API_KEY` from https://aistudio.google.com/app/apikey
- [ ] Confirm billing/quota is set up on the Google AI side too — the
      in-app daily limit (20/day/student) caps YOUR cost exposure, but
      Google's own project-level quotas are a second, independent ceiling

## 4. Environment variables (Vercel → Project Settings → Environment Variables)
Copy every variable from `.env.local.example`, filled in for real:
- [ ] All `NEXT_PUBLIC_FIREBASE_*` and `FIREBASE_ADMIN_*`
- [ ] `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_VISION_MODEL`
- [ ] `ENABLE_RELEVANCE_CHECK` (leave `true` unless you've seen it misfire)
- [ ] `CRON_SECRET` — generate with `openssl rand -base64 32`

## 5. Deploy the app
- [ ] `vercel --prod`
- [ ] Confirm `vercel.json`'s cron job appears under Vercel → Project →
      Cron Jobs

## 6. Smoke test every role
- [ ] Sign up as a student → ask a doubt in the AI Tutor → generate notes →
      take a practice quiz
- [ ] Sign up as a teacher (same school code) → confirm the student appears
      in the roster (may need a rollup run first — see step 7) → assign a
      quiz
- [ ] Sign up as a parent → link the student by email → get a weekly digest
      (needs a rollup run first)

## 7. Trigger the first analytics rollup manually
Don't wait for Sunday's cron the first time — as a teacher/school_admin:
```bash
curl -X POST https://your-app.vercel.app/api/analytics/rollup \
  -H "Authorization: Bearer <firebase-id-token>"
```

## 8. Before onboarding REAL students — read this
This checklist gets the app running. It does not make it safe to hand to a
real school with real children's data without also reading the hardening
gaps called out throughout `ROADMAP.md` — most importantly:
- Parent-child linking currently trusts email match alone (no admin approval)
- No email verification or password-reset flow
- Firestore rules have not been run against the emulator's rules test suite
- No DPDP Act / child-data compliance review has been done
- No error monitoring (Sentry or similar) is wired in — a failure in
  production currently just fails silently to the user
- There's no real school-registration flow — "school code" at signup is
  just a free-text string, not a validated entity (see ROADMAP.md)
- No billing/subscription system exists (removed by request) — every
  student who signs up gets full access, with no seat limit of any kind

None of these block a small pilot with a school that knows it's early. They
should block onboarding hundreds of students without a conversation first.
