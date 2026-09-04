import type { Stream } from '@/lib/types';

// Classes 1-10: common curriculum, no stream split.
const SUBJECTS_STANDARD = [
  'Mathematics', 'Science', 'Social Science', 'English', 'Gujarati', 'Hindi', 'Computer Science',
];

// Classes 11-12: subjects depend entirely on the student's chosen stream.
const SUBJECTS_BY_STREAM: Record<Stream, string[]> = {
  Science: ['Physics', 'Chemistry', 'Biology', 'Mathematics', 'English', 'Computer Science'],
  Commerce: ['Accountancy', 'Business Studies', 'Economics', 'Mathematics', 'English'],
  Arts: ['History', 'Political Science', 'Geography', 'Psychology', 'Economics', 'English'],
};

/** Returns the subject list a student should see, based on their grade and
 * (for Class 11-12) their stream. Falls back to the standard list if grade
 * or stream is missing, so an incomplete profile never blocks the UI. */
export function getSubjectsFor(grade?: number, stream?: Stream): string[] {
  if (grade && grade >= 11 && stream) {
    return SUBJECTS_BY_STREAM[stream];
  }
  return SUBJECTS_STANDARD;
}

export const STREAMS: Stream[] = ['Science', 'Commerce', 'Arts'];
