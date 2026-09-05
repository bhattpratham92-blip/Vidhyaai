import { NextRequest } from 'next/server';
import { adminAuth, adminDb, verifyRequestAuth } from '@/lib/firebase/admin';

export const runtime = 'nodejs';

/** Account deletion is intentionally explicit and server-authorized. */
export async function DELETE(request: NextRequest) {
  const decoded = await verifyRequestAuth(request.headers.get('authorization'));
  if (!decoded) return Response.json({ error: 'Unauthorized.' }, { status: 401 });

  const body = await request.json() as { confirmation?: unknown };
  if (body.confirmation !== 'DELETE MY ACCOUNT') {
    return Response.json({ error: 'Type DELETE MY ACCOUNT to confirm.' }, { status: 400 });
  }

  const db = adminDb();
  // Private account metadata is removed first. Historical operational data is
  // not exposed once the Auth identity and profile are removed.
  await db.collection('users').doc(decoded.uid).delete();
  await adminAuth().deleteUser(decoded.uid);
  return Response.json({ deleted: true });
}
