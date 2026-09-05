import { adminDb } from '@/lib/firebase/admin';
import type { UserProfile } from '@/lib/types';
import { hasHarmToOthersConcern, hasImmediateSafetyConcern } from './crisis';
import type { GuardianRiskType } from '@/lib/types';

export const GUARDIAN_ALERT_CHECK_MS = 3_000;

/** Server-only Guardian event creation. Never import this into a client file. */
export async function createGuardianSandboxEvent(studentId: string, message: string, assessedRisk?: Extract<GuardianRiskType, 'IMMINENT_SELF_HARM' | 'IMMINENT_HARM_TO_OTHERS'>) {
  if (!assessedRisk && !hasImmediateSafetyConcern(message)) return { assessed: true, eventCreated: false as const };
  const db = adminDb();
  const profile = (await db.collection('users').doc(studentId).get()).data() as UserProfile | undefined;
  if (profile?.role !== 'student') return { assessed: true, eventCreated: false as const };
  const connectionSnapshot = await db.collection('guardianConnections').where('studentId', '==', studentId).get();
  const activeConnections = connectionSnapshot.docs.filter((connection) => connection.data().status === 'ACTIVE' && connection.data().permissions?.emergencyAlerts === true);
  if (activeConnections.length === 0) return { assessed: true, eventCreated: false as const, reason: 'no_active_guardian' };
  const previous = (await db.collection('guardianEvents').where('studentId', '==', studentId).get()).docs
    .map((event) => event.data())
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  if (previous && Date.now() - previous.createdAt < 15 * 60 * 1000 && previous.status !== 'RESOLVED') return { assessed: true, eventCreated: false as const, reason: 'existing_event' };
  const riskType = assessedRisk || (hasHarmToOthersConcern(message) ? 'IMMINENT_HARM_TO_OTHERS' : 'IMMINENT_SELF_HARM');
  const createdAt = Date.now();
  // Do not mark an alert as notified when it is only detected. A trusted
  // server check promotes it after the short safety window instead.
  const event = { studentId, studentName: profile.name, riskType, status: 'PENDING_DISPATCH' as const, policyVersion: 'sandbox-server-signal-v3', sandbox: true, createdAt, notifyAfter: createdAt + GUARDIAN_ALERT_CHECK_MS, notifiedGuardianIds: activeConnections.map((connection) => connection.data().guardianId).filter(Boolean) };
  const ref = await db.collection('guardianEvents').add(event);
  return { assessed: true, eventCreated: true as const, sandbox: true, eventId: ref.id };
}

/**
 * Promote only due, already-security-flagged events for the supplied students.
 * This never evaluates a browser-supplied risk level or recipient. It is safe
 * to call repeatedly from the guardian dashboard's three-second heartbeat.
 */
export async function dispatchDueGuardianEvents(studentIds: string[]) {
  if (studentIds.length === 0) return { dispatched: 0 };
  const db = adminDb();
  const now = Date.now();
  const snapshot = await db.collection('guardianEvents').where('studentId', 'in', studentIds.slice(0, 10)).get();
  const due = snapshot.docs.filter((doc) => {
    const event = doc.data();
    return event.status === 'PENDING_DISPATCH' && typeof event.notifyAfter === 'number' && event.notifyAfter <= now;
  });
  await Promise.all(due.map((doc) => doc.ref.update({ status: 'NOTIFIED', notifiedAt: now })));
  return { dispatched: due.length };
}
