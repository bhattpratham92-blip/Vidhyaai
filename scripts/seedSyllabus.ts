/**
 * Seeds a small set of example syllabus entries so subject/chapter pickers
 * have real dropdown data instead of free text for at least a couple of
 * board/grade/subject combinations. This is a STARTING POINT, not a
 * complete curriculum — extend the SYLLABUS array below (or write your own
 * seed data source, e.g. importing from a spreadsheet) to cover every
 * subject your school actually teaches.
 *
 * Run with: npm run seed:syllabus
 * Requires the same FIREBASE_ADMIN_* env vars as the main app (.env.local).
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { SyllabusEntry } from '../src/lib/types';
import { syllabusId } from '../src/lib/utils/syllabus';

const SYLLABUS: Omit<SyllabusEntry, 'id'>[] = [
  {
    board: 'CBSE',
    grade: 10,
    subject: 'Science',
    chapters: [
      { name: 'Chemical Reactions and Equations', order: 1 },
      { name: 'Acids, Bases and Salts', order: 2 },
      { name: 'Metals and Non-metals', order: 3 },
      { name: 'Carbon and its Compounds', order: 4 },
      { name: 'Life Processes', order: 5 },
      { name: 'Control and Coordination', order: 6 },
      { name: 'How do Organisms Reproduce?', order: 7 },
      { name: 'Heredity and Evolution', order: 8 },
      { name: 'Light — Reflection and Refraction', order: 9 },
      { name: 'The Human Eye and the Colourful World', order: 10 },
      { name: 'Electricity', order: 11 },
      { name: 'Magnetic Effects of Electric Current', order: 12 },
      { name: 'Our Environment', order: 13 },
    ],
  },
  {
    board: 'CBSE',
    grade: 10,
    subject: 'Mathematics',
    chapters: [
      { name: 'Real Numbers', order: 1 },
      { name: 'Polynomials', order: 2 },
      { name: 'Pair of Linear Equations in Two Variables', order: 3 },
      { name: 'Quadratic Equations', order: 4 },
      { name: 'Arithmetic Progressions', order: 5 },
      { name: 'Triangles', order: 6 },
      { name: 'Coordinate Geometry', order: 7 },
      { name: 'Introduction to Trigonometry', order: 8 },
      { name: 'Circles', order: 9 },
      { name: 'Surface Areas and Volumes', order: 10 },
      { name: 'Statistics', order: 11 },
      { name: 'Probability', order: 12 },
    ],
  },
  {
    board: 'GSEB',
    grade: 10,
    subject: 'Science',
    chapters: [
      { name: 'Chemical Reactions and Equations', order: 1 },
      { name: 'Acid, Base and Salt', order: 2 },
      { name: 'Metals and Non-metals', order: 3 },
      { name: 'Life Processes', order: 4 },
      { name: 'Heredity and Evolution', order: 5 },
      { name: 'Light — Reflection and Refraction', order: 6 },
      { name: 'Electricity', order: 7 },
    ],
  },
];

async function main() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error('Missing FIREBASE_ADMIN_* env vars — check .env.local');
    process.exit(1);
  }

  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  const db = getFirestore();

  for (const entry of SYLLABUS) {
    const id = syllabusId(entry.board, entry.grade, entry.subject);
    await db.collection('syllabus').doc(id).set({ id, ...entry });
    console.log(`Seeded ${id} (${entry.chapters.length} chapters)`);
  }

  console.log(`Done — seeded ${SYLLABUS.length} syllabus entries.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
