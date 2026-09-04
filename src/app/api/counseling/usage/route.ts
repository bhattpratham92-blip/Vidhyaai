import { NextRequest } from 'next/server';
import { adminDb, verifyRequestAuth } from '@/lib/firebase/admin';
import { getWellbeingUsage } from '@/lib/usage/dailyLimit';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const decoded = await verifyRequestAuth(req.headers.get('authorization'));
  if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  return Response.json(await getWellbeingUsage(adminDb(), decoded.uid));
}
