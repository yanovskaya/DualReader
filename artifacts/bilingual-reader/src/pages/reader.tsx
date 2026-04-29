import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "wouter";
import {
  useGetBook,
  getGetBookQueryKey,
  useListParagraphs,
  getListParagraphsQueryKey,
  useGetTranslationStatus,
  getGetTranslationStatusQueryKey,
} from "@workspace/api-client-react";
import type { Paragraph } from "@workspace/api-client-react/src/generated/api.schemas";
import { Loader2, ChevronLeft, ChevronRight, BookOpen, ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookParagraph } from "@/components/book-paragraph";
import { DictionaryPanel } from "@/components/dictionary-panel";
import { splitSentences } from "@/lib/sentences";

const PAGE_SIZE = 20;

function storageKey(bookId: number) { return `lingua_page_${bookId}`; }
function getSavedPage(bookId: number): number {
  try { return Math.max(1, parseInt(localStorage.getItem(storageKey(bookId)) || "1", 10) || 1); } catch { return 1; }
}
function savePage(bookId: number, page: number) {
  try { localStorage.setItem(storageKey(bookId), String(page)); } catch {}
}

/** Extract the Nth sentence from a translation, clamped to available sentences */
function getRuSentence(translatedText: string | null | undefined, sentenceIdx: number): string | null {
  if (!translatedText) return null;
  const sentences = splitSentences(translatedText);
  if (sentences.length === 0) return translatedText;
  return sentences[Math.min(sentenceIdx, sentences.length - 1)];
}

type PanelState =
  | { kind: "hidden" }
  | { kind: "paragraph"; paragraph: Paragraph }
  | { kind: "sentence"; word: string; sentence: string; paragraph: Paragraph }
  | { kind: "dict"; word: string; paragraph: Paragraph };

