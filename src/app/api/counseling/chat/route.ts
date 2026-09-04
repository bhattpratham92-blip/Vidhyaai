import { NextRequest } from 'next/server';
import { adminDb, verifyRequestAuth } from '@/lib/firebase/admin';
import { getTutorModel } from '@/lib/gemini/client';
import { hasImmediateSafetyConcern } from '@/lib/safety/crisis';
import { createGuardianSandboxEvent } from '@/lib/safety/guardianEvent';
import { checkAndConsumeWellbeingUsage } from '@/lib/usage/dailyLimit';

export const runtime = 'nodejs';

type Message = { role: 'user' | 'assistant'; content: string };

const CRISIS_REPLY = `I’m really glad you told me. I’m concerned about your immediate safety, and this needs real-world support right now—not an AI chat. Please contact your local emergency service now, or tell a trusted adult, family member, school counselor, or friend who can stay with you. If you can, move away from anything you could use to hurt yourself or someone else. You deserve immediate support.`;

const SYSTEM_PROMPT = `You are Vidya's AI wellbeing companion for college and school students in India. Your purpose is emotional support, not therapy or diagnosis.

Be warm, calm, human-sounding, and non-judgmental. Listen first; briefly reflect what the student said. Offer one or two practical, low-risk coping ideas such as grounding, a short breathing exercise, journaling, taking a break, or reaching out to a trusted person. Ask one gentle, open question to continue. Keep each reply under 160 words.

Never claim to be a human, therapist, counselor, doctor, or emergency service. Never diagnose, prescribe treatment/medication, give legal/medical advice, or shame the student. Never encourage dependency or secrecy. Do not say that conversations are confidential.

If there is any indication of self-harm, suicide, violence, abuse, immediate danger, or inability to stay safe: respond with empathy, state that immediate real-world help is needed, tell them to contact local emergency services or a trusted adult/family member/school counselor immediately, and ask if they can get to a safer place or contact someone now. Do not provide methods or extensive discussion. Encourage booking a human expert for ongoing support, but never present it as adequate for an emergency.`;

export async function POST(req: NextRequest) {
  const decoded = await verifyRequestAuth(req.headers.get('authorization'));
  if (!decoded) return Response.json({ error: 'Please sign in to use the wellbeing chat.' }, { status: 401 });

  try {
    const body = await req.json() as { messages?: Message[] };
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
    if (hasImmediateSafetyConcern(latest.content)) {
      // Server-side only: the counselling UI or model can never select a
      // Guardian, forge an alert payload, or notify somebody directly.
      await createGuardianSandboxEvent(decoded.uid, latest.content);
      return Response.json({ message: CRISIS_REPLY });
    }

    const usage = await checkAndConsumeWellbeingUsage(adminDb(), decoded.uid);
    if (!usage.allowed) return Response.json({ error: usage.message, code: usage.reason, remaining: usage.remaining }, { status: 429 });

    const model = getTutorModel();
    const history = messages.slice(0, -1).map((message) => ({
      role: message.role === 'user' ? ('user' as const) : ('model' as const),
      parts: [{ text: message.content }],
    }));
    const chat = model.startChat({ history, systemInstruction: { role: 'system', parts: [{ text: SYSTEM_PROMPT }] } });
    const result = await chat.sendMessage(latest.content);
    const reply = result.response.text().trim();
    return Response.json({ message: reply || 'I’m here with you. Would you like to tell me a little more about what is going on?', remaining: usage.remaining });
  } catch (error) {
    console.error('[/api/counseling/chat] failed:', error);
    return Response.json({ error: 'Unable to reply right now. Please try again or book a session with an expert.' }, { status: 500 });
  }
}
