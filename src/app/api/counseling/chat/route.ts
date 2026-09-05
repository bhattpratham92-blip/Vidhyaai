import { NextRequest } from 'next/server';
import { adminDb, verifyRequestAuth } from '@/lib/firebase/admin';
import { getTutorModel } from '@/lib/gemini/client';
import { hasHarmToOthersConcern, hasImmediateSafetyConcern } from '@/lib/safety/crisis';
import { createGuardianSandboxEvent } from '@/lib/safety/guardianEvent';
import { checkAndConsumeWellbeingUsage } from '@/lib/usage/dailyLimit';
import { assessSemanticSafetyRisk } from '@/lib/safety/semanticRisk';
import type { UserProfile } from '@/lib/types';

export const runtime = 'nodejs';

type Message = { role: 'user' | 'assistant'; content: string };

function validConversation(value: unknown): value is Message[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 50 && value.every((message) =>
    message && (message.role === 'user' || message.role === 'assistant') &&
    typeof message.content === 'string' && message.content.trim().length > 0 && message.content.length <= 1200
  );
}

/** Server-mediated history avoids a browser Firestore query silently hiding chats. */
export async function GET(req: NextRequest) {
  const decoded = await verifyRequestAuth(req.headers.get('authorization'));
  if (!decoded) return Response.json({ error: 'Please sign in to view your previous chats.' }, { status: 401 });
  const sessions = (await adminDb().collection('wellbeingSessions').where('studentId', '==', decoded.uid).get()).docs
    .map((session) => session.data())
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
    .slice(0, 12);
  return Response.json({ sessions });
}

/** Saves an already-open legacy reflection that predates session history. */
export async function PUT(req: NextRequest) {
  const decoded = await verifyRequestAuth(req.headers.get('authorization'));
  if (!decoded) return Response.json({ error: 'Please sign in to save this reflection.' }, { status: 401 });
  const body = await req.json() as { messages?: unknown; gitaMode?: unknown };
  if (!validConversation(body.messages)) return Response.json({ error: 'This reflection cannot be saved.' }, { status: 400 });
  const db = adminDb();
  const ref = db.collection('wellbeingSessions').doc();
  const now = Date.now();
  const session = { id: ref.id, studentId: decoded.uid, messages: body.messages, gitaMode: Boolean(body.gitaMode), createdAt: now, updatedAt: now };
  await ref.set(session);
  return Response.json({ session });
}

const CRISIS_REPLY = `I’m really glad you told me. I’m concerned about your immediate safety, and this needs real-world support right now—not an AI chat. Please contact your local emergency service now, or tell a trusted adult, family member, school counselor, or friend who can stay with you. If you can, move away from anything you could use to hurt yourself or someone else. You deserve immediate support.`;
const CHECK_IN_REPLY = `I’m really sorry you’re carrying this much pain. Before we continue, I need to ask directly: are you thinking about hurting yourself or someone else right now, or do you feel unable to stay safe? If yes, please use the urgent-support option and contact someone who can be with you now.`;
const CHECK_IN_MARKER = 'Before we continue, I need to ask directly:';

const SYSTEM_PROMPT = `You are Vidya's AI wellbeing companion for college and school students in India. Your purpose is emotional support, not therapy or diagnosis.

Be warm, calm, human-sounding, and non-judgmental. Listen first; briefly reflect what the student said. Offer one or two practical, low-risk coping ideas such as grounding, a short breathing exercise, journaling, taking a break, or reaching out to a trusted person. Ask one gentle, open question to continue. Keep each reply under 160 words.

Never claim to be a human, therapist, counselor, doctor, or emergency service. Never diagnose, prescribe treatment/medication, give legal/medical advice, or shame the student. Never encourage dependency or secrecy. Do not say that conversations are confidential.

If there is any indication of self-harm, suicide, violence, abuse, immediate danger, or inability to stay safe: respond with empathy, state that immediate real-world help is needed, tell them to contact local emergency services or a trusted adult/family member/school counselor immediately, and ask if they can get to a safer place or contact someone now. Do not provide methods or extensive discussion. Encourage booking a human expert for ongoing support, but never present it as adequate for an emergency.`;

function gitaModePrompt(address: 'Sakha' | 'Sakhi') {
  return `

## Bhagavad Gita mode
The student has chosen a Bhagavad Gita-inspired reflection style. Address the student as "${address}" in EVERY response. Never call the student "${address === 'Sakha' ? 'Sakhi' : 'Sakha'}" and never use a slash. Speak with gentle steadiness and respect. Draw on broadly applicable Gita themes such as dharma (right action), karma yoga (focus on sincere effort rather than only outcomes), equanimity, courage, self-compassion, and clarity in difficult moments. Translate every idea into one small, practical action for today.

Do not claim to be Krishna, to speak for Krishna, or to have spiritual authority. Do not present religious interpretation as fact, pressure the student to share a belief, or make up shlokas, chapter numbers, or quotations. If mentioning a verse, use only a short, well-known wording you are confident is accurate and explain it simply. Keep the same wellbeing boundaries above: this style never replaces real-world or professional help.`;
}

