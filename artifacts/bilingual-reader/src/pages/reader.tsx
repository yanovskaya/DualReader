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
import { Loader2, ArrowLeft, X, ChevronLeft, ChevronRight, Settings2 } from "lucide-react";
import { BookParagraph, type SelectedToken } from "@/components/book-paragraph";
import { splitSentences } from "@/lib/sentences";
import {
  useReaderSettings,
  THEMES,
  THEME_LABELS,
  FONT_FAMILIES,
  LINE_SPACINGS,
  MARGINS,
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
  type Theme,
  type FontFamily,
  type LineSpacing,
  type Margin,
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
  if (m < 1) return "< 1 мин";
  if (m < 60) return `~${m} мин`;
  return `~${Math.round(m / 60)} ч`;
}

// ── Sentence with highlighted Russian word ────────────────────────────────────
function SentenceHighlight({ word, sentence, translatedText, colors }: {
  word: string; sentence: string; translatedText?: string | null; colors: ThemeColors;
}) {
  const clean = word.toLowerCase().replace(/[^\w-]/g, "");
  const { data: entry } = useLookupWord(
    { params: { word: clean } },
    { query: { enabled: !!clean, queryKey: getLookupWordQueryKey({ word: clean }) } }
  );
  const translations = entry?.translations ?? [];

  function highlighted(text: string) {
    for (const t of translations) {
      const candidates = [t, ...t.split(/[\s,;]+/).filter(w => w.length > 3)];
      for (const c of candidates) {
        const lc = text.toLowerCase();
        const idx = lc.indexOf(c.toLowerCase());
        if (idx !== -1) {
          return (
            <>
              {text.slice(0, idx)}
              <mark style={{ background: "#86efac", color: "#14532d", borderRadius: 3, padding: "0 2px" }}>
                {text.slice(idx, idx + c.length)}
              </mark>
              {text.slice(idx + c.length)}
            </>
          );
        }
      }
    }
    return <>{text}</>;
  }

  const ruSentences = splitSentences(translatedText || "");
  const showFull = ruSentences.length > 1;

  return (
    <div>
      {translations.length > 0 && (
        <div style={{ fontSize: 12, color: colors.muted, marginBottom: 4 }}>
          <span style={{ fontWeight: 700, color: colors.text }}>{word}</span>
          {" — "}
          {translations.slice(0, 5).join(", ")}
        </div>
      )}
      <div style={{ fontSize: 15, fontFamily: "Georgia, serif", color: colors.text, lineHeight: "1.7" }}>
        <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: colors.accent, marginRight: 7, verticalAlign: "middle" }} />
        {highlighted(sentence)}
      </div>
      {showFull && translatedText && (
        <div style={{ marginTop: 6, fontSize: 13, color: colors.muted, fontFamily: "Georgia, serif", lineHeight: "1.6", paddingLeft: 15, borderLeft: `2px solid ${colors.border}` }}>
          {translatedText}
        </div>
      )}
    </div>
  );
}

// ── Dictionary entry ──────────────────────────────────────────────────────────
function WordDict({ word, context, colors }: { word: string; context: string; colors: ThemeColors }) {
  const clean = word.toLowerCase().replace(/[^\w-]/g, "");
  const { data: entry, isLoading, isError } = useLookupWord(
    { params: { word: clean, context } },
    { query: { enabled: !!clean, queryKey: getLookupWordQueryKey({ word: clean, context }) } }
  );
  if (isLoading) return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: colors.muted }}>
      <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Ищем «{word}»…
    </div>
  );
  if (isError || !entry) return <div style={{ fontSize: 14, color: colors.muted }}>Нет перевода для «{word}».</div>;
  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 700, color: colors.text, marginBottom: 4 }}>
        {word}
        {entry.partOfSpeech && <span style={{ fontSize: 12, fontWeight: 400, color: colors.muted, marginLeft: 8, fontStyle: "italic" }}>{entry.partOfSpeech}</span>}
      </div>
      <div style={{ fontSize: 15, color: colors.text, marginBottom: entry.examples?.length ? 8 : 0 }}>
        {entry.translations.join(", ")}
      </div>
      {entry.examples?.map((ex, i) => (
        <div key={i} style={{ fontSize: 13, color: colors.muted, fontStyle: "italic", fontFamily: "Georgia, serif", lineHeight: "1.5", marginTop: 4 }}>
          {ex}
        </div>
      ))}
    </div>
  );
}

