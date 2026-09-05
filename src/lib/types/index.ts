// ============================================================================
// CORE DOMAIN TYPES — single source of truth for the platform's data model.
// Firestore collections map 1:1 to these interfaces (see src/lib/firestore/schema.md)
// ============================================================================

export type Role = 'student' | 'teacher' | 'parent' | 'school_admin' | 'guardian';

export type Board = 'CBSE' | 'ICSE' | 'GSEB' | 'OTHER_STATE_BOARD';

// Only meaningful for Class 11-12 — determines which subjects a student
// sees. Classes 1-10 follow a common curriculum with no stream split.
export type Stream = 'Science' | 'Commerce' | 'Arts';

export type Language = 'en' | 'hi' | 'gu';
export type GitaAddress = 'sakha' | 'sakhi';

export type ExplainLevel = 'beginner' | 'intermediate' | 'advanced' | 'eli10';

export interface UserProfile {
  uid: string;
  email?: string;
  name: string;
  role: Role;
  schoolId: string;
  phone?: string;
  photoUrl?: string;
  // student-specific
  grade?: number; // 1-12
  board?: Board;
  stream?: Stream; // only set/relevant when grade is 11 or 12
  section?: string; // e.g. "A", "B" — combines with grade for a "class" like 4-A
  rollNumber?: string;
  parentIds?: string[]; // links to parent UserProfile.uid
  // teacher-specific
  subjectsTaught?: string[];
  classesTaught?: string[]; // e.g. ["10-A", "10-B"]
  // parent-specific
  childIds?: string[];
  preferredLanguage: Language;
  // A voluntary greeting preference used only by Bhagavad Gita mode.
  gitaAddress?: GitaAddress;
  createdAt: number;
  lastActiveAt: number;
  // Optional college learning preferences used to personalize weekly plans.
  studyPreferences?: StudyPreferences;
  trustedContact?: TrustedContact;
}

export interface StudyPreferences {
  favoriteSubjects: string;
  difficultSubjects: string;
  recentMarks: string;
  studyHoursPerDay: number;
  goal: string;
}

export interface TrustedContact {
  name: string;
  phone: string;
  photoUrl?: string;
}

// ---------------------------------------------------------------------------
// Guardian safety network — deliberately excludes tutor/counselling content.
// ---------------------------------------------------------------------------
export type GuardianConnectionStatus = 'PENDING' | 'ACCEPTED' | 'STUDENT_CONFIRMED' | 'ACTIVE' | 'REJECTED' | 'REVOKED';
export type GuardianRiskType = 'SAFE' | 'DISTRESS' | 'SELF_HARM_CONCERN' | 'HARM_TO_OTHERS_CONCERN' | 'IMMINENT_SELF_HARM' | 'IMMINENT_HARM_TO_OTHERS';
// An event is queued first, then becomes visible to the guardian only after
// the server's short dispatch window has elapsed. This avoids the UI claiming
// a notification was delivered before it has actually been checked.
export type GuardianEventStatus = 'PENDING_DISPATCH' | 'NOTIFIED' | 'ACKNOWLEDGED' | 'RESPONDING' | 'RESOLVED';

export interface GuardianPermissions {
  emergencyAlerts: boolean;
  emergencyLocation: boolean;
}

export interface GuardianConnection {
  id: string;
  studentId: string;
  studentName: string;
  guardianId?: string;
  guardianPhone: string;
  guardianName: string;
  relationship: string;
  status: GuardianConnectionStatus;
  permissions: GuardianPermissions;
  createdAt: number;
  acceptedAt?: number;
  confirmedAt?: number;
  revokedAt?: number;
}

export interface GuardianEvent {
  id: string;
  studentId: string;
  studentName: string;
  riskType: Extract<GuardianRiskType, 'IMMINENT_SELF_HARM' | 'IMMINENT_HARM_TO_OTHERS'>;
  status: GuardianEventStatus;
  policyVersion: string;
  sandbox: boolean;
  createdAt: number;
  notifyAfter?: number;
  notifiedAt?: number;
  notifiedGuardianIds: string[];
  acknowledgedBy?: string;
  acknowledgedAt?: number;
  resolvedAt?: number;
}

export interface School {
  id: string;
  name: string;
  board: Board;
  city: string;
  subscription: SubscriptionPlan;
  adminIds: string[];
  createdAt: number;
}

