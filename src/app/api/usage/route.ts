import { NextRequest } from 'next/server';
import { verifyRequestAuth, adminDb } from '@/lib/firebase/admin';
import { getUsage } from '@/lib/usage/dailyLimit';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const decoded = await verifyRequestAuth(req.headers.get('authorization'));
  if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const usage = await getUsage(adminDb(), decoded.uid);
    return Response.json(usage);
  } catch (err) {
    console.error('[/api/usage] failed:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}
