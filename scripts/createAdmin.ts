import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!email || !password) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD before running this script.');
if (!projectId || !clientEmail || !privateKey) throw new Error('Missing FIREBASE_ADMIN_* credentials in .env.local.');

const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const auth = getAuth(app);
const db = getFirestore(app);

async function createOrUpdateAdmin() {
  let user;
  try {
    user = await auth.getUserByEmail(email!);
    await auth.updateUser(user.uid, { password, emailVerified: true });
  } catch (error) {
    if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
    user = await auth.createUser({ email, password, emailVerified: true, displayName: 'VidyaAI Administrator' });
  }

  await db.collection('users').doc(user.uid).set({
    uid: user.uid,
    email,
    name: 'VidyaAI Administrator',
    role: 'school_admin',
    schoolId: 'ganpat-university',
    preferredLanguage: 'en',
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
  }, { merge: true });

  console.log(`Administrator profile ready for ${email}.`);
}

createOrUpdateAdmin().catch((error) => {
  console.error('Could not create administrator:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
