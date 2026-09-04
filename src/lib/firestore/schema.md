# Firestore Data Model

## Collections

```
schools/{schoolId}                          -> School
users/{uid}                                 -> UserProfile
tutorSessions/{sessionId}                   -> TutorSession
  - studentId, subject, board, grade indexed
chapterNotes/{noteId}                       -> ChapterNote
quizzes/{quizId}                            -> Quiz
quizAttempts/{attemptId}                    -> QuizAttempt
studyPlans/{studentId}_{weekOf}             -> StudyPlan
analyticsSnapshots/{studentId}_{weekOf}     -> StudentAnalyticsSnapshot
```

## Key access patterns & required composite indexes

1. Student's tutor sessions, most recent first
   `tutorSessions` where `studentId == X` orderBy `updatedAt desc`
2. Teacher's class quiz attempts for a subject
   `quizAttempts` where `quizId in [...]` — fan out from `quizzes` where `assignedTo array-contains classId`
3. Parent viewing child analytics
   `analyticsSnapshots` where `studentId == X` orderBy `weekOf desc` limit 12
4. School admin roster
   `users` where `schoolId == X` and `role == 'student'`

Create these composite indexes in Firebase Console (or `firestore.indexes.json`,
included in this repo — run `firebase deploy --only firestore:indexes`).

## Why this shape

- **Flat top-level collections, not deep nesting.** Firestore queries can't
  easily join across nested subcollections at scale; flat collections with
  denormalized `schoolId`/`studentId` fields keep every dashboard query a
  single indexed read.
- **`TutorSession.messages` is an embedded array**, not a subcollection —
  a single doubt-solving session rarely exceeds a few hundred KB, well under
  Firestore's 1MB doc limit, and this avoids N+1 reads when loading chat history.
  If you expect very long sessions (500+ turns), migrate to a
  `tutorSessions/{id}/messages` subcollection later — the `TutorSession` type
  already isolates this concern.
- **`analyticsSnapshots` are precomputed weekly**, not calculated live from
  raw quiz attempts on every dashboard load. A scheduled Cloud Function
  (Day 5) rolls up the week's `quizAttempts` + `tutorSessions` into one
  document per student. This is what makes the teacher dashboard fast even
  with a school of 2,000 students.
