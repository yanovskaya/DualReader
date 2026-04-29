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
import { Loader2, ChevronLeft, ChevronRight, X, BookOpen, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookParagraph } from "@/components/book-paragraph";
import { DictionaryPanel } from "@/components/dictionary-panel";

const PAGE_SIZE = 20;

function storageKey(bookId: number) { return `lingua_page_${bookId}`; }

function getSavedPage(bookId: number): number {
  try { return parseInt(localStorage.getItem(storageKey(bookId)) || "1", 10) || 1; } catch { return 1; }
}
function savePage(bookId: number, page: number) {
  try { localStorage.setItem(storageKey(bookId), String(page)); } catch {}
}

export default function ReaderPage() {
  const { id } = useParams<{ id: string }>();
  const bookId = parseInt(id || "0", 10);

  const [page, setPage] = useState(() => getSavedPage(bookId));
  const [selectedParagraph, setSelectedParagraph] = useState<Paragraph | null>(null);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [showDict, setShowDict] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

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

  const isTranslating =
    statusData?.status === "in_progress" || statusData?.status === "pending";

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

  // Keep selectedParagraph fresh when paragraphs refetch
  useEffect(() => {
    if (!selectedParagraph || !paragraphsData?.paragraphs) return;
    const fresh = paragraphsData.paragraphs.find((p) => p.id === selectedParagraph.id);
    if (fresh) setSelectedParagraph(fresh);
  }, [paragraphsData]);

  const goToPage = useCallback(
    (nextPage: number) => {
      setPage(nextPage);
      savePage(bookId, nextPage);
      setSelectedParagraph(null);
      setSelectedWord(null);
      setShowDict(false);
      mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    },
    [bookId]
  );

  const handleParagraphClick = useCallback((p: Paragraph) => {
    setSelectedParagraph((prev) => (prev?.id === p.id ? null : p));
    setSelectedWord(null);
    setShowDict(false);
  }, []);

  const handleWordDoubleClick = useCallback((word: string, p: Paragraph) => {
    setSelectedParagraph(p);
    setSelectedWord(word);
    setShowDict(true);
  }, []);

  const closePanel = () => {
    setSelectedParagraph(null);
    setSelectedWord(null);
    setShowDict(false);
  };

  const progress = book
    ? Math.round(((page - 1) * PAGE_SIZE / Math.max(book.totalParagraphs, 1)) * 100)
    : 0;

  const totalPages = paragraphsData?.totalPages ?? 1;

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
        <Link href="/">
          <Button variant="outline" size="sm">Back to Library</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#faf9f6] overflow-hidden">
      {/* ── Top bar ── */}
      <header className="shrink-0 bg-[#faf9f6]/95 backdrop-blur border-b border-border/40 z-20">
        <div className="max-w-2xl mx-auto px-4 h-12 flex items-center gap-3">
          <Link href="/">
            <button className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </button>
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate leading-none">{book.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {progress}% &mdash; page {page} of {totalPages}
            </p>
          </div>
          {isTranslating && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>{Math.round(statusData?.progressPercent || 0)}% translated</span>
            </div>
          )}
        </div>
      </header>

      {/* ── Translation panel (sticky, slides in below header) ── */}
      {selectedParagraph && (
        <div className="shrink-0 bg-primary/5 border-b-2 border-primary/20 z-10">
          <div className="max-w-2xl mx-auto px-4 py-3">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                {showDict && selectedWord ? (
                  <DictionaryPanel
                    word={selectedWord}
                    context={selectedParagraph.originalText}
                    onClose={() => { setShowDict(false); setSelectedWord(null); }}
                  />
                ) : selectedParagraph.isTranslated && selectedParagraph.translatedText ? (
                  <p className="text-sm leading-relaxed text-foreground/90 font-serif">
                    {selectedParagraph.translatedText}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Translation in progress...
                  </p>
                )}
              </div>
              <button
                onClick={closePanel}
                className="h-6 w-6 shrink-0 rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors mt-0.5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main reading area ── */}
      <main ref={mainRef} className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8">
          {isLoadingParagraphs ? (
            <div className="flex justify-center py-32">
              <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
            </div>
          ) : paragraphsData?.paragraphs?.length ? (
            <div className="space-y-1">
              {paragraphsData.paragraphs.map((p) => (
                <BookParagraph
                  key={p.id}
                  paragraph={p}
                  isSelected={selectedParagraph?.id === p.id}
                  selectedWord={selectedParagraph?.id === p.id ? selectedWord : null}
                  onClick={handleParagraphClick}
                  onWordDoubleClick={handleWordDoubleClick}
                />
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground font-serif italic py-32">No text found.</p>
          )}
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="max-w-2xl mx-auto px-6 pb-10 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => goToPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="gap-1.5"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => goToPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="gap-1.5"
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
