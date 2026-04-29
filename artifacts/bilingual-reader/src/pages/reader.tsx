import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "wouter";
import {
  useGetBook,
  getGetBookQueryKey,
  useListParagraphs,
  getListParagraphsQueryKey,
  useGetTranslationStatus,
  getGetTranslationStatusQueryKey,
  useLookupWord,
  getLookupWordQueryKey,
} from "@workspace/api-client-react";
import type { Paragraph } from "@workspace/api-client-react/src/generated/api.schemas";
import { Loader2, ArrowLeft, X, Settings2, ChevronLeft, ChevronRight } from "lucide-react";
import { BookParagraph, type SelectedToken } from "@/components/book-paragraph";
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
const AVG_WORDS_PER_PARA = 50;

function pgKey(id: number) { return `lingua_page_${id}`; }
function getSaved(id: number) { try { return Math.max(1, parseInt(localStorage.getItem(pgKey(id)) || "1") || 1); } catch { return 1; } }
function savePg(id: number, p: number) { try { localStorage.setItem(pgKey(id), String(p)); } catch {} }

function ruSentenceAt(text: string | null | undefined, idx: number) {
  if (!text) return null;
  const s = splitSentences(text);
  return s[Math.min(idx, s.length - 1)] ?? null;
}

function timeLeft(remaining: number) {
  const m = Math.round(remaining * AVG_WORDS_PER_PARA / WORDS_PER_MINUTE);
  if (m < 1) return "< 1 min";
  if (m < 60) return `~${m} min`;
  return `~${Math.round(m / 60)}h`;
}

// ── Russian sentence with the translated word highlighted ─────────────────────
function SentencePanel({
  word, sentence, translatedText,
  textColor, mutedColor,
}: {
  word: string;
  sentence: string;
  translatedText: string | null | undefined;
  textColor: string;
  mutedColor: string;
}) {
  const clean = word.toLowerCase().replace(/[^\w-]/g, "");
  const { data: entry } = useLookupWord(
    { params: { word: clean } },
    { query: { enabled: !!clean, queryKey: getLookupWordQueryKey({ word: clean }) } }
  );

  const translations = entry?.translations ?? [];

  // Try to find a Russian translation word inside the sentence
  function renderHighlighted(text: string) {
    for (const t of translations) {
      // Try the full translation phrase then individual words
      const candidates = [t, ...t.split(/[\s,;]+/).filter(w => w.length > 3)];
      for (const candidate of candidates) {
        const lc = text.toLowerCase();
        const idx = lc.indexOf(candidate.toLowerCase());
        if (idx !== -1) {
          return (
            <>
              {text.slice(0, idx)}
              <mark style={{ background: "#bbf7d0", color: "#14532d", borderRadius: 3, padding: "0 1px", fontStyle: "normal" }}>
                {text.slice(idx, idx + candidate.length)}
              </mark>
              {text.slice(idx + candidate.length)}
            </>
          );
        }
      }
    }
    return text;
  }

  // Only show full paragraph below if it has more than one sentence
  const ruSentences = splitSentences(translatedText || "");
  const showFull = ruSentences.length > 1;

  return (
    <div style={{ lineHeight: "22px" }}>
      {/* Word hint: English → Russian */}
      {translations.length > 0 && (
        <p style={{ margin: "0 0 1px 0", fontSize: 12, color: mutedColor }}>
          <span style={{ fontWeight: 700, color: textColor }}>{word}</span>
          {" → "}
          {translations.slice(0, 5).join(", ")}
        </p>
      )}
      {/* Matched Russian sentence with green dot and highlighted word */}
      <p style={{ margin: 0, fontSize: 14, fontFamily: "Georgia, serif", color: textColor }}>
        <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#10b981", marginRight: 6, verticalAlign: "middle" }} />
        {renderHighlighted(sentence)}
      </p>
      {/* Full paragraph translation (only if it has more sentences) */}
      {showFull && translatedText && (
        <p style={{ margin: "2px 0 0 13px", fontSize: 13, fontFamily: "Georgia, serif", color: mutedColor }}>
          {translatedText}
        </p>
      )}
    </div>
  );
}

