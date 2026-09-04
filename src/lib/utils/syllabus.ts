import type { Board } from '@/lib/types';

export function syllabusId(board: Board, grade: number, subject: string): string {
  return `${board}_${grade}_${subject}`.replace(/\s+/g, '-').toLowerCase();
}
