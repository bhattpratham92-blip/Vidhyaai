'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { stripUndefined } from '@/lib/utils/firestore';
import type { UserProfile, Role, Stream, TrustedContact, GitaAddress } from '@/lib/types';

interface AuthContextValue {
  firebaseUser: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (params: {
    email: string;
    password: string;
    name: string;
    role: Role;
    schoolId: string;
    grade?: number;
    board?: UserProfile['board'];
    stream?: Stream;
    section?: string;
    gitaAddress?: GitaAddress;
    trustedContact: Omit<TrustedContact, 'photoUrl'>;
  }) => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        const snap = await getDoc(doc(db, 'users', user.uid));
        setProfile(snap.exists() ? (snap.data() as UserProfile) : null);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function signIn(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function signUp(params: {
    email: string;
    password: string;
    name: string;
    role: Role;
    schoolId: string;
    grade?: number;
    board?: UserProfile['board'];
    stream?: Stream;
    section?: string;
    gitaAddress?: GitaAddress;
    trustedContact: Omit<TrustedContact, 'photoUrl'>;
  }) {
    // Keep Firebase Auth and the profile document in the same canonical form.
    // This also makes the Firestore rule's ownership check case-safe.
    const email = params.email.trim().toLowerCase();
    const cred = await createUserWithEmailAndPassword(auth, email, params.password);
    const newProfile: UserProfile = {
      uid: cred.user.uid,
      email,
      name: params.name,
      role: params.role,
      schoolId: params.schoolId,
      grade: params.grade,
      board: params.board,
      stream: params.stream,
      section: params.section,
      preferredLanguage: 'en',
      gitaAddress: params.gitaAddress,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      trustedContact: params.trustedContact,
    };
    // Firestore rejects any field explicitly set to `undefined` (grade/board/
    // stream/section are all undefined for a teacher signup, for example) —
    // stripUndefined() removes those keys entirely rather than sending them.
    await setDoc(doc(db, 'users', cred.user.uid), stripUndefined(newProfile));
    await sendEmailVerification(cred.user);
    setProfile(newProfile);
  }

  async function signOut() {
    await firebaseSignOut(auth);
  }

  async function refreshProfile() {
    const user = auth.currentUser;
    if (!user) return;
    const snap = await getDoc(doc(db, 'users', user.uid));
    setProfile(snap.exists() ? (snap.data() as UserProfile) : null);
  }

  return (
    <AuthContext.Provider value={{ firebaseUser, profile, loading, signIn, signUp, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
