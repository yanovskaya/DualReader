const LAST_BOOK_KEY = "lingua_last_book";
const PROGRESS_KEY = (bookId: number) => `lingua_progress_${bookId}`;

export interface ReadingProgress {
  /** ID of the first paragraph visible at the top of the EN panel */
  paragraphId: number;
  /** Which batch that paragraph belongs to — used as the starting batch on restore */
  containingBatch: number;
  /** px offset of RU panel from paragraph-synced position (ruOffset ref) */
  ruOffset?: number;
}

export function saveLastBook(bookId: number): void {
  try { localStorage.setItem(LAST_BOOK_KEY, String(bookId)); } catch {}
}

export function getLastBook(): number | null {
  try {
    const v = localStorage.getItem(LAST_BOOK_KEY);
    const n = v ? parseInt(v, 10) : NaN;
    return isNaN(n) ? null : n;
  } catch { return null; }
}

export function saveProgress(bookId: number, progress: ReadingProgress): void {
  try { localStorage.setItem(PROGRESS_KEY(bookId), JSON.stringify(progress)); } catch {}
}

export function loadProgress(bookId: number): ReadingProgress | null {
  try {
    const v = localStorage.getItem(PROGRESS_KEY(bookId));
    if (!v) return null;
    const p = JSON.parse(v) as ReadingProgress;
    if (typeof p.paragraphId !== "number" || typeof p.containingBatch !== "number") return null;
    return p;
  } catch { return null; }
}
