import { GoogleGenerativeAI } from '@google/generative-ai';

// Server-only. Never import from a 'use client' component — this reads the
// secret GEMINI_API_KEY.

let client: GoogleGenerativeAI | null = null;

function getClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in .env.local');
  }
  if (!client) client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return client;
}

export function getTutorModel() {
  return getClient().getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
    generationConfig: {
      temperature: 0.6, // steady, explanatory — not creative-writing high
      maxOutputTokens: 2048,
    },
  });
}

export function getVisionModel() {
  return getClient().getGenerativeModel({
    model: process.env.GEMINI_VISION_MODEL || 'gemini-3.1-flash-lite',
    generationConfig: {
      temperature: 0.4, // lower — reading a photo of a problem should be precise
      maxOutputTokens: 2048,
    },
  });
}

export function getGenerationModel() {
  // Used for notes/quiz/study-plan generation where we want strict JSON back
  return getClient().getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
    },
  });
}

export function getRelevanceModel() {
  // Deliberately the cheapest available model with a tiny output cap — this
  // is a one-word classification (RELEVANT / NOT_RELEVANT), not a teaching
  // response, and runs BEFORE the expensive tutor call. Flash-Lite is
  // specifically built for exactly this kind of classification/routing task.
  return getClient().getGenerativeModel({
    model: 'gemini-3.1-flash-lite',
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 10,
    },
  });
}
