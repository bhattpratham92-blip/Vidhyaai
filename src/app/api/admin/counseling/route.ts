import { NextRequest } from 'next/server';
import { adminDb, verifyRequestAuth } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
const statuses = ['requested', 'confirmed', 'completed', 'cancelled'] as const;

export async function PATCH(req: NextRequest) {
  const decoded = await verifyRequestAuth(req.headers.get('authorization'));
  if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const db = adminDb();
  const admin = await db.collection('users').doc(decoded.uid).get();
  if (admin.data()?.role !== 'school_admin') return Response.json({ error: 'Admin access required.' }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body?.bookingId || !statuses.includes(body.status)) return Response.json({ error: 'Invalid booking update.' }, { status: 400 });
  await db.collection('counselingBookings').doc(body.bookingId).update({ status: body.status });
  return Response.json({ ok: true });
}
