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
 * Strategy: stale-while-revalidate.
 *   - Return IDB immediately (offline-safe, instant).
 *   - If online, also fetch from network in the background.
 *   - If the network response differs (e.g. translation completed), update IDB
 *     and refresh state so the user sees up-to-date translations.
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

      // 1. Try IDB first — instant, works offline
      let idbData: ParagraphsPage | null = null;
      try {
        idbData = await loadParagraphPage(bookId, page);
        if (idbData && !cancelled) {
          setState({ data: idbData, isSuccess: true, isLoading: false, source: "idb" });
        }
      } catch {
        // IDB unavailable — skip to network only
      }

      // 2. Always try network (stale-while-revalidate):
      //    - If IDB had no data: this is the primary load.
      //    - If IDB had data: this runs in background to check for fresher content
      //      (e.g. translation completed since last cache).
      try {
        const res = await fetch(
          `/api/books/${bookId}/paragraphs?page=${page}&pageSize=${PAGE_SIZE}`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as ParagraphsPage;

        if (cancelled) return;

        // Check if the network data is meaningfully newer than what we showed:
        // compare translated paragraph count so we don't unnecessarily rerender.
        const idbTranslated = idbData?.paragraphs.filter(p => p.translatedText).length ?? -1;
        const netTranslated = data.paragraphs.filter(p => p.translatedText).length;
        const hasNewTranslations = netTranslated > idbTranslated;

        // Save to IDB regardless (keep cache fresh)
        saveParagraphPage(bookId, page, data).catch(() => {});

        // Update state if: we had no data yet, OR network has more translations
        if (!idbData || hasNewTranslations) {
          setState({ data, isSuccess: true, isLoading: false, source: "network" });
        }
      } catch {
        // Offline or request failed — IDB data (if any) was already shown above
        if (!idbData && !cancelled) {
          setState(s => ({ ...s, isLoading: false }));
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [bookId, page, enabled]);

  return state;
}
