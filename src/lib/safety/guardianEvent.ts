import { adminDb } from '@/lib/firebase/admin';
import type { UserProfile } from '@/lib/types';
import { hasHarmToOthersConcern, hasImmediateSafetyConcern } from './crisis';
import type { GuardianRiskType } from '@/lib/types';

export const GUARDIAN_ALERT_CHECK_MS = 3_000;

/** Server-only Guardian event creation. Never import this into a client file. */
export async function createGuardianSandboxEvent(studentId: string, message: string, assessedRisk?: Extract<GuardianRiskType, 'IMMINENT_SELF_HARM' | 'IMMINENT_HARM_TO_OTHERS'>) {
  try {
    if (!assessedRisk && !hasImmediateSafetyConcern(message)) return { assessed: true, eventCreated: false as const };
    const db = adminDb();
    // These independent reads run together so a direct safety signal reaches
    // the Guardian dashboard in the shortest possible server round trips.
    const [profileSnapshot, connectionSnapshot, previousSnapshot] = await Promise.all([
      db.collection('users').doc(studentId).get(),
      db.collection('guardianConnections').where('studentId', '==', studentId).get(),
      db.collection('guardianEvents').where('studentId', '==', studentId).get(),
    ]);
    const profile = profileSnapshot.data() as UserProfile | undefined;
    if (profile?.role !== 'student') return { assessed: true, eventCreated: false as const };
    const activeConnections = connectionSnapshot.docs.filter((connection) => connection.data().status === 'ACTIVE' && connection.data().permissions?.emergencyAlerts === true);
    if (activeConnections.length === 0) return { assessed: true, eventCreated: false as const, reason: 'no_active_guardian' };
    const previous = [...previousSnapshot.docs]
      .sort((a, b) => Number(b.data().createdAt || 0) - Number(a.data().createdAt || 0))[0];
    const now = Date.now();
    if (previous && now - Number(previous.data().createdAt || 0) < 15 * 60 * 1000 && previous.data().status !== 'RESOLVED') {
      // A repeated imminent-risk signal is not a duplicate to ignore. Refresh
      // the active incident so an open Guardian dashboard raises a new alert.
      await previous.ref.update({
        status: 'NOTIFIED',
        notifiedAt: now,
        lastTriggeredAt: now,
        triggerCount: Number(previous.data().triggerCount || 1) + 1,
      });
      return { assessed: true, eventCreated: false as const, eventRefreshed: true as const, sandbox: true, eventId: previous.id };
    }
    const riskType = assessedRisk || (hasHarmToOthersConcern(message) ? 'IMMINENT_HARM_TO_OTHERS' : 'IMMINENT_SELF_HARM');
    const createdAt = now;
    // This is the app's dashboard alert channel. Creating it as NOTIFIED makes
    // it visible on the next authenticated guardian refresh even when no
    // guardian page happened to be open during the old three-second window.
    // It does not claim that an SMS, push notification, or phone call was sent.
    const event = { studentId, studentName: profile.name, riskType, status: 'NOTIFIED' as const, policyVersion: 'sandbox-server-signal-v5', sandbox: true, createdAt, notifiedAt: createdAt, lastTriggeredAt: createdAt, triggerCount: 1, notifiedGuardianIds: activeConnections.map((connection) => connection.data().guardianId).filter(Boolean) };
    const ref = await db.collection('guardianEvents').add(event);
    return { assessed: true, eventCreated: true as const, sandbox: true, eventId: ref.id };
  } catch (error) {
    // Emergency support for the student must not depend on Firestore being
    // available. Callers still return their crisis response if alert storage
    // cannot be completed.
    console.error('[safety] could not create guardian dashboard alert:', error);
    return { assessed: true, eventCreated: false as const, reason: 'alert_storage_failed' };
  }
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