export interface SubscriptionPlan {
  tier: 'trial' | 'starter' | 'growth' | 'enterprise';
  studentSeats: number;
  seatsUsed: number;
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  renewsAt: number;
  // No payment provider is currently wired up (Razorpay integration was
  // removed) — this field is here for whenever billing gets built, whatever
  // provider that ends up using.
  paymentProviderRef?: string;
}

// ---------------------------------------------------------------------------
// AI Tutor
// ---------------------------------------------------------------------------

export type DoubtInputMode = 'text' | 'voice' | 'image';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  inputMode: DoubtInputMode;
  imageUrl?: string; // Firebase Storage URL if inputMode === 'image'
  explainLevel: ExplainLevel;
  language: Language;
  subject?: string;
  chapter?: string;
  createdAt: number;
  // True for validation/limit/cooldown/off-topic rejections rendered inline
  // in the chat thread — lets the UI style these distinctly from a real
  // tutor answer instead of pretending Gemini produced them.
  isSystemNotice?: boolean;
}

export interface TutorSession {
  id: string;
  studentId: string;
  schoolId: string; // denormalized so Firestore rules can scope teacher access to their own school
  subject: string;
  chapter?: string;
  board: Board;
  grade: number;
  messages: ChatMessage[];
  conceptsCovered: string[]; // tagged by AI after each turn, feeds analytics
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Content generation: notes, quizzes, study plans
// ---------------------------------------------------------------------------

export interface ChapterNote {
  id: string;
  subject: string;
  chapter: string;
  grade: number;
  board: Board;
  language: Language;
  summary: string;
  keyPoints: string[];
  formulas?: string[];
  diagramsDescribed?: string[];
  generatedFor: string; // studentId or 'shared'
  createdAt: number;
}

export type QuestionType = 'mcq' | 'short_answer' | 'long_answer' | 'fill_blank' | 'true_false';

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[]; // for mcq
  correctAnswer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  concept: string; // links back to a syllabus concept for analytics
}

export interface Quiz {
  id: string;
  title: string;
  subject: string;
  chapter: string;
  grade: number;
  board: Board;
  questions: QuizQuestion[];
  createdBy: 'ai' | string; // 'ai' or teacherId
  assignedTo?: string[]; // studentIds, empty = class-wide
  dueAt?: number;
  createdAt: number;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  studentId: string;
  schoolId: string; // denormalized for the same reason as TutorSession.schoolId
  answers: Record<string, string>; // questionId -> student answer
  score: number; // 0-100
  conceptBreakdown: Record<string, { correct: number; total: number }>;
  startedAt: number;
  submittedAt: number;
}

export interface StudyPlanItem {
  id: string;
  subject: string;
  concept: string;
  reason: string; // why the AI recommended this, e.g. "68% on last quiz"
  recommendedAction: 'review_notes' | 'ask_tutor' | 'practice_quiz' | 'watch_explainer';
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'done';
  targetDate: number;
}

export interface StudyPlan {
  id: string;
  studentId: string;
  schoolId: string;
  weekOf: number; // start-of-week timestamp
  items: StudyPlanItem[];
  generatedAt: number;
}

export interface SyllabusChapter {
  name: string;
  order: number;
}

export interface SyllabusEntry {
  id: string; // `${board}_${grade}_${subject}` — see src/lib/utils/syllabus.ts
  board: Board;
  grade: number;
  subject: string;
  chapters: SyllabusChapter[];
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export interface ConceptMastery {
  concept: string;
  subject: string;
  masteryScore: number; // 0-100, weighted rolling average
  attemptsCount: number;
  lastPracticedAt: number;
}

export interface StudentAnalyticsSnapshot {
  studentId: string;
  schoolId: string;
  weekOf: number;
  timeSpentMinutes: number;
  doubtsAsked: number;
  quizzesCompleted: number;
  avgQuizScore: number;
  conceptMastery: ConceptMastery[];
  strongSubjects: string[];
  weakSubjects: string[];
}

// ---------------------------------------------------------------------------
// Student wellbeing
// ---------------------------------------------------------------------------

export type CounselingFormat = 'online' | 'in_person';

export interface CounselingBooking {
  id: string;
  studentId: string;
  schoolId: string;
  format: CounselingFormat;
  preferredDate: string; // YYYY-MM-DD, chosen in the student's local timezone
  preferredTime: string;
  concern: string;
  status: 'requested' | 'confirmed' | 'completed' | 'cancelled';
  createdAt: number;
}

export interface WellbeingSession {
  id: string;
  studentId: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  gitaMode: boolean;
  createdAt: number;
  updatedAt: number;
}
