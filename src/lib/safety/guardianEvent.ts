import { adminDb } from '@/lib/firebase/admin';
import type { UserProfile } from '@/lib/types';
import { hasImmediateSafetyConcern } from './crisis';

/** Server-only Guardian event creation. Never import this into a client file. */
export async function createGuardianSandboxEvent(studentId: string, message: string) {
  if (!hasImmediateSafetyConcern(message)) return { assessed: true, eventCreated: false as const };
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
  const event = { studentId, studentName: profile.name, riskType: 'IMMINENT_SELF_HARM', status: 'NOTIFIED', policyVersion: 'sandbox-server-signal-v1', sandbox: true, createdAt: Date.now(), notifiedGuardianIds: activeConnections.map((connection) => connection.data().guardianId).filter(Boolean) };
  const ref = await db.collection('guardianEvents').add(event);
  return { assessed: true, eventCreated: true as const, sandbox: true, eventId: ref.id };
}
