const LAST_BOOK_KEY = "lingua_last_book";
const PROGRESS_KEY = (bookId: number) => `lingua_progress_${bookId}`;

export interface ReadingProgress {
  /** 0..1 scroll ratio in the EN panel */
  scrollRatio: number;
  /** highest batch number that was loaded */
  lastBatch: number;
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

/** Save to localStorage (instant, used on every scroll) */
export function saveProgress(bookId: number, progress: ReadingProgress): void {
  try { localStorage.setItem(PROGRESS_KEY(bookId), JSON.stringify(progress)); } catch {}
}

/** Persist progress to the server (called debounced, ~2s after scroll stops) */
export async function saveProgressToServer(bookId: number, progress: ReadingProgress): Promise<void> {
  try {
    await fetch(`/api/books/${bookId}/progress`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(progress),
    });
  } catch {
    // silently ignore — localStorage is the fallback
  }
}

/** Load progress: server is authoritative, localStorage is fallback */
export async function loadProgressFromServer(bookId: number): Promise<ReadingProgress | null> {
  try {
    const res = await fetch(`/api/books/${bookId}/progress`);
    if (!res.ok) return null;
    const data = await res.json() as { scrollRatio?: number; lastBatch?: number; ruOffset?: number };
    if (typeof data.scrollRatio !== "number" || typeof data.lastBatch !== "number") return null;
    return { scrollRatio: data.scrollRatio, lastBatch: data.lastBatch, ruOffset: data.ruOffset };
  } catch {
    return null;
  }
}

export function loadProgress(bookId: number): ReadingProgress | null {
  try {
    const v = localStorage.getItem(PROGRESS_KEY(bookId));
    if (!v) return null;
    const p = JSON.parse(v) as ReadingProgress;
    if (typeof p.scrollRatio !== "number" || typeof p.lastBatch !== "number") return null;
    return p;
  } catch { return null; }
}
