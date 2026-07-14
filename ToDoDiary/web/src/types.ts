// Mirrors the Android app's Firestore documents exactly.

export type TaskScope = 'DAY' | 'WEEK';
export type TaskStatus = 'OPEN' | 'DONE' | 'CARRIED';
export type InputType = 'INK' | 'TEXT';
export type PageTemplate = 'DIARY' | 'DOT_GRID' | 'PLAIN';

export interface Task {
  id: string;
  scope: TaskScope;
  pageDate: string | null; // "2026-07-13"
  weekId: string | null;   // "2026-W29"
  rowIndex: number;
  status: TaskStatus;
  inputType: InputType;
  textContent: string | null;
  inkJson: string | null;
  carriedToDate: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface DiaryPage {
  date: string;
  focusInkJson: string | null;
  focusText: string | null;
  notesInkJson: string | null;
  template: PageTemplate;
  updatedAt: number;
}

// Portable ink format (see ToDoDiary docs/ARCHITECTURE.md)
export interface InkStroke {
  c: string;      // colour hex
  w: number;      // base width px at cw
  p: number[];    // flat [x, y, pressure] triplets
}

export interface InkDoc {
  v: number;
  cw: number;     // canvas width strokes were written at
  strokes: InkStroke[];
}

export function parseInk(json: string | null | undefined): InkDoc | null {
  if (!json) return null;
  try {
    const doc = JSON.parse(json) as InkDoc;
    if (!doc || !Array.isArray(doc.strokes) || doc.strokes.length === 0) return null;
    return doc;
  } catch {
    return null;
  }
}
