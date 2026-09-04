'use client';

import { useEffect, useState } from 'react';
import {
  collection, query, where, orderBy, limit, getDocs, doc, getDoc, updateDoc,
} from 'firebase/firestore';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Navbar } from '@/components/layout/Navbar';
import { ProgressChart } from '@/components/dashboard/ProgressChart';
import { useAuth } from '@/lib/hooks/useAuth';
import { db } from '@/lib/firebase/client';
import { startOfWeek } from '@/lib/utils/date';
import { getSubjectsFor, STREAMS } from '@/lib/utils/subjects';
import type { Quiz, StudentAnalyticsSnapshot, Stream, UserProfile } from '@/lib/types';

interface RosterRow {
  profile: UserProfile;
  snapshot: StudentAnalyticsSnapshot | null;
}

/** Reverses classLabel() — pulls grade (and stream, for senior classes) back
 * out of a selected class filter like "12-Science" or "10-A", so the assign-
 * quiz form can show the RIGHT subjects and request the RIGHT grade level,
 * instead of falling back to the teacher's own (nonexistent) grade/stream. */
function parseClassLabel(label: string): { grade: number; stream?: Stream } {
  const [gradeStr, rest] = label.split('-');
  const grade = Number(gradeStr) || 10;
  if (rest && (STREAMS as readonly string[]).includes(rest)) {
    return { grade, stream: rest as Stream };
  }
  return { grade };
}
/** Builds a class label from a student's profile:
 * - Grade 11-12: "12-Science" (stream matters far more than section at this
 *   level — a school's "12th" is really three separate cohorts)
 * - Grade 1-10: "4-A" (section only, no stream split at this level)
 * Falls back gracefully if a student's profile is missing a piece. */
function classLabel(student: UserProfile): string {
  if (student.grade && student.grade >= 11 && student.stream) {
    return `${student.grade}-${student.stream}`;
  }
  return student.section ? `${student.grade}-${student.section}` : `${student.grade ?? '?'}`;
}

