const LAST_BOOK_KEY = "lingua_last_book";
const PROGRESS_KEY = (bookId: number) => `lingua_progress_${bookId}`;

export interface ReadingProgress {
  /** ID of the first visible paragraph — stable anchor across reloads */
  paragraphId: number;
  /** position index of that paragraph in the book (used to compute which batch to load) */
  paragraphPosition: number;
  /** fractional scroll offset within the paragraph (0.0–1.0), handles single-paragraph books */
  paragraphOffset?: number;
  /** px offset of RU panel from paragraph-synced position */
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

/** Save to localStorage immediately */
export function saveProgress(bookId: number, progress: ReadingProgress): void {
  try { localStorage.setItem(PROGRESS_KEY(bookId), JSON.stringify(progress)); } catch {}
}

/** Persist progress to the server.
 *  keepalive=true ensures the request survives iOS/Safari closing the tab/PWA. */
export async function saveProgressToServer(bookId: number, progress: ReadingProgress): Promise<void> {
  try {
    await fetch(`/api/books/${bookId}/progress`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(progress),
      keepalive: true,
    });
  } catch {
    // silently ignore — localStorage is the fallback
  }
}

/** Load progress from server — server is authoritative */
export async function loadProgressFromServer(bookId: number): Promise<ReadingProgress | null> {
  try {
    const res = await fetch(`/api/books/${bookId}/progress`);
    if (!res.ok) return null;
    const data = await res.json() as {
      paragraphId?: number;
      paragraphPosition?: number;
      paragraphOffset?: number;
      ruOffset?: number;
    };
    if (data.paragraphId == null || data.paragraphPosition == null) return null;
    return {
      paragraphId: data.paragraphId,
      paragraphPosition: data.paragraphPosition,
      paragraphOffset: data.paragraphOffset,
      ruOffset: data.ruOffset,
    };
  } catch {
    return null;
  }
}

export function loadProgress(bookId: number): ReadingProgress | null {
  try {
    const v = localStorage.getItem(PROGRESS_KEY(bookId));
    if (!v) return null;
    const p = JSON.parse(v) as ReadingProgress;
    if (typeof p.paragraphId !== "number" || typeof p.paragraphPosition !== "number") return null;
    return p;
  } catch { return null; }
}