// ── Theme label button ────────────────────────────────────────────────────────
function ThemeBtn({ label, active, colors, onClick }: { label: string; active: boolean; colors: ThemeColors; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      background: active ? colors.text : "transparent",
      color: active ? colors.bg : colors.muted,
      border: `1px solid ${active ? colors.text : colors.border}`,
      borderRadius: 6, padding: "3px 10px", fontSize: 13,
      fontWeight: active ? 600 : 400, cursor: "pointer", transition: "all 0.15s",
    }}>
      {label}
    </button>
  );
}

type PanelState =
  | { kind: "hidden" }
  | { kind: "paragraph"; paragraph: Paragraph }
  | { kind: "sentence"; word: string; sentence: string; paragraph: Paragraph }
  | { kind: "dict"; word: string; paragraph: Paragraph };

// ── Main Reader ───────────────────────────────────────────────────────────────
export default function ReaderPage() {
  const { id } = useParams<{ id: string }>();
  const bookId = parseInt(id || "0", 10);

  const { settings, setTheme, setFontSize } = useReaderSettings();
  const colors = THEMES[settings.theme];
  const fs = FONT_SIZES[settings.fontSize];

  const [page, setPage] = useState(() => getSaved(bookId));
  const [panel, setPanel] = useState<PanelState>({ kind: "hidden" });
  const [selectedToken, setSelectedToken] = useState<SelectedToken | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);

  const mainRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);
  const touchX = useRef(0);
  const touchY = useRef(0);

  const { data: book, isLoading: isLoadingBook } = useGetBook(bookId, {
    query: { enabled: !!bookId, queryKey: getGetBookQueryKey(bookId) },
  });

  const { data: statusData } = useGetTranslationStatus(bookId, {
    query: {
      enabled: !!bookId,
      queryKey: getGetTranslationStatusQueryKey(bookId),
      refetchInterval: d =>
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
    savePg(bookId, nextPage);
    setPanel({ kind: "hidden" });
    setSelectedToken(null);
    setShowSettings(false);
    mainRef.current?.scrollTo({ top: 0 });
  }, [bookId, paragraphsData?.totalPages]);

  const handleScroll = useCallback((e: React.UIEvent) => {
    const el = e.currentTarget as HTMLElement;
    const top = el.scrollTop;
    if (top > lastScrollY.current + 5 && top > 80) { setHeaderVisible(false); setShowSettings(false); }
    else if (top < lastScrollY.current - 5) setHeaderVisible(true);
    lastScrollY.current = top;
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchX.current = e.touches[0].clientX;
    touchY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - touchY.current);
    if (Math.abs(dx) > 60 && dy < 80) {
      if (dx < 0) goToPage(page + 1);
      else goToPage(page - 1);
    }
  }, [goToPage, page]);

  const handleParagraphClick = useCallback((p: Paragraph) => {
    setSelectedToken(null);
    setPanel(prev => prev.kind !== "hidden" && prev.paragraph.id === p.id ? { kind: "hidden" } : { kind: "paragraph", paragraph: p });
    setShowSettings(false);
  }, []);

  const handleWordClick = useCallback((word: string, sentenceIdx: number, charStart: number, p: Paragraph) => {
    setSelectedToken({ paragraphId: p.id, charStart, word });
    const sentence = ruSentenceAt(p.translatedText, sentenceIdx);
    setPanel(sentence ? { kind: "sentence", word, sentence, paragraph: p } : { kind: "paragraph", paragraph: p });
    setShowSettings(false);
    setTimeout(() => panelRef.current?.scrollTo({ top: 0 }), 0);
  }, []);

  const handleWordDoubleClick = useCallback((word: string, p: Paragraph) => {
    setSelectedToken(null);
    setPanel({ kind: "dict", word, paragraph: p });
    setShowSettings(false);
    setTimeout(() => panelRef.current?.scrollTo({ top: 0 }), 0);
  }, []);

  const closePanel = useCallback(() => {
    setPanel({ kind: "hidden" });
    setSelectedToken(null);
  }, []);

  const totalPages = paragraphsData?.totalPages ?? 1;
  const totalParas = book?.totalParagraphs ?? 0;
  const readParas = Math.min((page - 1) * PAGE_SIZE, totalParas);
  const progressPct = totalParas > 0 ? (readParas / totalParas) * 100 : 0;
  const remaining = totalParas - readParas;

  if (isLoadingBook) {
    return <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: colors.bg }}>
      <Loader2 size={28} style={{ color: colors.muted, animation: "spin 1s linear infinite" }} />
    </div>;
  }

  if (!book) {
    return <div style={{ height: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: colors.bg }}>
      <p style={{ color: colors.muted }}>Book not found.</p>
      <Link href="/"><button style={{ color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "6px 16px", background: "transparent", cursor: "pointer" }}>← Library</button></Link>
    </div>;
  }

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: colors.bg, color: colors.text, overflow: "hidden" }}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header style={{
        flexShrink: 0,
        background: colors.headerBg,
        borderBottom: `1px solid ${colors.border}`,
        backdropFilter: "blur(8px)",
        transform: headerVisible ? "translateY(0)" : "translateY(-100%)",
        transition: "transform 0.25s ease",
        zIndex: 30,
      }}>
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 16px", height: 48, display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/">
            <button style={{ height: 32, width: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "transparent", border: "none", cursor: "pointer", color: colors.muted }}>
              <ArrowLeft size={16} />
            </button>
          </Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: colors.heading, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{book.title}</p>
            <p style={{ fontSize: 11, color: colors.muted, margin: 0 }}>
              {Math.round(progressPct)}% · p.{page}/{totalPages} · {timeLeft(remaining)}
              {isTranslating && <> · <span style={{ color: "#d97706" }}>
                <Loader2 size={10} style={{ display: "inline", verticalAlign: "middle", animation: "spin 1s linear infinite" }} />
                {" "}{Math.round(statusData?.progressPercent || 0)}% tr.
              </span></>}
            </p>
          </div>
          <button onClick={() => setShowSettings(s => !s)} style={{ height: 32, width: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: showSettings ? colors.hover : "transparent", border: "none", cursor: "pointer", color: colors.muted }}>
            <Settings2 size={16} />
          </button>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div style={{ background: colors.panelBg, borderTop: `1px solid ${colors.border}`, padding: "10px 16px" }}>
            <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, color: colors.muted }}>A</span>
                {(["sm", "md", "lg", "xl"] as FontSize[]).map(sz => (
                  <button key={sz} onClick={() => setFontSize(sz)} style={{
                    width: 9, height: 9, borderRadius: "50%", border: "none", cursor: "pointer", padding: 0,
                    background: settings.fontSize === sz ? colors.text : colors.border,
                  }} />
                ))}
                <span style={{ fontSize: 18, color: colors.muted }}>A</span>
              </div>
              <div style={{ width: 1, height: 20, background: colors.border }} />
              <div style={{ display: "flex", gap: 6 }}>
                <ThemeBtn label="Светлая" active={settings.theme === "light"} colors={colors} onClick={() => setTheme("light")} />
                <ThemeBtn label="Сепия"   active={settings.theme === "sepia"} colors={colors} onClick={() => setTheme("sepia")} />
                <ThemeBtn label="Тёмная"  active={settings.theme === "dark"}  colors={colors} onClick={() => setTheme("dark")} />
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ── Translation panel — 3 lines (66 px) with scroll ─────────── */}
      {panel.kind !== "hidden" && (
        <div style={{ flexShrink: 0, background: colors.panelBg, borderBottom: `2px solid ${colors.border}`, zIndex: 20 }}>
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "7px 16px" }}>
              <div
                ref={panelRef}
                style={{ flex: 1, minWidth: 0, maxHeight: 66, overflowY: "scroll", WebkitOverflowScrolling: "touch" as never }}
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
                  <SentencePanel
                    word={panel.word}
                    sentence={panel.sentence}
                    translatedText={panel.paragraph.translatedText}
                    textColor={colors.text}
                    mutedColor={colors.muted}
                  />
                ) : (
                  /* dict */
                  <WordDict word={panel.word} context={panel.paragraph.originalText} textColor={colors.text} mutedColor={colors.muted} />
                )}
              </div>

              <button onClick={closePanel} style={{ height: 22, width: 22, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "transparent", border: "none", cursor: "pointer", color: colors.muted, flexShrink: 0 }}>
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
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "20px 20px 28px" }}>
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
                  selectedToken={selectedToken}
                  onClick={handleParagraphClick}
                  onWordClick={handleWordClick}
                  onWordDoubleClick={handleWordDoubleClick}
                  colors={colors}
                  bodyFontSize={fs.body}
                  headingFontSize={fs.heading}
                  lineHeight={fs.lineHeight}
                />
              ))}
            </div>
          ) : (
            <p style={{ textAlign: "center", color: colors.muted, fontStyle: "italic", padding: "80px 0" }}>Текст не найден.</p>
          )}
        </div>

        {totalPages > 1 && (
          <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 20px 36px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button onClick={() => goToPage(page - 1)} disabled={page === 1}
              style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 14, color: page === 1 ? colors.border : colors.muted, background: "transparent", border: "none", cursor: page === 1 ? "not-allowed" : "pointer", padding: "8px 0" }}>
              <ChevronLeft size={16} /> Назад
            </button>
            <span style={{ fontSize: 12, color: colors.muted }}>{page} / {totalPages}</span>
            <button onClick={() => goToPage(page + 1)} disabled={page === totalPages}
              style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 14, color: page === totalPages ? colors.border : colors.muted, background: "transparent", border: "none", cursor: page === totalPages ? "not-allowed" : "pointer", padding: "8px 0" }}>
              Вперёд <ChevronRight size={16} />
            </button>
          </div>
        )}
      </main>

      {/* ── Progress bar ─────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, height: 3, background: colors.border }}>
        <div style={{ height: "100%", width: `${progressPct}%`, background: "#10b981", transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

// ── Dictionary entry for double-click ─────────────────────────────────────────
function WordDict({ word, context, textColor, mutedColor }: { word: string; context: string; textColor: string; mutedColor: string }) {
  const clean = word.toLowerCase().replace(/[^\w-]/g, "");
  const { data: entry, isLoading, isError } = useLookupWord(
    { params: { word: clean, context } },
    { query: { enabled: !!clean, queryKey: getLookupWordQueryKey({ word: clean, context }) } }
  );
  if (isLoading) return <p style={{ margin: 0, fontSize: 14, color: mutedColor, display: "flex", alignItems: "center", gap: 6, lineHeight: "22px" }}>
    <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Ищем «{word}»...
  </p>;
  if (isError || !entry) return <p style={{ margin: 0, fontSize: 14, color: mutedColor, lineHeight: "22px" }}>Нет перевода для «{word}».</p>;
  return (
    <div style={{ lineHeight: "22px" }}>
      <p style={{ margin: 0, fontSize: 14 }}>
        <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#10b981", marginRight: 6, verticalAlign: "middle" }} />
        <span style={{ fontWeight: 700, color: textColor }}>{word}</span>
        {entry.partOfSpeech && <span style={{ color: mutedColor, fontSize: 12, fontStyle: "italic", marginLeft: 6 }}>{entry.partOfSpeech}</span>}
        <span style={{ color: textColor }}> — {entry.translations.join(", ")}</span>
      </p>
      {entry.examples?.[0] && (
        <p style={{ margin: "1px 0 0 13px", fontSize: 13, color: mutedColor, fontStyle: "italic", fontFamily: "Georgia, serif", lineHeight: "22px" }}>
          {entry.examples[0]}
        </p>
      )}
    </div>
  );
}
