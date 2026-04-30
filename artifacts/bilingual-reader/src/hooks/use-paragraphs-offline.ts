import { useEffect, useState } from "react";
import { loadParagraphPage, saveParagraphPage, CachedParagraphsPage } from "@/lib/idb";

type ParagraphsPage = CachedParagraphsPage["data"];

interface Result {
  data: ParagraphsPage | undefined;
  isSuccess: boolean;
  isLoading: boolean;
  source: "idb" | "network" | null;
}

const PAGE_SIZE = 40;

/**
 * Load one batch of paragraphs for a book.
 * Strategy: IndexedDB first (instant, offline), then network fallback.
 * On a network hit, the result is also saved to IDB for future offline use.
 */
export function useParagraphsOffline(
  bookId: number,
  page: number,
  enabled = true,
): Result {
  const [state, setState] = useState<Result>({
    data: undefined,
    isSuccess: false,
    isLoading: false,
    source: null,
  });

  useEffect(() => {
    if (!enabled || !bookId) return;

    let cancelled = false;

    async function load() {
      setState(s => ({ ...s, isLoading: true }));

      // 1. Try IDB first
      try {
        const cached = await loadParagraphPage(bookId, page);
        if (cached && !cancelled) {
          setState({ data: cached, isSuccess: true, isLoading: false, source: "idb" });
          return;
        }
      } catch {
        // IDB unavailable — continue to network
      }

      // 2. Fall back to network
      try {
        const res = await fetch(
          `/api/books/${bookId}/paragraphs?page=${page}&pageSize=${PAGE_SIZE}`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as ParagraphsPage;

        // Save to IDB for next time (including offline)
        saveParagraphPage(bookId, page, data).catch(() => {});

        if (!cancelled) {
          setState({ data, isSuccess: true, isLoading: false, source: "network" });
        }
      } catch {
        if (!cancelled) {
          setState(s => ({ ...s, isLoading: false }));
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [bookId, page, enabled]);

  return state;
}
