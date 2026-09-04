import { NextRequest } from 'next/server';
import { verifyRequestAuth } from '@/lib/firebase/admin';
import { createGuardianSandboxEvent } from '@/lib/safety/guardianEvent';

export const runtime = 'nodejs';

/**
 * This endpoint is intentionally the only place a Guardian safety event can
 * be created. The UI may submit a message for evaluation, but it cannot pass
 * a risk level, guardian ID, notification recipient, or event payload.
 *
 * It is SANDBOX-only until a professionally reviewed policy and notification
 * provider are configured. No SMS, call, push notification, or location data
 * is sent by this implementation.
 */
export async function POST(request: NextRequest) {
  const decoded = await verifyRequestAuth(request.headers.get('authorization'));
  if (!decoded) return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  const body = await request.json() as { message?: unknown };
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message || message.length > 1200) return Response.json({ error: 'Invalid message.' }, { status: 400 });

  return Response.json(await createGuardianSandboxEvent(decoded.uid, message));
}
