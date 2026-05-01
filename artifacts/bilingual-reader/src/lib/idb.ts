// IndexedDB helper for offline paragraph storage
// Stores translated paragraphs locally so the reader works without internet

const DB_NAME = "lingua-offline";
const DB_VERSION = 1;
const STORE_PARAGRAPHS = "paragraphs";
const STORE_BOOKS = "books";

export interface CachedParagraphsPage {
  key: string;          // `${bookId}:${page}`
  bookId: number;
  page: number;
  data: {
    paragraphs: Array<{
      id: number;
      bookId: number;
      position: number;
      originalText: string;
      translatedText: string | null;
      isTranslated: boolean;
    }>;
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  cachedAt: number;
}

export interface CachedBook {
  id: number;
  title: string;
  author: string | null;
  language: string;
  totalParagraphs: number;
  translatedParagraphs: number;
  translationStatus: string;
  cachedAt: number;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PARAGRAPHS)) {
        db.createObjectStore(STORE_PARAGRAPHS, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(STORE_BOOKS)) {
        db.createObjectStore(STORE_BOOKS, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(
  db: IDBDatabase,
  store: string,
  mode: IDBTransactionMode,
): IDBObjectStore {
  return db.transaction(store, mode).objectStore(store);
}

// ── Paragraphs ──────────────────────────────────────────────────────────────

export async function saveParagraphPage(
  bookId: number,
  page: number,
  data: CachedParagraphsPage["data"],
): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = tx(db, STORE_PARAGRAPHS, "readwrite").put({
      key: `${bookId}:${page}`,
      bookId,
      page,
      data,
      cachedAt: Date.now(),
    } satisfies CachedParagraphsPage);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function loadParagraphPage(
  bookId: number,
  page: number,
): Promise<CachedParagraphsPage["data"] | null> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = tx(db, STORE_PARAGRAPHS, "readonly").get(`${bookId}:${page}`);
    req.onsuccess = () => {
      const record = req.result as CachedParagraphsPage | undefined;
      resolve(record?.data ?? null);
    };
    req.onerror = () => reject(req.error);
  });
}

/** Returns true if every page for the book is already in IDB */
export async function isBookFullyCached(
  bookId: number,
  totalPages: number,
): Promise<boolean> {
  if (totalPages === 0) return false;
  const db = await open();
  const checks = Array.from({ length: totalPages }, (_, i) =>
    new Promise<boolean>((resolve, reject) => {
      const req = tx(db, STORE_PARAGRAPHS, "readonly").count(
        IDBKeyRange.only(`${bookId}:${i + 1}`),
      );
      req.onsuccess = () => resolve(req.result > 0);
      req.onerror = () => reject(req.error);
    }),
  );
  const results = await Promise.all(checks);
  return results.every(Boolean);
}

// ── Books ────────────────────────────────────────────────────────────────────

export async function saveBook(book: CachedBook): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = tx(db, STORE_BOOKS, "readwrite").put({
      ...book,
      cachedAt: Date.now(),
    });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function loadBook(bookId: number): Promise<CachedBook | null> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = tx(db, STORE_BOOKS, "readonly").get(bookId);
    req.onsuccess = () => resolve((req.result as CachedBook) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function loadAllBooks(): Promise<CachedBook[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = tx(db, STORE_BOOKS, "readonly").getAll();
    req.onsuccess = () => resolve((req.result as CachedBook[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

/** Delete all cached data for a book */
export async function deleteBookCache(bookId: number): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const req = tx(db, STORE_BOOKS, "readwrite").delete(bookId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  // Delete all pages — iterate keys starting with `${bookId}:`
  await new Promise<void>((resolve, reject) => {
    const store = tx(db, STORE_PARAGRAPHS, "readwrite");
    const range = IDBKeyRange.bound(`${bookId}:`, `${bookId}:\uffff`);
    const cursor = store.openCursor(range);
    cursor.onsuccess = () => {
      const c = cursor.result;
      if (!c) { resolve(); return; }
      c.delete();
      c.continue();
    };
    cursor.onerror = () => reject(cursor.error);
  });
}
