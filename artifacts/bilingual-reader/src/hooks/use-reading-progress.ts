const LAST_BOOK_KEY = "lingua_last_book";
const PROGRESS_KEY = (bookId: number) => `lingua_progress_${bookId}`;

export interface ReadingProgress {
  // ── v2: paragraph-ID based (preferred) ────────────────────────────────────
  /** ID of the first paragraph visible at the top of the EN panel */
  paragraphId?: number;
  /** Which batch that paragraph belongs to — used as the starting batch on restore */
  containingBatch?: number;

  // ── v1: scroll-ratio based (legacy, still supported for existing saves) ────
  /** 0..1 scroll ratio in the EN panel */
  scrollRatio?: number;
  /** highest batch number that was loaded */
  lastBatch?: number;

  // ── common ─────────────────────────────────────────────────────────────────
  /** px offset of RU panel from paragraph-synced position (ruOffset ref) */
  ruOffset?: number;
}

export function isV2Progress(p: ReadingProgress): p is ReadingProgress & { paragraphId: number; containingBatch: number } {
  return typeof p.paragraphId === "number" && typeof p.containingBatch === "number";
}

export function isV1Progress(p: ReadingProgress): p is ReadingProgress & { scrollRatio: number; lastBatch: number } {
  return typeof p.scrollRatio === "number" && typeof p.lastBatch === "number";
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
    if (isV2Progress(p) || isV1Progress(p)) return p;
    return null;
  } catch { return null; }
}
