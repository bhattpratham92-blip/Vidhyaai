import { NextRequest } from 'next/server';
import { adminDb, verifyGuardianPhoneAuth, verifyRequestAuth } from '@/lib/firebase/admin';
import type { GuardianConnection, GuardianEvent, GuardianPermissions, UserProfile } from '@/lib/types';
import { normalizeGuardianPhone } from '@/lib/utils/phone';

export const runtime = 'nodejs';

const defaultPermissions: GuardianPermissions = { emergencyAlerts: true, emergencyLocation: false };

function bearer(request: NextRequest) {
  return request.headers.get('authorization');
}

async function studentFromRequest(request: NextRequest) {
  const decoded = await verifyRequestAuth(bearer(request));
  if (!decoded) return null;
  const profile = (await adminDb().collection('users').doc(decoded.uid).get()).data() as UserProfile | undefined;
  return profile?.role === 'student' ? { uid: decoded.uid, profile } : null;
}

export async function GET(request: NextRequest) {
  const guardian = await verifyGuardianPhoneAuth(bearer(request));
  const db = adminDb();
  if (guardian) {
    const profile = (await db.collection('users').doc(guardian.uid).get()).data() as UserProfile | undefined;
    if (profile?.role !== 'guardian') return Response.json({ error: 'Complete your guardian profile first.' }, { status: 403 });
    // Pending invitations do not have a guardianId until the guardian accepts
    // them, so load those by the verified phone number as well.
    const [connectedSnapshot, pendingSnapshot] = await Promise.all([
      db.collection('guardianConnections').where('guardianId', '==', guardian.uid).get(),
      // Filter the status in memory so this lookup does not require a
      // Firestore composite index before a Guardian can see an invitation.
      db.collection('guardianConnections').where('guardianPhone', '==', guardian.phone_number).get(),
    ]);
    const pendingDocs = pendingSnapshot.docs.filter((doc) => doc.data().status === 'PENDING');
    const connectionDocs = new Map([...connectedSnapshot.docs, ...pendingDocs].map((doc) => [doc.id, doc]));
    const connections = [...connectionDocs.values()].map((doc) => ({ id: doc.id, ...doc.data() } as GuardianConnection));
    const eventIds = new Set(connections.filter((item) => item.status === 'ACTIVE').map((item) => item.studentId));
    // Sort this small, Guardian-scoped result in memory so local development
    // and new Firebase projects do not need a composite Firestore index.
    const events = eventIds.size
      ? (await db.collection('guardianEvents').where('studentId', 'in', [...eventIds].slice(0, 10)).get()).docs
        .map((doc) => ({ id: doc.id, ...doc.data() } as GuardianEvent))
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 30)
      : [];
    return Response.json({ role: 'guardian', connections, events });
  }

  const student = await studentFromRequest(request);
  if (!student) return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  const connections = (await db.collection('guardianConnections').where('studentId', '==', student.uid).get()).docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return Response.json({ role: 'student', connections });
}