// ── Settings bottom sheet ─────────────────────────────────────────────────────
function SettingsSheet({ colors, settings, onClose, setTheme, setFontSize, setFontFamily, setLineSpacing, setMargin }: {
  colors: ThemeColors;
  settings: ReturnType<typeof useReaderSettings>["settings"];
  onClose: () => void;
  setTheme: (v: Theme) => void;
  setFontSize: (v: number) => void;
  setFontFamily: (v: FontFamily) => void;
  setLineSpacing: (v: LineSpacing) => void;
  setMargin: (v: Margin) => void;
}) {
  const row = { display: "flex", flexDirection: "column" as const, gap: 8, marginBottom: 20 };
  const label = { fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: colors.muted, marginBottom: 4 };
  const chip = (active: boolean) => ({
    padding: "6px 14px",
    borderRadius: 20,
    border: `1.5px solid ${active ? colors.text : colors.border}`,
    background: active ? colors.text : "transparent",
    color: active ? colors.bg : colors.text,
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    cursor: "pointer",
    transition: "all 0.15s",
    whiteSpace: "nowrap" as const,
  });

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end" }}
    >
      <div style={{ width: "100%", maxHeight: "80vh", overflowY: "auto", background: colors.drawerBg, borderRadius: "20px 20px 0 0", padding: "0 20px 40px" }}>
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: colors.border }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0 18px" }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: colors.heading }}>Настройки</span>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.muted }}>
            <X size={20} />
          </button>
        </div>

        {/* Font size */}
        <div style={row}>
          <div style={label}>Размер шрифта — {settings.fontSize}px</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, color: colors.muted }}>A</span>
            <input
              type="range" min={FONT_SIZE_MIN} max={FONT_SIZE_MAX} value={settings.fontSize}
              onChange={e => setFontSize(Number(e.target.value))}
              style={{ flex: 1, accentColor: colors.accent }}
            />
            <span style={{ fontSize: 22, color: colors.muted }}>A</span>
          </div>
          <div style={{ fontSize: settings.fontSize, fontFamily: FONT_FAMILIES[settings.fontFamily].css, color: colors.muted, lineHeight: LINE_SPACINGS[settings.lineSpacing].value, textAlign: "center" }}>
            Пример текста
          </div>
        </div>

        {/* Font family */}
        <div style={row}>
          <div style={label}>Шрифт</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(["serif", "sans", "mono"] as FontFamily[]).map(ff => (
              <button key={ff} onClick={() => setFontFamily(ff)} style={{ ...chip(settings.fontFamily === ff), fontFamily: FONT_FAMILIES[ff].css }}>
                {FONT_FAMILIES[ff].label}
              </button>
            ))}
          </div>
        </div>

        {/* Line spacing */}
        <div style={row}>
          <div style={label}>Межстрочный интервал</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(["compact", "normal", "relaxed"] as LineSpacing[]).map(ls => (
              <button key={ls} onClick={() => setLineSpacing(ls)} style={chip(settings.lineSpacing === ls)}>
                {LINE_SPACINGS[ls].label}
              </button>
            ))}
          </div>
        </div>

        {/* Margin */}
        <div style={row}>
          <div style={label}>Поля</div>
          <div style={{ display: "flex", gap: 8 }}>
            {(["narrow", "normal", "wide"] as Margin[]).map(m => (
              <button key={m} onClick={() => setMargin(m)} style={chip(settings.margin === m)}>
                {MARGINS[m].label}
              </button>
            ))}
          </div>
        </div>

        {/* Themes */}
        <div style={row}>
          <div style={label}>Тема</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {(Object.keys(THEMES) as Theme[]).map(t => (
              <button key={t} onClick={() => setTheme(t)} style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                background: "transparent", border: "none", cursor: "pointer", padding: 0,
              }}>
                <div style={{
                  width: 44, height: 44,
                  borderRadius: 12,
                  background: THEMES[t].bg,
                  border: settings.theme === t ? `3px solid ${colors.accent}` : `2px solid ${THEMES[t].border}`,
                  boxShadow: settings.theme === t ? `0 0 0 2px ${colors.accent}30` : "none",
                  transition: "all 0.15s",
                }} />
                <span style={{ fontSize: 11, color: settings.theme === t ? colors.text : colors.muted, fontWeight: settings.theme === t ? 600 : 400 }}>
                  {THEME_LABELS[t]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Translation bottom drawer ─────────────────────────────────────────────────
type PanelState =
  | { kind: "hidden" }
  | { kind: "paragraph"; paragraph: Paragraph }
  | { kind: "sentence"; word: string; sentence: string; paragraph: Paragraph }
  | { kind: "dict"; word: string; paragraph: Paragraph };

function TranslationDrawer({ panel, colors, onClose }: {
  panel: PanelState; colors: ThemeColors; onClose: () => void;
}) {
  if (panel.kind === "hidden") return null;
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 40,
      background: colors.drawerBg,
      borderRadius: "18px 18px 0 0",
      boxShadow: "0 -4px 24px rgba(0,0,0,0.18)",
      padding: "0 20px 40px",
      maxHeight: "55vh",
      overflowY: "auto",
      WebkitOverflowScrolling: "touch" as never,
      animation: "slideUp 0.22s ease",
    }}>
      <style>{`@keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }`}</style>

      {/* Handle + close */}
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 10, paddingBottom: 4 }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: colors.border }} />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", paddingBottom: 12 }}>
        <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.muted }}>
          <X size={16} />
        </button>
      </div>

      {panel.kind === "paragraph" && (
        panel.paragraph.isTranslated && panel.paragraph.translatedText ? (
          <div style={{ fontSize: 16, fontFamily: "Georgia, serif", color: colors.text, lineHeight: "1.75" }}>
            {panel.paragraph.translatedText}
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: colors.muted, fontStyle: "italic" }}>
            <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
            Перевод ещё не готов…
          </div>
        )
      )}

      {panel.kind === "sentence" && (
        <SentenceHighlight
          word={panel.word}
          sentence={panel.sentence}
          translatedText={panel.paragraph.translatedText}
          colors={colors}
        />
      )}

      {panel.kind === "dict" && (
        <WordDict word={panel.word} context={panel.paragraph.originalText} colors={colors} />
      )}
    </div>
  );
}