export default function ReaderPage() {
  const { id } = useParams<{ id: string }>();
  const bookId = parseInt(id || "0", 10);

  const [page, setPage] = useState(() => getSavedPage(bookId));
  const [panel, setPanel] = useState<PanelState>({ kind: "hidden" });
  const mainRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: book, isLoading: isLoadingBook } = useGetBook(bookId, {
    query: { enabled: !!bookId, queryKey: getGetBookQueryKey(bookId) },
  });

  const { data: statusData } = useGetTranslationStatus(bookId, {
    query: {
      enabled: !!bookId,
      queryKey: getGetTranslationStatusQueryKey(bookId),
      refetchInterval: (d) =>
        d?.state?.data?.status === "in_progress" || d?.state?.data?.status === "pending" ? 4000 : false,
    },
  });

  const isTranslating = statusData?.status === "in_progress" || statusData?.status === "pending";

  const { data: paragraphsData, isLoading: isLoadingParagraphs } = useListParagraphs(
    bookId,
    { page, pageSize: PAGE_SIZE },
    {
      query: {
        enabled: !!bookId,
        queryKey: getListParagraphsQueryKey(bookId, { page, pageSize: PAGE_SIZE }),
        refetchInterval: isTranslating ? 4000 : false,
      },
    }
  );

  // Keep panel paragraph fresh when paragraphs refetch
  useEffect(() => {
    if (panel.kind === "hidden" || !paragraphsData?.paragraphs) return;
    const fresh = paragraphsData.paragraphs.find((p) => p.id === panel.paragraph.id);
    if (fresh && panel.kind === "paragraph") setPanel({ kind: "paragraph", paragraph: fresh });
  }, [paragraphsData]);

  const goToPage = useCallback(
    (nextPage: number) => {
      setPage(nextPage);
      savePage(bookId, nextPage);
      setPanel({ kind: "hidden" });
      mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    },
    [bookId]
  );

  // Single click on paragraph (no word) → show full paragraph translation
  const handleParagraphClick = useCallback((p: Paragraph) => {
    setPanel((prev) =>
      prev.kind !== "hidden" && prev.paragraph.id === p.id
        ? { kind: "hidden" }
        : { kind: "paragraph", paragraph: p }
    );
  }, []);

  // Single click on word → show Russian sentence containing that word
  const handleWordClick = useCallback((word: string, sentenceIdx: number, p: Paragraph) => {
    const sentence = getRuSentence(p.translatedText, sentenceIdx);
    if (sentence) {
      setPanel({ kind: "sentence", word, sentence, paragraph: p });
    } else {
      // Translation not ready yet — show paragraph panel
      setPanel({ kind: "paragraph", paragraph: p });
    }
    // Scroll panel to top so user sees the sentence immediately
    setTimeout(() => panelRef.current?.scrollTo({ top: 0 }), 0);
  }, []);

  // Double click on word → dictionary
  const handleWordDoubleClick = useCallback((word: string, p: Paragraph) => {
    setPanel({ kind: "dict", word, paragraph: p });
    setTimeout(() => panelRef.current?.scrollTo({ top: 0 }), 0);
  }, []);

  const progress = book
    ? Math.round(((page - 1) * PAGE_SIZE) / Math.max(book.totalParagraphs, 1) * 100)
    : 0;
  const totalPages = paragraphsData?.totalPages ?? 1;

  const selectedParagraphId =
    panel.kind !== "hidden" ? panel.paragraph.id : null;
  const selectedWord =
    panel.kind === "sentence" || panel.kind === "dict" ? panel.word : null;

  if (isLoadingBook) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#faf9f6]">
        <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
      </div>
    );
  }

  if (!book) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4 bg-[#faf9f6]">
        <BookOpen className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-muted-foreground">Book not found.</p>
        <Link href="/"><Button variant="outline" size="sm">Back to Library</Button></Link>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#faf9f6] overflow-hidden">

      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <header className="shrink-0 bg-[#faf9f6]/95 backdrop-blur border-b border-border/40 z-20">
        <div className="max-w-2xl mx-auto px-4 h-11 flex items-center gap-3">
          <Link href="/">
            <button className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </button>
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate leading-none">{book.title}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-none">
              {progress}% &nbsp;—&nbsp; page {page} of {totalPages}
            </p>
          </div>
          {isTranslating && (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-600">
              <Loader2 className="h-3 w-3 animate-spin" />
              {Math.round(statusData?.progressPercent || 0)}% translated
            </div>
          )}
        </div>
      </header>

      {/* ── Translation / Dictionary panel ───────────────────────────── */}
      {panel.kind !== "hidden" && (
        <div className="shrink-0 bg-white border-b-2 border-primary/15 shadow-sm z-10">
          <div className="max-w-2xl mx-auto px-4 py-0">
            <div className="flex items-start gap-2 py-2.5">
              {/* scrollable text area — exactly 2 lines tall */}
              <div
                ref={panelRef}
                style={{ maxHeight: "3.1em", lineHeight: "1.55em", overflowY: "auto" }}
                className="flex-1 min-w-0 scrollbar-thin"
              >
                {panel.kind === "paragraph" ? (
                  panel.paragraph.isTranslated && panel.paragraph.translatedText ? (
                    <p className="text-sm text-foreground/90 font-serif leading-[1.55em]">
                      {panel.paragraph.translatedText}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic flex items-center gap-1.5 leading-[1.55em]">
                      <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                      Перевод ещё не готов...
                    </p>
                  )
                ) : panel.kind === "sentence" ? (
                  <p className="text-sm text-foreground/90 font-serif leading-[1.55em]">
                    <span className="inline-flex items-center gap-1 mr-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0 inline-block" />
                    </span>
                    {panel.sentence}
                  </p>
                ) : (
                  /* dict */
                  <DictionaryPanel
                    word={panel.word}
                    context={panel.paragraph.originalText}
                    onClose={() => setPanel({ kind: "hidden" })}
                    inline
                  />
                )}
              </div>

              {panel.kind !== "dict" && (
                <button
                  onClick={() => setPanel({ kind: "hidden" })}
                  className="h-5 w-5 shrink-0 rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors mt-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Reading area ─────────────────────────────────────────────── */}
      <main ref={mainRef} className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-6">
          {isLoadingParagraphs ? (
            <div className="flex justify-center py-32">
              <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
            </div>
          ) : paragraphsData?.paragraphs?.length ? (
            <div>
              {paragraphsData.paragraphs.map((p) => (
                <BookParagraph
                  key={p.id}
                  paragraph={p}
                  isSelected={selectedParagraphId === p.id}
                  selectedWord={selectedParagraphId === p.id ? selectedWord : null}
                  onClick={handleParagraphClick}
                  onWordClick={handleWordClick}
                  onWordDoubleClick={handleWordDoubleClick}
                />
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground font-serif italic py-32">Текст не найден.</p>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="max-w-2xl mx-auto px-6 pb-8 flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => goToPage(Math.max(1, page - 1))} disabled={page === 1} className="gap-1.5">
              <ChevronLeft className="h-4 w-4" /> Назад
            </Button>
            <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
            <Button variant="ghost" size="sm" onClick={() => goToPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="gap-1.5">
              Вперёд <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
