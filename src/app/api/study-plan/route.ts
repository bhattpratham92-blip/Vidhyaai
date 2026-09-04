import { NextRequest } from 'next/server';
import { verifyRequestAuth, adminDb } from '@/lib/firebase/admin';
import { getGenerationModel } from '@/lib/gemini/client';
import { buildStudyPlanPrompt } from '@/lib/gemini/prompts';
import { parseGeminiJson } from '@/lib/gemini/parseJson';
import { startOfWeek } from '@/lib/utils/date';
import type { StudyPlan, StudyPlanItem, UserProfile } from '@/lib/types';

export const runtime = 'nodejs';

// Reads the student's own analytics snapshot rather than trusting client
// input for "weak concepts" — the plan has to be grounded in real quiz data,
// not whatever the client claims.

interface ParsedPlanItem {
  subject: string;
  concept: string;
  reason: string;
  recommendedAction: StudyPlanItem['recommendedAction'];
  priority: StudyPlanItem['priority'];
  daysFromNow: number;
}

export async function POST(req: NextRequest) {
  const decoded = await verifyRequestAuth(req.headers.get('authorization'));
  if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const db = adminDb();
  const weekOf = startOfWeek(Date.now());

  try {
    const profileSnap = await db.collection('users').doc(decoded.uid).get();
    if (!profileSnap.exists) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }
    const profile = profileSnap.data() as UserProfile;

    // Pull most recent analytics snapshot for weak-concept grounding.
    const [snapshotQuery, recentSessions] = await Promise.all([db
      .collection('analyticsSnapshots')
      .where('studentId', '==', decoded.uid)
      .orderBy('weekOf', 'desc')
      .limit(1)
      .get(), db.collection('tutorSessions').where('studentId', '==', decoded.uid).limit(5).get()]);

    const snapshot = snapshotQuery.docs[0]?.data();
    const weakConcepts =
      snapshot?.conceptMastery
        ?.sort((a: { masteryScore: number }, b: { masteryScore: number }) => a.masteryScore - b.masteryScore)
        .slice(0, 6)
        .map((c: { subject: string; concept: string; masteryScore: number }) => ({
          subject: c.subject,
          concept: c.concept,
          masteryScore: c.masteryScore,
        })) || [];

    const preferences = profile.studyPreferences;
    if (weakConcepts.length === 0 && preferences?.difficultSubjects) {
      preferences.difficultSubjects.split(',').map((subject) => subject.trim()).filter(Boolean).slice(0, 4).forEach((subject) => {
        weakConcepts.push({ subject, concept: 'Build foundations and identify weak areas', masteryScore: 0 });
      });
    }
    if (weakConcepts.length === 0) {
      return Response.json({ error: 'Tell us which subjects you find difficult first, then we can create your plan.' }, { status: 422 });
    }

    const model = getGenerationModel();
    const prompt = buildStudyPlanPrompt({
      studentName: profile.name,
      weakConcepts,
      recentQuizAvg: snapshot?.avgQuizScore || 0,
      favoriteSubjects: preferences?.favoriteSubjects,
      difficultSubjects: preferences?.difficultSubjects,
      recentMarks: preferences?.recentMarks,
      studyHours: preferences?.studyHoursPerDay,
      goal: preferences?.goal,
      recentQuestions: recentSessions.docs.flatMap((session) => {
        const messages = session.data().messages as { role: string; content: string }[] | undefined;
        return (messages || []).filter((message) => message.role === 'user').slice(-2).map((message) => message.content.slice(0, 180));
      }).slice(-6),
    });

    const result = await model.generateContent(prompt);
    const parsed = parseGeminiJson<{ items: ParsedPlanItem[] }>(result.response.text());

    const items: StudyPlanItem[] = parsed.items.map((item) => ({
      id: crypto.randomUUID(),
      subject: item.subject,
      concept: item.concept,
      reason: item.reason,
      recommendedAction: item.recommendedAction,
      priority: item.priority,
      status: 'pending',
      targetDate: weekOf + Number(item.daysFromNow) * 86400000,
    }));

    const plan: StudyPlan = {
      id: `${decoded.uid}_${weekOf}`,
      studentId: decoded.uid,
      schoolId: profile.schoolId,
      weekOf,
      items,
      generatedAt: Date.now(),
    };

    await db.collection('studyPlans').doc(plan.id).set(plan);
    return Response.json({ plan });
  } catch (err) {
    // This now catches EVERYTHING in the route, not just the Gemini call —
    // a missing Firestore index (very likely candidate here, given the
    // symptoms) throws well before Gemini is ever reached, and previously
    // had no safety net at all.
    console.error('[/api/study-plan] failed:', err);
    const message = err instanceof Error ? err.message : 'Unknown error generating the study plan';
    return Response.json({ error: message, code: 'generation_failed' }, { status: 500 });
  }
}
