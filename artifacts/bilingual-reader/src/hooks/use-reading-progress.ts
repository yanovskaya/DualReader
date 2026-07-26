const LAST_BOOK_KEY = "lingua_last_book";
const RECENT_BOOKS_KEY = "lingua_recent_books";
const BOOKMARK_KEY = (bookId: number) => `lingua_bookmark_${bookId}`;

export interface Bookmark {
  paragraphId: number;
  paragraphPosition: number;
  paragraphOffset?: number;
  ruOffset?: number;
}

/** Records that a book was just opened, pushing it to the front of the recent list. */
export function recordBookOpened(bookId: number): void {
  try {
    localStorage.setItem(LAST_BOOK_KEY, String(bookId));
    const raw = localStorage.getItem(RECENT_BOOKS_KEY);
    const list: number[] = raw ? (JSON.parse(raw) as number[]) : [];
    const filtered = list.filter(id => id !== bookId);
    filtered.unshift(bookId);
    localStorage.setItem(RECENT_BOOKS_KEY, JSON.stringify(filtered.slice(0, 100)));
  } catch {}
}

/** Returns book IDs ordered by most-recently-opened (index 0 = newest). */
export function getRecentBookOrder(): number[] {
  try {
    const raw = localStorage.getItem(RECENT_BOOKS_KEY);
    return raw ? (JSON.parse(raw) as number[]) : [];
  } catch { return []; }
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

export function saveBookmark(bookId: number, bookmark: Bookmark): void {
  try { localStorage.setItem(BOOKMARK_KEY(bookId), JSON.stringify(bookmark)); } catch {}
}

export async function saveBookmarkToServer(bookId: number, bookmark: Bookmark): Promise<void> {
  try {
    await fetch(`/api/books/${bookId}/progress`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bookmark),
      keepalive: true,
    });
  } catch {}
}

export async function loadBookmarkFromServer(bookId: number): Promise<Bookmark | null> {
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

export function loadBookmark(bookId: number): Bookmark | null {
  try {
    const v = localStorage.getItem(BOOKMARK_KEY(bookId));
    if (!v) return null;
    const b = JSON.parse(v) as Bookmark;
    if (typeof b.paragraphId !== "number" || typeof b.paragraphPosition !== "number") return null;
    return b;
  } catch { return null; }
}
