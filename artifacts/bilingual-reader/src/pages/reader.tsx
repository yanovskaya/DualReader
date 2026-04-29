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
import { Loader2, ArrowLeft, X, Settings2, ChevronLeft, ChevronRight } from "lucide-react";
import { BookParagraph } from "@/components/book-paragraph";
import { DictionaryPanel } from "@/components/dictionary-panel";
import { splitSentences } from "@/lib/sentences";
import {
  useReaderSettings,
  THEMES,
  FONT_SIZES,
  type Theme,
  type FontSize,
  type ThemeColors,
} from "@/hooks/use-reader-settings";

const PAGE_SIZE = 20;
const WORDS_PER_MINUTE = 200;
const AVG_WORDS_PER_PARAGRAPH = 50;

function storageKey(id: number) { return `lingua_page_${id}`; }
function getSavedPage(id: number) {
  try { return Math.max(1, parseInt(localStorage.getItem(storageKey(id)) || "1", 10) || 1); } catch { return 1; }
}
function savePage(id: number, p: number) {
  try { localStorage.setItem(storageKey(id), String(p)); } catch {}
}

function getRuSentence(text: string | null | undefined, idx: number) {
  if (!text) return null;
  const s = splitSentences(text);
  return s[Math.min(idx, s.length - 1)] ?? null;
}

function estimateMinutes(remainingParas: number) {
  const words = remainingParas * AVG_WORDS_PER_PARAGRAPH;
  const mins = Math.round(words / WORDS_PER_MINUTE);
  if (mins < 1) return "< 1 min left";
  if (mins < 60) return `~${mins} min left`;
  return `~${Math.round(mins / 60)}h left`;
}

type PanelState =
  | { kind: "hidden" }
  | { kind: "paragraph"; paragraph: Paragraph }
  | { kind: "sentence"; word: string; sentence: string; paragraph: Paragraph }
  | { kind: "dict"; word: string; paragraph: Paragraph };

// ─── Theme label button ──────────────────────────────────────────────────────
function ThemeBtn({
  id, label, active, colors, onClick,
}: { id: Theme; label: string; active: boolean; colors: ThemeColors; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? colors.text : "transparent",
        color: active ? colors.bg : colors.muted,
        border: `1px solid ${active ? colors.text : colors.border}`,
        borderRadius: 6,
        padding: "3px 10px",
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );
}