function TeacherDashboardContent() {
  const { firebaseUser, profile } = useAuth();
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<RosterRow | null>(null);
  const [selectedClass, setSelectedClass] = useState<string>('All');
  const [recentQuizzes, setRecentQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // --- Assign-quiz form state ---
  const [subject, setSubject] = useState('');
  const [chapter, setChapter] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'mixed'>('mixed');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [wholeClass, setWholeClass] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [assignMessage, setAssignMessage] = useState('');

  // --- My Classes (which grade/section this teacher teaches) ---
  const [classesTaught, setClassesTaught] = useState<string[]>(profile?.classesTaught || []);
  const [newClassGrade, setNewClassGrade] = useState(10);
  const [newClassSection, setNewClassSection] = useState('');
  const [newClassStream, setNewClassStream] = useState<Stream>('Science');
  const [savingClasses, setSavingClasses] = useState(false);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      try {
        const rosterQuery = query(
          collection(db, 'users'),
          where('schoolId', '==', profile.schoolId),
          where('role', '==', 'student')
        );
        const rosterSnap = await getDocs(rosterQuery);
        const students = rosterSnap.docs.map((d) => d.data() as UserProfile);

        // Promise.allSettled instead of Promise.all: if any single student's
        // analyticsSnapshot read fails for any reason, the whole roster still
        // loads — that student's row just shows "No data yet" instead of the
        // entire page hanging on "Loading your class…" forever, which is
        // exactly what used to happen here before this fix.
        const weekOf = startOfWeek(Date.now());
        const results = await Promise.allSettled(
          students.map(async (student) => {
            const snap = await getDoc(doc(db, 'analyticsSnapshots', `${student.uid}_${weekOf}`));
            return { profile: student, snapshot: snap.exists() ? (snap.data() as StudentAnalyticsSnapshot) : null };
          })
        );
        const rows: RosterRow[] = results.map((r, i) =>
          r.status === 'fulfilled' ? r.value : { profile: students[i], snapshot: null }
        );
        setRoster(rows);

        try {
          const quizzesQuery = query(
            collection(db, 'quizzes'),
            where('createdBy', '==', profile.uid),
            orderBy('createdAt', 'desc'),
            limit(5)
          );
          const quizzesSnap = await getDocs(quizzesQuery);
          setRecentQuizzes(quizzesSnap.docs.map((d) => d.data() as Quiz));
        } catch (err) {
          // Non-fatal — the roster is the important part of this page.
          console.error('[teacher dashboard] recent quizzes failed to load:', err);
        }
      } catch (err) {
        console.error('[teacher dashboard] failed to load:', err);
        setLoadError('Could not load your class right now. Try refreshing the page.');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // Distinct class labels present in the roster, for the filter dropdown.
  const classOptions = ['All', ...Array.from(new Set([...roster.map((r) => classLabel(r.profile)), ...classesTaught])).sort()];
  const visibleRoster = selectedClass === 'All' ? roster : roster.filter((r) => classLabel(r.profile) === selectedClass);

  // Subjects and grade level for the assign-quiz form come from the SELECTED
  // CLASS, not the teacher's own profile (a teacher has no grade/stream of
  // their own — using it always fell back to the generic 1-10 subject list
  // and silently generated Class 10 quizzes no matter what class was picked).
  const { grade: assignGrade, stream: assignStream } =
    selectedClass === 'All' ? { grade: 10, stream: undefined } : parseClassLabel(selectedClass);
  const assignSubjects = getSubjectsFor(assignGrade, assignStream);

  // Keep the assign-quiz subject valid whenever the class filter changes —
  // e.g. switching from "10-A" to "12-Science" should reset the subject
  // away from anything Class-10-specific that Class 12 Science doesn't offer.
  useEffect(() => {
    if (!assignSubjects.includes(subject)) {
      setSubject(assignSubjects[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass]);

  useEffect(() => {
    if (profile?.classesTaught) {
      setClassesTaught(profile.classesTaught);
      if (profile.classesTaught[0]) setSelectedClass((prev) => (prev === 'All' ? profile.classesTaught![0] : prev));
    }
  }, [profile]);

  const isSeniorNewClass = newClassGrade >= 11;

  async function handleAddClass() {
    if (!profile) return;
    const label = isSeniorNewClass
      ? `${newClassGrade}-${newClassStream}`
      : `${newClassGrade}-${newClassSection.trim().toUpperCase()}`;
    if (!isSeniorNewClass && !newClassSection.trim()) return;
    if (classesTaught.includes(label)) {
      setNewClassSection('');
      return;
    }
    const updated = [...classesTaught, label];
    setSavingClasses(true);
    setClassesTaught(updated); // optimistic
    try {
      await updateDoc(doc(db, 'users', profile.uid), { classesTaught: updated });
    } catch (err) {
      console.error('[teacher dashboard] failed to save class:', err);
      setClassesTaught(classesTaught); // roll back on failure
    } finally {
      setSavingClasses(false);
      setNewClassSection('');
    }
  }

  async function handleRemoveClass(label: string) {
    if (!profile) return;
    const updated = classesTaught.filter((c) => c !== label);
    setClassesTaught(updated); // optimistic
    try {
      await updateDoc(doc(db, 'users', profile.uid), { classesTaught: updated });
    } catch (err) {
      console.error('[teacher dashboard] failed to remove class:', err);
      setClassesTaught(classesTaught); // roll back on failure
    }
    if (selectedClass === label) setSelectedClass('All');
  }

  async function handleAssignQuiz(e: React.FormEvent) {
    e.preventDefault();
    if (!chapter.trim()) return;
    setAssigning(true);
    setAssignMessage('');

    const assignedTo = wholeClass ? visibleRoster.map((r) => r.profile.uid) : selectedStudentIds;
    if (assignedTo.length === 0) {
      setAssignMessage('Select at least one student, or choose "Whole class".');
      setAssigning(false);
      return;
    }

    const token = await firebaseUser?.getIdToken();
    const res = await fetch('/api/quiz/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        subject,
        chapter,
        grade: assignGrade,
        board: profile?.board || 'CBSE',
        difficulty,
        questionCount: 10,
        assignedTo,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setRecentQuizzes((prev) => [data.quiz, ...prev].slice(0, 5));
      setAssignMessage(`Assigned "${data.quiz.title}" to ${assignedTo.length} student${assignedTo.length > 1 ? 's' : ''}.`);
      setChapter('');
    } else {
      setAssignMessage(data.error || 'Could not generate the quiz.');
    }
    setAssigning(false);
  }

  if (loading) return <div className="p-6 text-sm text-ink/50">Loading your class…</div>;
  if (loadError) return <div className="p-6 text-sm text-red-600">{loadError}</div>;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Class overview</h1>
          <p className="mt-1 text-sm text-ink/60">{visibleRoster.length} of {roster.length} students</p>
        </div>
        <select
          value={selectedClass}
          onChange={(e) => { setSelectedClass(e.target.value); setSelectedStudent(null); }}
          className="rounded-full border border-ink/15 bg-surface px-4 py-2 text-sm font-medium outline-none focus:border-indigo"
        >
          {classOptions.map((c) => <option key={c} value={c}>{c === 'All' ? 'All classes' : `Class ${c}`}</option>)}
        </select>
      </div>

      <section className="mt-6 rounded-xl2 border border-ink/10 bg-surface p-5">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink/50">My Classes</h2>
        <p className="mt-1 text-xs text-ink/50">
          Set the class(es) you teach — this becomes your default filter above.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {classesTaught.length === 0 && (
            <p className="text-sm text-ink/40">No classes added yet.</p>
          )}
          {classesTaught.map((c) => (
            <span
              key={c}
              className="flex items-center gap-1.5 rounded-full border border-indigo/30 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo"
            >
              {c}
              <button
                onClick={() => handleRemoveClass(c)}
                aria-label={`Remove ${c}`}
                className="text-indigo/60 hover:text-indigo"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <select
            value={newClassGrade}
            onChange={(e) => setNewClassGrade(Number(e.target.value))}
            className="rounded-lg border border-ink/15 px-2 py-1.5 text-sm outline-none focus:border-indigo"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
              <option key={g} value={g}>Class {g}</option>
            ))}
          </select>
          {isSeniorNewClass ? (
            <select
              value={newClassStream}
              onChange={(e) => setNewClassStream(e.target.value as Stream)}
              className="rounded-lg border border-ink/15 px-2 py-1.5 text-sm outline-none focus:border-indigo"
            >
              {STREAMS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <input
              value={newClassSection}
              onChange={(e) => setNewClassSection(e.target.value)}
              placeholder="Section (e.g. A)"
              maxLength={2}
              className="w-32 rounded-lg border border-ink/15 px-2 py-1.5 text-sm outline-none focus:border-indigo"
            />
          )}
          <button
            onClick={handleAddClass}
            disabled={savingClasses || (!isSeniorNewClass && !newClassSection.trim())}
            className="rounded-full bg-indigo px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
          >
            + Add class
          </button>
        </div>
      </section>

      {/* Class highlights: who's doing well, who needs support - at a glance,
          rather than having to scan the full roster table row by row */}
      {(() => {
        const withScores = visibleRoster.filter((r) => r.snapshot);
        if (withScores.length === 0) return null;
        const sorted = [...withScores].sort((a, b) => b.snapshot!.avgQuizScore - a.snapshot!.avgQuizScore);
        const topPerformers = sorted.slice(0, 3);
        const needsSupport = [...sorted].reverse().slice(0, 3).filter((r) => r.snapshot!.avgQuizScore < 70);
        return (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl2 border border-leaf/20 bg-leaf-light/40 p-5">
              <h3 className="text-sm font-semibold text-leaf">Top performers this week</h3>
              <ul className="mt-2 space-y-1.5">
                {topPerformers.map((r) => (
                  <li key={r.profile.uid} className="flex justify-between text-sm">
                    <span>{r.profile.name}</span>
                    <span className="font-medium text-leaf">{r.snapshot!.avgQuizScore}%</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl2 border border-saffron/20 bg-saffron-light/30 p-5">
              <h3 className="text-sm font-semibold text-saffron">Could use some support</h3>
              {needsSupport.length === 0 ? (
                <p className="mt-2 text-sm text-ink/50">Nobody below 70% this week — nice.</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {needsSupport.map((r) => (
                    <li key={r.profile.uid} className="flex justify-between text-sm">
                      <span>{r.profile.name}</span>
                      <span className="font-medium text-saffron">{r.snapshot!.avgQuizScore}%</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        );
      })()}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        {/* Roster */}
        <section className="rounded-xl2 border border-ink/10 bg-surface p-5">
          <h2 className="font-display text-lg font-semibold">Roster</h2>
          {visibleRoster.length === 0 ? (
            <p className="mt-3 text-sm text-ink/60">
              {roster.length === 0
                ? 'No students have joined with your school code yet.'
                : 'No students in this class yet.'}
            </p>
          ) : (
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-ink/40">
                  <th className="py-2">Name</th>
                  <th className="py-2">Class</th>
                  <th className="py-2">Avg score</th>
                  <th className="py-2">Doubts (wk)</th>
                  <th className="py-2">Weak subjects</th>
                </tr>
              </thead>
              <tbody>
                {visibleRoster.map((row) => (
                  <tr
                    key={row.profile.uid}
                    onClick={() => setSelectedStudent(row)}
                    className={`cursor-pointer border-b border-ink/5 hover:bg-mist ${
                      selectedStudent?.profile.uid === row.profile.uid ? 'bg-indigo-50' : ''
                    }`}
                  >
                    <td className="py-2">{row.profile.name}</td>
                    <td className="py-2 text-ink/50">{classLabel(row.profile)}</td>
                    <td className="py-2">
                      {row.snapshot ? `${row.snapshot.avgQuizScore}%` : '—'}
                    </td>
                    <td className="py-2">{row.snapshot?.doubtsAsked ?? '—'}</td>
                    <td className="py-2">
                      {row.snapshot?.weakSubjects.length
                        ? row.snapshot.weakSubjects.join(', ')
                        : row.snapshot ? 'None flagged' : 'No data yet'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Selected student detail */}
        <section className="rounded-xl2 border border-ink/10 bg-surface p-5">
          <h2 className="font-display text-lg font-semibold">
            {selectedStudent ? selectedStudent.profile.name : 'Select a student'}
          </h2>
          {!selectedStudent && (
            <p className="mt-3 text-sm text-ink/60">
              Click a row in the roster to see concept-level mastery.
            </p>
          )}
          {selectedStudent && !selectedStudent.snapshot && (
            <p className="mt-3 text-sm text-ink/60">
              No analytics yet for this student — needs at least one completed
              quiz and a rollup run.
            </p>
          )}
          {selectedStudent?.snapshot && (
            <div className="mt-3">
              <ProgressChart conceptMastery={selectedStudent.snapshot.conceptMastery} />
            </div>
          )}
        </section>
      </div>

      {/* Assign quiz */}
      <section className="mt-6 rounded-xl2 border border-ink/10 bg-surface p-5">
        <h2 className="font-display text-lg font-semibold">Assign a quiz</h2>
        {selectedClass === 'All' && (
          <p className="mt-1 text-xs text-saffron">
            Pick a specific class above for the right subject list — &quot;All classes&quot; defaults to Class 10 subjects.
          </p>
        )}
        <form onSubmit={handleAssignQuiz} className="mt-4 flex flex-wrap items-end gap-3">
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="rounded-lg border border-ink/15 px-3 py-2 text-sm outline-none focus:border-indigo"
          >
            {assignSubjects.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
            placeholder="Chapter name"
            className="min-w-0 flex-1 rounded-lg border border-ink/15 px-3 py-2 text-sm outline-none focus:border-indigo"
          />
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
            className="rounded-lg border border-ink/15 px-3 py-2 text-sm outline-none focus:border-indigo"
          >
            <option value="mixed">Mixed difficulty</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
          <button
            type="submit"
            disabled={assigning}
            className="rounded-full bg-indigo px-5 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-60"
          >
            {assigning ? 'Assigning…' : 'Generate & assign'}
          </button>
        </form>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={wholeClass} onChange={(e) => setWholeClass(e.target.checked)} />
            {selectedClass === 'All' ? `Whole school (${visibleRoster.length} students)` : `Whole class ${selectedClass} (${visibleRoster.length} students)`}
          </label>
        </div>

        {!wholeClass && (
          <div className="mt-3 flex flex-wrap gap-2">
            {visibleRoster.map((r) => (
              <label
                key={r.profile.uid}
                className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${
                  selectedStudentIds.includes(r.profile.uid)
                    ? 'border-indigo bg-indigo-50 text-indigo'
                    : 'border-ink/15 text-ink/60'
                }`}
              >
                <input
                  type="checkbox"
                  className="hidden"
                  checked={selectedStudentIds.includes(r.profile.uid)}
                  onChange={() =>
                    setSelectedStudentIds((prev) =>
                      prev.includes(r.profile.uid)
                        ? prev.filter((id) => id !== r.profile.uid)
                        : [...prev, r.profile.uid]
                    )
                  }
                />
                {r.profile.name}
              </label>
            ))}
          </div>
        )}

        {assignMessage && <p className="mt-3 text-sm text-ink/70">{assignMessage}</p>}

        {recentQuizzes.length > 0 && (
          <div className="mt-5 border-t border-ink/10 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">Recently assigned</p>
            <ul className="mt-2 space-y-1.5">
              {recentQuizzes.map((q) => (
                <li key={q.id} className="flex justify-between text-sm">
                  <span>{q.title} — {q.subject}</span>
                  <span className="text-ink/50">{q.assignedTo?.length || 0} students</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

export default function TeacherDashboardPage() {
  return (
    <AuthGuard allowedRoles={['teacher']}>
      <Navbar />
      <TeacherDashboardContent />
    </AuthGuard>
  );
}