export async function POST(request: NextRequest) {
  const body = await request.json() as Record<string, unknown>;
  const action = body.action;
  const db = adminDb();

  // Phone authentication is deliberately separate from profile creation.
  // Returning this state lets a returning guardian skip the one-time name
  // and relationship form after each sign-in.
  if (action === 'profile-status') {
    const guardian = await verifyGuardianPhoneAuth(bearer(request));
    if (!guardian) return Response.json({ error: 'Guardian phone verification is required.' }, { status: 401 });
    const profile = (await db.collection('users').doc(guardian.uid).get()).data() as UserProfile | undefined;
    if (!profile) return Response.json({ registered: false });
    if (profile.role !== 'guardian') return Response.json({ error: 'This account cannot be used as a guardian.' }, { status: 403 });
    return Response.json({ registered: true });
  }

  if (action === 'complete-profile') {
    const guardian = await verifyGuardianPhoneAuth(bearer(request));
    const name = String(body.name || '').trim();
    const relationship = String(body.relationship || '').trim();
    if (!guardian || !name || name.length > 80 || relationship.length > 80) return Response.json({ error: 'A verified phone number, name, and relationship are required.' }, { status: 400 });
    const ref = db.collection('users').doc(guardian.uid);
    const existing = await ref.get();
    if (existing.exists && existing.data()?.role !== 'guardian') return Response.json({ error: 'This account cannot be used as a guardian.' }, { status: 403 });
    const profile = { uid: guardian.uid, name, role: 'guardian', phone: guardian.phone_number, schoolId: 'guardian-network', preferredLanguage: 'en', createdAt: existing.data()?.createdAt || Date.now(), lastActiveAt: Date.now() };
    await ref.set(profile, { merge: true });
    await db.collection('guardianProfiles').doc(guardian.uid).set({ guardianId: guardian.uid, userId: guardian.uid, verifiedPhone: guardian.phone_number, relationship, createdAt: existing.data()?.createdAt || Date.now() }, { merge: true });
    return Response.json({ profile });
  }

  const student = await studentFromRequest(request);
  if (action === 'invite') {
    if (!student) return Response.json({ error: 'Only a student can add a guardian.' }, { status: 403 });
    const guardianPhone = normalizeGuardianPhone(body.phone);
    const guardianName = String(body.name || '').trim();
    const relationship = String(body.relationship || '').trim();
    if (!guardianPhone || !guardianName || !relationship || guardianName.length > 80 || relationship.length > 80) return Response.json({ error: 'Enter a guardian name, relationship, and a valid mobile number (for example 9876543210 or +919876543210).' }, { status: 400 });
    const connection = { studentId: student.uid, studentName: student.profile.name, guardianPhone, guardianName, relationship, status: 'PENDING', permissions: defaultPermissions, createdAt: Date.now() };
    const ref = await db.collection('guardianConnections').add(connection);
    return Response.json({ connection: { id: ref.id, ...connection } }, { status: 201 });
  }

  if (action === 'confirm') {
    if (!student) return Response.json({ error: 'Only the student can confirm this connection.' }, { status: 403 });
    const ref = db.collection('guardianConnections').doc(String(body.connectionId || ''));
    const connection = (await ref.get()).data() as GuardianConnection | undefined;
    if (!connection || connection.studentId !== student.uid || connection.status !== 'ACCEPTED') return Response.json({ error: 'This connection cannot be confirmed.' }, { status: 409 });
    const permissions = body.permissions as GuardianPermissions;
    if (!permissions || typeof permissions.emergencyAlerts !== 'boolean' || typeof permissions.emergencyLocation !== 'boolean') return Response.json({ error: 'Choose the emergency permissions.' }, { status: 400 });
    await ref.update({ status: 'ACTIVE', permissions, confirmedAt: Date.now() });
    return Response.json({ ok: true });
  }

  const guardian = await verifyGuardianPhoneAuth(bearer(request));
  if (action === 'accept') {
    if (!guardian) return Response.json({ error: 'Guardian phone verification is required.' }, { status: 401 });
    const profile = (await db.collection('users').doc(guardian.uid).get()).data() as UserProfile | undefined;
    if (profile?.role !== 'guardian') return Response.json({ error: 'Complete your guardian profile first.' }, { status: 403 });
    const ref = db.collection('guardianConnections').doc(String(body.connectionId || ''));
    const connection = (await ref.get()).data() as GuardianConnection | undefined;
    if (!connection || connection.status !== 'PENDING' || connection.guardianPhone !== guardian.phone_number) return Response.json({ error: 'This invitation is not available.' }, { status: 404 });
    await ref.update({ guardianId: guardian.uid, status: 'ACCEPTED', acceptedAt: Date.now() });
    return Response.json({ ok: true });
  }

  if (action === 'acknowledge') {
    if (!guardian) return Response.json({ error: 'Guardian phone verification is required.' }, { status: 401 });
    const eventRef = db.collection('guardianEvents').doc(String(body.eventId || ''));
    const event = (await eventRef.get()).data();
    if (!event) return Response.json({ error: 'Alert not found.' }, { status: 404 });
    const connections = await db.collection('guardianConnections').where('studentId', '==', event.studentId).get();
    const active = connections.docs.some((connection) => connection.data().guardianId === guardian.uid && connection.data().status === 'ACTIVE');
    if (!active) return Response.json({ error: 'You are not authorized for this alert.' }, { status: 403 });
    await eventRef.update({ status: 'ACKNOWLEDGED', acknowledgedBy: guardian.uid, acknowledgedAt: Date.now() });
    return Response.json({ ok: true });
  }

  return Response.json({ error: 'Unknown guardian action.' }, { status: 400 });
}