// ─── Main Reader ─────────────────────────────────────────────────────────────
export default function ReaderPage() {
  const { id } = useParams<{ id: string }>();
  const bookId = parseInt(id || "0", 10);

  const { settings, setTheme, setFontSize } = useReaderSettings();
  const colors = THEMES[settings.theme];
  const fs = FONT_SIZES[settings.fontSize];

  const [page, setPage] = useState(() => getSavedPage(bookId));
  const [panel, setPanel] = useState<PanelState>({ kind: "hidden" });
  const [showSettings, setShowSettings] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);

  const mainRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

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

  // Keep panel fresh on refetch
  useEffect(() => {
    if (panel.kind === "hidden" || !paragraphsData?.paragraphs) return;
    const fresh = paragraphsData.paragraphs.find(p => p.id === panel.paragraph.id);
    if (fresh && panel.kind === "paragraph") setPanel({ kind: "paragraph", paragraph: fresh });
  }, [paragraphsData]);

  const goToPage = useCallback((nextPage: number) => {
    const total = paragraphsData?.totalPages ?? 1;
    if (nextPage < 1 || nextPage > total) return;
    setPage(nextPage);
    savePage(bookId, nextPage);
    setPanel({ kind: "hidden" });
    setShowSettings(false);
    mainRef.current?.scrollTo({ top: 0 });
  }, [bookId, paragraphsData?.totalPages]);

  // ── Scroll → auto-hide header ──────────────────────────────────────────────
  const handleScroll = useCallback((e: React.UIEvent) => {
    const el = e.currentTarget as HTMLElement;
    const scrollTop = el.scrollTop;
    const goingDown = scrollTop > lastScrollY.current + 5;
    const goingUp = scrollTop < lastScrollY.current - 5;
    if (goingDown && scrollTop > 80) { setHeaderVisible(false); setShowSettings(false); }
    else if (goingUp) setHeaderVisible(true);
    lastScrollY.current = scrollTop;
  }, []);

  // ── Swipe to navigate pages ────────────────────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    if (Math.abs(dx) > 60 && dy < 80) {
      if (dx < 0) goToPage(page + 1);
      else goToPage(page - 1);
    }
  }, [goToPage, page]);

  // ── Paragraph / word interaction ───────────────────────────────────────────
  const handleParagraphClick = useCallback((p: Paragraph) => {
    setPanel(prev =>
      prev.kind !== "hidden" && prev.paragraph.id === p.id
        ? { kind: "hidden" }
        : { kind: "paragraph", paragraph: p }
    );
    setShowSettings(false);
  }, []);

  const handleWordClick = useCallback((word: string, sentenceIdx: number, p: Paragraph) => {
    const sentence = getRuSentence(p.translatedText, sentenceIdx);
    setPanel(sentence
      ? { kind: "sentence", word, sentence, paragraph: p }
      : { kind: "paragraph", paragraph: p }
    );
    setShowSettings(false);
    setTimeout(() => panelRef.current?.scrollTo({ top: 0 }), 0);
  }, []);

  const handleWordDoubleClick = useCallback((word: string, p: Paragraph) => {
    setPanel({ kind: "dict", word, paragraph: p });
    setShowSettings(false);
    setTimeout(() => panelRef.current?.scrollTo({ top: 0 }), 0);
  }, []);

  // ── Derived values ─────────────────────────────────────────────────────────
  const totalPages = paragraphsData?.totalPages ?? 1;
  const totalParas = book?.totalParagraphs ?? 0;
  const readParas = Math.min((page - 1) * PAGE_SIZE, totalParas);
  const progressPct = totalParas > 0 ? (readParas / totalParas) * 100 : 0;
  const remainingParas = totalParas - readParas;
  const timeLeft = totalParas > 0 ? estimateMinutes(remainingParas) : "";
  const selectedParagraphId = panel.kind !== "hidden" ? panel.paragraph.id : null;
  const selectedWord = panel.kind === "sentence" || panel.kind === "dict" ? panel.word : null;

  if (isLoadingBook) {
    return (
      <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: colors.bg }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: colors.muted }} />
      </div>
    );
  }

  if (!book) {
    return (
      <div style={{ height: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: colors.bg }}>
        <p style={{ color: colors.muted }}>Book not found.</p>
        <Link href="/"><button style={{ color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "6px 16px", background: "transparent", cursor: "pointer" }}>← Library</button></Link>
      </div>
    );
  }

  return (
    <div
      style={{ height: "100dvh", display: "flex", flexDirection: "column", background: colors.bg, color: colors.text, overflow: "hidden" }}
    >
      {/* ── Header (auto-hides on scroll down) ───────────────────────── */}
      <header
        style={{
          flexShrink: 0,
          background: colors.headerBg,
          borderBottom: `1px solid ${colors.border}`,
          backdropFilter: "blur(8px)",
          transform: headerVisible ? "translateY(0)" : "translateY(-100%)",
          transition: "transform 0.25s ease",
          zIndex: 30,
        }}
      >
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 16px", height: 48, display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/">
            <button style={{ height: 32, width: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "transparent", border: "none", cursor: "pointer", color: colors.muted }}>
              <ArrowLeft size={16} />
            </button>
          </Link>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: colors.heading, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{book.title}</p>
            <p style={{ fontSize: 11, color: colors.muted, margin: 0 }}>
              {Math.round(progressPct)}% &nbsp;·&nbsp; p.{page}/{totalPages} &nbsp;·&nbsp; {timeLeft}
              {isTranslating && <> &nbsp;· <span style={{ color: "#d97706" }}><Loader2 size={10} style={{ display: "inline", verticalAlign: "middle", animation: "spin 1s linear infinite" }} /> {Math.round(statusData?.progressPercent || 0)}% translated</span></>}
            </p>
          </div>

          <button
            onClick={() => setShowSettings(s => !s)}
            style={{ height: 32, width: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: showSettings ? colors.hover : "transparent", border: "none", cursor: "pointer", color: colors.muted }}
          >
            <Settings2 size={16} />
          </button>
        </div>

        {/* ── Settings panel ─── */}
        {showSettings && (
          <div style={{ background: colors.panelBg, borderTop: `1px solid ${colors.border}`, padding: "10px 16px" }}>
            <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
              {/* Font size */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: colors.muted }}>A</span>
                {(["sm", "md", "lg", "xl"] as FontSize[]).map(sz => (
                  <button
                    key={sz}
                    onClick={() => setFontSize(sz)}
                    style={{
                      width: 8, height: 8, borderRadius: "50%", border: "none", cursor: "pointer",
                      background: settings.fontSize === sz ? colors.text : colors.border,
                      padding: 0,
                    }}
                  />
                ))}
                <span style={{ fontSize: 17, color: colors.muted }}>A</span>
              </div>

              <div style={{ width: 1, height: 20, background: colors.border }} />

              {/* Theme */}
              <div style={{ display: "flex", gap: 6 }}>
                <ThemeBtn id="light" label="Светлая" active={settings.theme === "light"} colors={colors} onClick={() => setTheme("light")} />
                <ThemeBtn id="sepia" label="Сепия" active={settings.theme === "sepia"} colors={colors} onClick={() => setTheme("sepia")} />
                <ThemeBtn id="dark" label="Тёмная" active={settings.theme === "dark"} colors={colors} onClick={() => setTheme("dark")} />
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ── Translation panel ─────────────────────────────────────────── */}
      {panel.kind !== "hidden" && (
        <div
          style={{
            flexShrink: 0,
            background: colors.panelBg,
            borderBottom: `2px solid ${colors.border}`,
            zIndex: 20,
          }}
        >
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 16px" }}>
              <div
                ref={panelRef}
                style={{
                  flex: 1,
                  minWidth: 0,
                  maxHeight: 44,
                  overflowY: "scroll",
                  WebkitOverflowScrolling: "touch" as never,
                  lineHeight: "22px",
                }}
              >
                {panel.kind === "paragraph" ? (
                  panel.paragraph.isTranslated && panel.paragraph.translatedText ? (
                    <p style={{ margin: 0, fontSize: 14, fontFamily: "Georgia, serif", color: colors.text, lineHeight: "22px" }}>
                      {panel.paragraph.translatedText}
                    </p>
                  ) : (
                    <p style={{ margin: 0, fontSize: 14, color: colors.muted, fontStyle: "italic", display: "flex", alignItems: "center", gap: 6, lineHeight: "22px" }}>
                      <Loader2 size={12} style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
                      Перевод ещё не готов...
                    </p>
                  )
                ) : panel.kind === "sentence" ? (
                  <div style={{ lineHeight: "22px" }}>
                    <p style={{ margin: 0, fontSize: 14, fontFamily: "Georgia, serif", color: colors.text }}>
                      <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#10b981", marginRight: 6, verticalAlign: "middle" }} />
                      {panel.sentence}
                    </p>
                    {panel.paragraph.translatedText && panel.paragraph.translatedText.trim() !== panel.sentence.trim() && (
                      <p style={{ margin: "2px 0 0 13px", fontSize: 14, fontFamily: "Georgia, serif", color: colors.muted }}>
                        {panel.paragraph.translatedText}
                      </p>
                    )}
                  </div>
                ) : (
                  <DictionaryPanel
                    word={panel.word}
                    context={panel.paragraph.originalText}
                    onClose={() => setPanel({ kind: "hidden" })}
                    inline
                    textColor={colors.text}
                    mutedColor={colors.muted}
                  />
                )}
              </div>

              <button
                onClick={() => setPanel({ kind: "hidden" })}
                style={{ height: 22, width: 22, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "transparent", border: "none", cursor: "pointer", color: colors.muted, flexShrink: 0 }}
              >
                <X size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reading area ─────────────────────────────────────────────── */}
      <main
        ref={mainRef}
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" as never }}
      >
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 20px 32px" }}>
          {isLoadingParagraphs ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
              <Loader2 size={24} style={{ animation: "spin 1s linear infinite", color: colors.muted }} />
            </div>
          ) : paragraphsData?.paragraphs?.length ? (
            <div>
              {paragraphsData.paragraphs.map(p => (
                <BookParagraph
                  key={p.id}
                  paragraph={p}
                  isSelected={selectedParagraphId === p.id}
                  selectedWord={selectedParagraphId === p.id ? selectedWord : null}
                  onClick={handleParagraphClick}
                  onWordClick={handleWordClick}
                  onWordDoubleClick={handleWordDoubleClick}
                  colors={colors}
                  bodyFontSize={fs.body}
                  headingFontSize={fs.heading}
                />
              ))}
            </div>
          ) : (
            <p style={{ textAlign: "center", color: colors.muted, fontStyle: "italic", padding: "80px 0" }}>Текст не найден.</p>
          )}
        </div>

        {/* Page navigation */}
        {totalPages > 1 && (
          <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 20px 40px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page === 1}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                fontSize: 14, color: page === 1 ? colors.border : colors.muted,
                background: "transparent", border: "none", cursor: page === 1 ? "not-allowed" : "pointer", padding: "8px 0",
              }}
            >
              <ChevronLeft size={16} /> Назад
            </button>
            <span style={{ fontSize: 12, color: colors.muted }}>{page} / {totalPages}</span>
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page === totalPages}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                fontSize: 14, color: page === totalPages ? colors.border : colors.muted,
                background: "transparent", border: "none", cursor: page === totalPages ? "not-allowed" : "pointer", padding: "8px 0",
              }}
            >
              Вперёд <ChevronRight size={16} />
            </button>
          </div>
        )}
      </main>

      {/* ── Progress bar (fixed at very bottom) ───────────────────────── */}
      <div style={{ flexShrink: 0, height: 3, background: colors.border }}>
        <div style={{ height: "100%", width: `${progressPct}%`, background: "#10b981", transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}
