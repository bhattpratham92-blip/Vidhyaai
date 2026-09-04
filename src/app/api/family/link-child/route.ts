import { NextRequest } from 'next/server';
import { verifyRequestAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { UserProfile } from '@/lib/types';

export const runtime = 'nodejs';

interface RequestBody {
  childEmail: string;
}

// KNOWN GAP (flagged in ROADMAP.md): this trusts that whoever knows a
// student's email is entitled to be linked as their parent. That's fine for
// a pilot with a small, known set of families, but a real deployment should
// require the school admin to approve the link (or have the school issue a
// one-time linking code to the parent) rather than pure email match — email
// addresses are guessable/knowable by more than just the actual parent.

export async function POST(req: NextRequest) {
  const decoded = await verifyRequestAuth(req.headers.get('authorization'));
  if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body: RequestBody = await req.json();
  if (!body.childEmail?.trim()) {
    return Response.json({ error: 'childEmail is required' }, { status: 400 });
  }

  try {
    const db = adminDb();
    const parentSnap = await db.collection('users').doc(decoded.uid).get();
    const parent = parentSnap.data() as UserProfile | undefined;
    if (!parent || parent.role !== 'parent') {
      return Response.json({ error: 'Only parent accounts can link a child' }, { status: 403 });
    }

    const studentQuery = await db
      .collection('users')
      .where('email', '==', body.childEmail.trim().toLowerCase())
      .where('role', '==', 'student')
      .limit(1)
      .get();

    if (studentQuery.empty) {
      return Response.json(
        { error: 'No student account found with that email at your school.' },
        { status: 404 }
      );
    }

    const studentDoc = studentQuery.docs[0];
    const student = studentDoc.data() as UserProfile;

    if (student.schoolId !== parent.schoolId) {
      // Same check as above but explicit — a parent can only link to a child
      // at the same school they registered under.
      return Response.json(
        { error: 'That student is not registered at your school.' },
        { status: 403 }
      );
    }

    await Promise.all([
      db.collection('users').doc(decoded.uid).update({
        childIds: FieldValue.arrayUnion(student.uid),
      }),
      db.collection('users').doc(student.uid).update({
        parentIds: FieldValue.arrayUnion(decoded.uid),
      }),
    ]);

    return Response.json({ linkedChild: { uid: student.uid, name: student.name, grade: student.grade } });
  } catch (err) {
    console.error('[/api/family/link-child] failed:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}
