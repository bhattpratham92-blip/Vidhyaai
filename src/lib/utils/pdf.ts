import { jsPDF } from 'jspdf';

const MARGIN = 20;
const PAGE_WIDTH = 210; // A4, mm
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LINE_HEIGHT = 6;

/**
 * Minimal wrapper around jsPDF that handles the two things every export in
 * this app needs and jsPDF doesn't do for you: text wrapping that respects
 * the page margin, and automatic page breaks when content runs long (a
 * 15-question quiz result easily spans 2-3 pages).
 */
export class SimplePdf {
  private doc: jsPDF;
  private y: number;

  constructor(title: string, subtitle?: string) {
    this.doc = new jsPDF({ unit: 'mm', format: 'a4' });
    this.y = MARGIN;
    this.addText(title, { size: 18, style: 'bold' });
    if (subtitle) {
      this.addText(subtitle, { size: 11, style: 'normal', color: 110 });
    }
    this.spacer(3);
    this.divider();
  }

  private ensureSpace(lineCount: number) {
    if (this.y + lineCount * LINE_HEIGHT > PAGE_HEIGHT - MARGIN) {
      this.doc.addPage();
      this.y = MARGIN;
    }
  }

  addText(text: string, opts: { size?: number; style?: 'normal' | 'bold' | 'italic'; color?: number } = {}) {
    const { size = 11, style = 'normal', color = 20 } = opts;
    this.doc.setFont('helvetica', style);
    this.doc.setFontSize(size);
    this.doc.setTextColor(color);
    const lines = this.doc.splitTextToSize(text, CONTENT_WIDTH);
    this.ensureSpace(lines.length);
    this.doc.text(lines, MARGIN, this.y);
    this.y += lines.length * LINE_HEIGHT * (size / 11);
  }

  addHeading(text: string) {
    this.spacer(3);
    this.addText(text, { size: 13, style: 'bold' });
    this.spacer(1);
  }

  addBullet(text: string) {
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(11);
    this.doc.setTextColor(20);
    const lines = this.doc.splitTextToSize(`\u2022  ${text}`, CONTENT_WIDTH - 4);
    this.ensureSpace(lines.length);
    this.doc.text(lines, MARGIN + 2, this.y);
    this.y += lines.length * LINE_HEIGHT;
  }

  divider() {
    this.ensureSpace(1);
    this.doc.setDrawColor(210);
    this.doc.line(MARGIN, this.y, PAGE_WIDTH - MARGIN, this.y);
    this.spacer(5);
  }

  spacer(mm = 4) {
    this.y += mm;
  }

  save(filename: string) {
    this.doc.save(filename);
  }
}