export async function POST(req: NextRequest) {
  const decoded = await verifyRequestAuth(req.headers.get('authorization'));
  if (!decoded) return Response.json({ error: 'Please sign in to use the wellbeing chat.' }, { status: 401 });
  const studentId = decoded.uid;

  try {
    const body = await req.json() as { messages?: Message[]; gitaMode?: boolean; sessionId?: string };
    const messages = body.messages?.slice();
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 12) {
      return Response.json({ error: 'Please send a valid conversation.' }, { status: 400 });
    }
    if (!messages.every((message) => (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string' && message.content.trim().length > 0 && message.content.length <= 1200)) {
      return Response.json({ error: 'One of the messages is invalid.' }, { status: 400 });
    }

    // The browser displays a friendly opening message before the student has
    // said anything. It is UI-only; Gemini chat history must always begin
    // with a user turn, otherwise the SDK rejects the request.
    while (messages[0]?.role === 'assistant') messages.shift();
    if (messages.length === 0) {
      return Response.json({ error: 'Your message is required.' }, { status: 400 });
    }

    const latest = messages[messages.length - 1];
    if (latest.role !== 'user') return Response.json({ error: 'Your latest message is required.' }, { status: 400 });
    const db = adminDb();
    const now = Date.now();
    let sessionRef = db.collection('wellbeingSessions').doc();
    let createdAt = now;
    if (body.sessionId) {
      const existing = await db.collection('wellbeingSessions').doc(body.sessionId).get();
      if (!existing.exists || existing.data()?.studentId !== studentId) return Response.json({ error: 'Reflection not found.' }, { status: 404 });
      sessionRef = existing.ref;
      createdAt = existing.data()?.createdAt || now;
    }
    async function saveReflection(conversation: Message[]) {
      await sessionRef.set({ id: sessionRef.id, studentId, messages: conversation, gitaMode: Boolean(body.gitaMode), createdAt, updatedAt: Date.now() });
    }
    const recentUserContext = messages.filter((message) => message.role === 'user').map((message) => message.content).join('\n');
    // A check-in is a one-time interruption. On the next user turn, assess
    // only new imminent signals; otherwise continue the supportive chat.
    // Without this guard, the earlier distress text keeps being reclassified
    // and produces the same question on every reply.
    const checkInAlreadyAsked = messages.slice(0, -1).some((message) => message.role === 'assistant' && message.content.includes(CHECK_IN_MARKER));
    const semanticRisk = hasHarmToOthersConcern(latest.content)
      ? 'IMMINENT_OTHER'
      : hasImmediateSafetyConcern(latest.content)
        ? 'IMMINENT_SELF'
        : await assessSemanticSafetyRisk(checkInAlreadyAsked ? latest.content : recentUserContext);
    if (semanticRisk === 'IMMINENT_SELF' || semanticRisk === 'IMMINENT_OTHER') {
      // Server-side only: the counselling UI or model can never select a
      // Guardian, forge an alert payload, or notify somebody directly.
      await createGuardianSandboxEvent(studentId, latest.content, semanticRisk === 'IMMINENT_OTHER' ? 'IMMINENT_HARM_TO_OTHERS' : 'IMMINENT_SELF_HARM');
      const message = body.gitaMode ? `Sakha, ${CRISIS_REPLY}` : CRISIS_REPLY;
      await saveReflection([...messages, { role: 'assistant', content: message }]);
      return Response.json({ message, safetyConcern: true, sessionId: sessionRef.id });
    }
    if (semanticRisk === 'CHECK_IN' && !checkInAlreadyAsked) {
      const message = body.gitaMode ? `Sakha, ${CHECK_IN_REPLY}` : CHECK_IN_REPLY;
      await saveReflection([...messages, { role: 'assistant', content: message }]);
      return Response.json({ message, safetyCheckIn: true, sessionId: sessionRef.id });
    }

    const usage = await checkAndConsumeWellbeingUsage(db, studentId);
    if (!usage.allowed) return Response.json({ error: usage.message, code: usage.reason, remaining: usage.remaining }, { status: 429 });

    const profile = (await adminDb().collection('users').doc(studentId).get()).data() as UserProfile | undefined;
    const gitaAddress = profile?.gitaAddress === 'sakhi' ? 'Sakhi' : 'Sakha';
    const model = getTutorModel();
    const history = messages.slice(0, -1).map((message) => ({
      role: message.role === 'user' ? ('user' as const) : ('model' as const),
      parts: [{ text: message.content }],
    }));
    const systemInstruction = body.gitaMode ? `${SYSTEM_PROMPT}${gitaModePrompt(gitaAddress)}` : SYSTEM_PROMPT;
    const chat = model.startChat({ history, systemInstruction: { role: 'system', parts: [{ text: systemInstruction }] } });
    const result = await chat.sendMessage(latest.content);
    const reply = result.response.text().trim() || 'I’m here with you. Would you like to tell me a little more about what is going on?';
    const addressedReply = body.gitaMode ? reply.replace(/\b(sakha|sakhi)\b/gi, gitaAddress) : reply;
    const styledReply = body.gitaMode && !/\b(sakha|sakhi)\b/i.test(addressedReply) ? `${gitaAddress}, ${addressedReply}` : addressedReply;
    await saveReflection([...messages, { role: 'assistant', content: styledReply }]);
    return Response.json({ message: styledReply, remaining: usage.remaining, sessionId: sessionRef.id });
  } catch (error) {
    console.error('[/api/counseling/chat] failed:', error);
    return Response.json({ error: 'Unable to reply right now. Please try again or book a session with an expert.' }, { status: 500 });
  }
}