// ── Page-turn transition wrapper ──────────────────────────────────────────────
function PageContent({ pageKey, children }: { pageKey: string | number; children: React.ReactNode }) {
  const [key, setKey] = useState(pageKey);
  const [animClass, setAnimClass] = useState<"fadeIn" | "none">("none");

  useEffect(() => {
    if (key !== pageKey) {
      setAnimClass("fadeIn");
      setKey(pageKey);
    }
  }, [pageKey]);

  return (
    <div
      key={key as string}
      onAnimationEnd={() => setAnimClass("none")}
      style={{ animation: animClass === "fadeIn" ? "pageIn 0.22s ease" : "none" }}
    >
      <style>{`@keyframes pageIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }`}</style>
      {children}
    </div>
  );
}

// ── Main Reader ───────────────────────────────────────────────────────────────
export default function ReaderPage() {
  const { id } = useParams<{ id: string }>();
  const bookId = parseInt(id || "0", 10);

  const { settings, setTheme, setFontSize, setFontFamily, setLineSpacing, setMargin } = useReaderSettings();
  const colors = THEMES[settings.theme];

  const [page, setPage] = useState(() => getSaved(bookId));
  const [panel, setPanel] = useState<PanelState>({ kind: "hidden" });
  const [selectedToken, setSelectedToken] = useState<SelectedToken | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);

  const mainRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

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
    const top = (e.currentTarget as HTMLElement).scrollTop;
    if (top > lastScrollY.current + 8 && top > 60) setHeaderVisible(false);
    else if (top < lastScrollY.current - 8) setHeaderVisible(true);
    lastScrollY.current = top;
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStart.current.y);
    touchStart.current = null;
    if (Math.abs(dx) > 65 && dy < 80) {
      if (dx < 0) goToPage(page + 1);
      else goToPage(page - 1);
    }
  }, [goToPage, page]);

  // Tap zone handler — left 30% = prev, right 30% = next, center = toggle header/settings
  const handleContentTap = useCallback((e: React.MouseEvent) => {
    // Don't fire for word or button taps
    const target = e.target as HTMLElement;
    if (target.dataset.word || target.closest("button") || target.closest("[data-nontap]")) return;
    if (panel.kind !== "hidden") return; // don't fire when drawer is open

    const x = e.clientX;
    const w = window.innerWidth;
    if (x < w * 0.28) goToPage(page - 1);
    else if (x > w * 0.72) goToPage(page + 1);
    else { setHeaderVisible(v => !v); }
  }, [panel.kind, page, goToPage]);

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
  }, []);

  const handleWordDoubleClick = useCallback((word: string, p: Paragraph) => {
    setSelectedToken(null);
    setPanel({ kind: "dict", word, paragraph: p });
    setShowSettings(false);
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

  const bodyFont = FONT_FAMILIES[settings.fontFamily].css;
  const headingFont = "Georgia, 'Times New Roman', serif";
  const lineHeight = LINE_SPACINGS[settings.lineSpacing].value;
  const margin = MARGINS[settings.margin].value;

  if (isLoadingBook) {
    return <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: colors.bg }}>
      <Loader2 size={28} style={{ color: colors.muted, animation: "spin 1s linear infinite" }} />
    </div>;
  }

  if (!book) {
    return <div style={{ height: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: colors.bg }}>
      <p style={{ color: colors.muted }}>Книга не найдена.</p>
      <Link href="/">
        <button style={{ color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "6px 16px", background: "transparent", cursor: "pointer" }}>← Библиотека</button>
      </Link>
    </div>;
  }

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: colors.bg, color: colors.text, overflow: "hidden" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* ── Header (auto-hide) ──────────────────────────────────────── */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 30,
        background: colors.headerBg,
        borderBottom: `1px solid ${colors.border}`,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        transform: headerVisible ? "translateY(0)" : "translateY(-100%)",
        transition: "transform 0.28s ease",
      }}>
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 14px", height: 50, display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/">
            <button style={{ height: 34, width: 34, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "transparent", border: "none", cursor: "pointer", color: colors.muted }}>
              <ArrowLeft size={17} />
            </button>
          </Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: colors.heading, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{book.title}</p>
            <p style={{ fontSize: 11, color: colors.muted, margin: 0 }}>
              {Math.round(progressPct)}% · стр. {page}/{totalPages} · {timeLeft(remaining)}
              {isTranslating && <>
                {" · "}<span style={{ color: "#d97706" }}>
                  <Loader2 size={10} style={{ display: "inline", verticalAlign: "middle", animation: "spin 1s linear infinite" }} />
                  {" "}{Math.round(statusData?.progressPercent || 0)}% пер.
                </span>
              </>}
            </p>
          </div>
          <button
            onClick={() => setShowSettings(s => !s)}
            style={{ height: 34, width: 34, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: showSettings ? colors.hover : "transparent", border: "none", cursor: "pointer", color: colors.muted }}
          >
            <Settings2 size={17} />
          </button>
        </div>
      </header>

      {/* ── Reading area ──────────────────────────────────────────────── */}
      <div
        ref={mainRef}
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={handleContentTap}
        style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" as never, paddingTop: 50 }}
      >
        <PageContent pageKey={page}>
          <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 0 32px" }}>
            <div style={{ padding: margin }}>
              {isLoadingParagraphs ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "100px 0" }}>
                  <Loader2 size={24} style={{ animation: "spin 1s linear infinite", color: colors.muted }} />
                </div>
              ) : paragraphsData?.paragraphs?.length ? (
                paragraphsData.paragraphs.map(p => (
                  <BookParagraph
                    key={p.id}
                    paragraph={p}
                    selectedToken={selectedToken}
                    onClick={handleParagraphClick}
                    onWordClick={handleWordClick}
                    onWordDoubleClick={handleWordDoubleClick}
                    colors={colors}
                    fontSize={settings.fontSize}
                    fontFamily={bodyFont}
                    headingFontFamily={headingFont}
                    lineHeight={lineHeight}
                  />
                ))
              ) : (
                <p style={{ textAlign: "center", color: colors.muted, fontStyle: "italic", padding: "100px 0" }}>Текст не найден.</p>
              )}
            </div>

            {/* Bottom page navigation */}
            {totalPages > 1 && (
              <div data-nontap="1" style={{ padding: `0 ${MARGINS[settings.margin].value.split(" ")[1] || "20px"}`, marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <button
                  onClick={() => goToPage(page - 1)} disabled={page === 1}
                  style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 14, color: page === 1 ? colors.border : colors.muted, background: "transparent", border: "none", cursor: page === 1 ? "not-allowed" : "pointer", padding: "10px 0" }}
                >
                  <ChevronLeft size={16} /> Назад
                </button>
                <span style={{ fontSize: 13, color: colors.muted }}>{page} / {totalPages}</span>
                <button
                  onClick={() => goToPage(page + 1)} disabled={page === totalPages}
                  style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 14, color: page === totalPages ? colors.border : colors.muted, background: "transparent", border: "none", cursor: page === totalPages ? "not-allowed" : "pointer", padding: "10px 0" }}
                >
                  Вперёд <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </PageContent>
      </div>

      {/* ── Progress bar ─────────────────────────────────────────────── */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: 3, background: colors.border, zIndex: 20 }}>
        <div style={{ height: "100%", width: `${progressPct}%`, background: colors.accent, transition: "width 0.5s ease" }} />
      </div>

      {/* ── Translation drawer ────────────────────────────────────────── */}
      {panel.kind !== "hidden" && (
        <>
          <div onClick={closePanel} style={{ position: "fixed", inset: 0, zIndex: 35, background: "rgba(0,0,0,0.2)" }} />
          <TranslationDrawer panel={panel} colors={colors} onClose={closePanel} />
        </>
      )}

      {/* ── Settings bottom sheet ─────────────────────────────────────── */}
      {showSettings && (
        <SettingsSheet
          colors={colors}
          settings={settings}
          onClose={() => setShowSettings(false)}
          setTheme={setTheme}
          setFontSize={setFontSize}
          setFontFamily={setFontFamily}
          setLineSpacing={setLineSpacing}
          setMargin={setMargin}
        />
      )}
    </div>
  );
}
