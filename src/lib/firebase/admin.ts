import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Server-only. Never import this file from a 'use client' component.

function getAdminApp(): App {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase Admin credentials. Set FIREBASE_ADMIN_PROJECT_ID, ' +
        'FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY in .env.local'
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

export const adminAuth = () => getAuth(getAdminApp());
export const adminDb = () => getFirestore(getAdminApp());

/**
 * Verifies the Firebase session cookie / ID token sent from the client and
 * returns the decoded token, or null if invalid/expired. Use this in every
 * API route that touches student data — never trust a uid passed in the body.
 */
export async function verifyRequestAuth(authHeader: string | null) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    // Secure by default. Set to "false" only in a deliberately local dev
    // environment; production API routes must never trust an unverified user.
    const requireUniversityEmail = process.env.REQUIRE_VERIFIED_UNIVERSITY_EMAIL !== 'false';
    const allowedDomain = (process.env.UNIVERSITY_EMAIL_DOMAIN || 'gnu.ac.in').toLowerCase();
    if (requireUniversityEmail && (!decoded.email_verified || !decoded.email?.toLowerCase().endsWith(`@${allowedDomain}`))) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Guardian routes authenticate only Firebase Phone Auth tokens. They do not
 * accept an arbitrary signed-in user or an email-password session.
 */
export async function verifyGuardianPhoneAuth(authHeader: string | null) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const decoded = await adminAuth().verifyIdToken(authHeader.slice(7));
    if (!decoded.phone_number || decoded.firebase?.sign_in_provider !== 'phone') return null;
    return decoded;
  } catch {
    return null;
  }
}
