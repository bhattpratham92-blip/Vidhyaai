import { NextRequest } from 'next/server';
import { verifyRequestAuth, adminDb } from '@/lib/firebase/admin';
import type { StudyPlan, StudyPlanItem } from '@/lib/types';

export const runtime = 'nodejs';

interface RequestBody {
  planId: string;
  itemId: string;
  status: StudyPlanItem['status'];
}

export async function POST(req: NextRequest) {
  const decoded = await verifyRequestAuth(req.headers.get('authorization'));
  if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body: RequestBody = await req.json();
  if (!body.planId || !body.itemId || !body.status) {
    return Response.json({ error: 'planId, itemId, and status are required' }, { status: 400 });
  }

  try {
    const db = adminDb();
    const planRef = db.collection('studyPlans').doc(body.planId);
    const snap = await planRef.get();

    if (!snap.exists) return Response.json({ error: 'Plan not found' }, { status: 404 });
    const plan = snap.data() as StudyPlan;

    // Ownership check — a student can only update their own plan, even though
    // this route runs with Admin SDK privileges that bypass Firestore rules.
    if (plan.studentId !== decoded.uid) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updatedItems = plan.items.map((item) =>
      item.id === body.itemId ? { ...item, status: body.status } : item
    );

    await planRef.update({ items: updatedItems });
    return Response.json({ items: updatedItems });
  } catch (err) {
    console.error('[/api/study-plan/update-item] failed:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}
