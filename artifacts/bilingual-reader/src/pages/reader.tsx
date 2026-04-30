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
import { Loader2, ArrowLeft, X, Settings2 } from "lucide-react";
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

// Load more paragraphs per batch so screen-pages work well
const PAGE_SIZE = 60;
const WORDS_PER_MINUTE = 200;
const AVG_WORDS_PER_PARA = 50;

function batchKey(id: number) { return `lingua_batch_${id}`; }
function getSaved(id: number) { try { return Math.max(1, parseInt(localStorage.getItem(batchKey(id)) || "1") || 1); } catch { return 1; } }
function saveBatch(id: number, p: number) { try { localStorage.setItem(batchKey(id), String(p)); } catch {} }

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
    padding: "6px 14px", borderRadius: 20,
    border: `1.5px solid ${active ? colors.text : colors.border}`,
    background: active ? colors.text : "transparent",
    color: active ? colors.bg : colors.text,
    fontSize: 13, fontWeight: active ? 600 : 400,
    cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap" as const,
  });

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end" }}>
      <div style={{ width: "100%", maxHeight: "80vh", overflowY: "auto", background: colors.drawerBg, borderRadius: "20px 20px 0 0", padding: "0 20px 40px" }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: colors.border }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0 18px" }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: colors.heading }}>Настройки</span>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.muted }}><X size={20} /></button>
        </div>

        <div style={row}>
          <div style={label}>Размер шрифта — {settings.fontSize}px</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, color: colors.muted }}>A</span>
            <input type="range" min={FONT_SIZE_MIN} max={FONT_SIZE_MAX} value={settings.fontSize}
              onChange={e => setFontSize(Number(e.target.value))}
              style={{ flex: 1, accentColor: colors.accent }} />
            <span style={{ fontSize: 22, color: colors.muted }}>A</span>
          </div>
          <div style={{ fontSize: settings.fontSize, fontFamily: FONT_FAMILIES[settings.fontFamily].css, color: colors.muted, lineHeight: LINE_SPACINGS[settings.lineSpacing].value, textAlign: "center" }}>
            Пример текста — Sample text
          </div>
        </div>

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

        <div style={row}>
          <div style={label}>Тема</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {(Object.keys(THEMES) as Theme[]).map(t => (
              <button key={t} onClick={() => setTheme(t)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, background: THEMES[t].bg,
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
      padding: "0 20px 44px",
      maxHeight: "55vh",
      overflowY: "auto",
      WebkitOverflowScrolling: "touch" as never,
      animation: "slideUp 0.22s ease",
    }}>
      <style>{`@keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }`}</style>
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
        <SentenceHighlight word={panel.word} sentence={panel.sentence} translatedText={panel.paragraph.translatedText} colors={colors} />
      )}
      {panel.kind === "dict" && (
        <WordDict word={panel.word} context={panel.paragraph.originalText} colors={colors} />
      )}
    </div>
  );
}

// ── Main Reader ───────────────────────────────────────────────────────────────
export default function ReaderPage() {
  const { id } = useParams<{ id: string }>();
  const bookId = parseInt(id || "0", 10);

  const { settings, setTheme, setFontSize, setFontFamily, setLineSpacing, setMargin } = useReaderSettings();
  const colors = THEMES[settings.theme];

  // API batch page (20–60 paragraphs each)
  const [batch, setBatch] = useState(() => getSaved(bookId));
  // Screen page = which CSS column is visible
  const [screenPage, setScreenPage] = useState(0);
  const [totalScreenPages, setTotalScreenPages] = useState(1);

  const [panel, setPanel] = useState<PanelState>({ kind: "hidden" });
  const [selectedToken, setSelectedToken] = useState<SelectedToken | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);

  // Refs for CSS-column layout measurement
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [colWidth, setColWidth] = useState(0);
  const colWidthRef = useRef(0);

  // Refs for window-level handlers
  const panelOpen = useRef(false);
  const settingsOpen = useRef(false);
  const totalBatchesRef = useRef(1);
  // When navigating to prev batch, jump to its last screen after measuring
  const pendingLastScreen = useRef(false);

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
    { page: batch, pageSize: PAGE_SIZE },
    {
      query: {
        enabled: !!bookId,
        queryKey: getListParagraphsQueryKey(bookId, { page: batch, pageSize: PAGE_SIZE }),
        refetchInterval: isTranslating ? 4000 : false,
      },
    }
  );

  // Keep refs in sync
  useEffect(() => { panelOpen.current = panel.kind !== "hidden"; }, [panel.kind]);
  useEffect(() => { settingsOpen.current = showSettings; }, [showSettings]);
  useEffect(() => { totalBatchesRef.current = paragraphsData?.totalPages ?? 1; }, [paragraphsData?.totalPages]);

  // Sync body background with theme
  useEffect(() => {
    const prev = document.body.style.background;
    const prevHtml = document.documentElement.style.background;
    document.body.style.background = colors.bg;
    document.documentElement.style.background = colors.bg;
    return () => {
      document.body.style.background = prev;
      document.documentElement.style.background = prevHtml;
    };
  }, [colors.bg]);

  // ── Measure CSS columns after text renders ────────────────────────────────
  const measure = useCallback(() => {
    const wrapper = wrapperRef.current;
    const content = contentRef.current;
    if (!wrapper || !content) return;
    const cw = wrapper.clientWidth;
    if (cw < 10) return;
    colWidthRef.current = cw;
    setColWidth(cw);
    const total = Math.max(1, Math.round(content.scrollWidth / cw));
    setTotalScreenPages(total);
    // If we navigated backward to a prev batch, land on its last screen
    if (pendingLastScreen.current) {
      pendingLastScreen.current = false;
      setScreenPage(total - 1);
    }
  }, []);

  useEffect(() => {
    // Measure after text+fonts settle
    const t1 = setTimeout(measure, 80);
    const t2 = setTimeout(measure, 350); // re-measure after fonts load
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [paragraphsData, settings.fontSize, settings.lineSpacing, settings.margin, settings.fontFamily, measure]);

  // Also re-measure on resize
  useEffect(() => {
    window.addEventListener("resize", measure, { passive: true });
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  // Reset screen page when batch changes (unless pending last screen)
  useEffect(() => {
    if (!pendingLastScreen.current) setScreenPage(0);
  }, [batch]);

  // ── Navigation ───────────────────────────────────────────────────────────
  const goNextScreen = useCallback(() => {
    setScreenPage(sp => {
      if (sp < totalScreenPages - 1) return sp + 1;
      // End of this batch → load next batch
      const nextBatch = batch + 1;
      if (nextBatch <= totalBatchesRef.current) {
        setBatch(nextBatch);
        saveBatch(bookId, nextBatch);
        setPanel({ kind: "hidden" });
        setSelectedToken(null);
        return 0;
      }
      return sp; // already at the very end
    });
  }, [batch, bookId, totalScreenPages]);

  const goPrevScreen = useCallback(() => {
    setScreenPage(sp => {
      if (sp > 0) return sp - 1;
      // Start of this batch → load prev batch
      const prevBatch = batch - 1;
      if (prevBatch >= 1) {
        pendingLastScreen.current = true; // land on last screen of prev batch
        setBatch(prevBatch);
        saveBatch(bookId, prevBatch);
        setPanel({ kind: "hidden" });
        setSelectedToken(null);
      }
      return sp;
    });
  }, [batch, bookId]);

  // ── Window-level swipe (works on non-scrollable content) ────────────────
  useEffect(() => {
    let sx = 0, sy = 0;
    const onStart = (e: TouchEvent) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; };
    const onEnd = (e: TouchEvent) => {
      if (panelOpen.current || settingsOpen.current) return;
      const dx = e.changedTouches[0].clientX - sx;
      const dy = Math.abs(e.changedTouches[0].clientY - sy);
      if (Math.abs(dx) > 55 && dy < Math.abs(dx) * 0.75) {
        if (dx < 0) goNextScreen();
        else goPrevScreen();
      }
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [goNextScreen, goPrevScreen]);

  // ── Tap zones ─────────────────────────────────────────────────────────────
  const handleContentTap = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.dataset.word || target.closest("button") || target.closest("[data-nontap]")) return;
    if (panel.kind !== "hidden") { return; }

    const x = e.clientX;
    const w = window.innerWidth;
    if (x < w * 0.25) goPrevScreen();
    else if (x > w * 0.75) goNextScreen();
    else setHeaderVisible(v => !v);
  }, [panel.kind, goNextScreen, goPrevScreen]);

  // ── Word / paragraph interaction ─────────────────────────────────────────
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

  // ── Progress ──────────────────────────────────────────────────────────────
  const totalBatches = paragraphsData?.totalPages ?? 1;
  const totalParas = book?.totalParagraphs ?? 0;
  const remaining = totalParas - Math.min((batch - 1) * PAGE_SIZE, totalParas);
  // Fractional batch progress: (batch-1) + screenPage/totalScreenPages
  const fracBatch = (batch - 1) + (totalScreenPages > 1 ? screenPage / totalScreenPages : 0);
  const progressPct = totalBatches > 0 ? (fracBatch / totalBatches) * 100 : 0;
  // Display: "screen N of M in this batch"
  const screenLabel = totalScreenPages > 1 ? `${screenPage + 1}/${totalScreenPages} · ` : "";

  const bodyFont = FONT_FAMILIES[settings.fontFamily].css;
  const headingFont = "Georgia, 'Times New Roman', serif";
  const lineHeight = LINE_SPACINGS[settings.lineSpacing].value;
  const padH = MARGINS[settings.margin].value.split(" ")[1] ?? "20px";

  if (isLoadingBook) {
    return <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: colors.bg }}>
      <Loader2 size={28} style={{ color: colors.muted, animation: "spin 1s linear infinite" }} />
    </div>;
  }

  if (!book) {
    return <div style={{ height: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: colors.bg }}>
      <p style={{ color: colors.muted }}>Книга не найдена.</p>
      <Link href="/"><button style={{ color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "6px 16px", background: "transparent", cursor: "pointer" }}>← Библиотека</button></Link>
    </div>;
  }

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: colors.bg, color: colors.text, overflow: "hidden" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* ── Fixed header ────────────────────────────────────────────── */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 30,
        background: colors.headerBg,
        borderBottom: `1px solid ${colors.border}`,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        transform: headerVisible ? "translateY(0)" : "translateY(-100%)",
        transition: "transform 0.28s ease",
      }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 14px", height: 50, display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/">
            <button style={{ height: 34, width: 34, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "transparent", border: "none", cursor: "pointer", color: colors.muted }}>
              <ArrowLeft size={17} />
            </button>
          </Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: colors.heading, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{book.title}</p>
            <p style={{ fontSize: 11, color: colors.muted, margin: 0 }}>
              {Math.round(progressPct)}% · {screenLabel}{timeLeft(remaining)}
              {isTranslating && <> · <span style={{ color: "#d97706" }}>
                <Loader2 size={10} style={{ display: "inline", verticalAlign: "middle", animation: "spin 1s linear infinite" }} />
                {" "}{Math.round(statusData?.progressPercent || 0)}% пер.
              </span></>}
            </p>
          </div>
          <button onClick={() => setShowSettings(s => !s)}
            style={{ height: 34, width: 34, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: showSettings ? colors.hover : "transparent", border: "none", cursor: "pointer", color: colors.muted }}>
            <Settings2 size={17} />
          </button>
        </div>
      </header>

      {/* ── Screen-sized reading area ────────────────────────────────── */}
      {/* wrapperRef clips content; contentRef holds CSS columns */}
      <div
        ref={wrapperRef}
        onClick={handleContentTap}
        style={{
          flex: 1,
          overflow: "hidden",
          marginTop: 50,      // leave room for fixed header
          position: "relative",
        }}
      >
        {isLoadingParagraphs ? (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Loader2 size={28} style={{ color: colors.muted, animation: "spin 1s linear infinite" }} />
          </div>
        ) : (
          <div
            ref={contentRef}
            style={{
              // CSS multi-column: each column = one screen
              columnCount: 1,
              columnFill: "auto",
              columnGap: 0,
              // height must match the wrapper exactly so columns are screen-height
              height: "100%",
              // Slide to current screen page
              transform: `translateX(${-screenPage * colWidth}px)`,
              transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
              willChange: "transform",
              // Vertical padding only — horizontal padding lives inside each BookParagraph
              // so every CSS column (screen page) gets consistent margins
              paddingTop: 16,
              paddingBottom: 20,
              boxSizing: "border-box",
            }}
          >
            {paragraphsData?.paragraphs?.map(p => (
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
                padH={padH}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Progress bar at bottom ───────────────────────────────────── */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 20 }}>
        {/* Page indicator dots */}
        {totalScreenPages > 1 && totalScreenPages <= 20 && (
          <div data-nontap="1" style={{ display: "flex", justifyContent: "center", gap: 5, paddingBottom: 6 }}>
            {Array.from({ length: totalScreenPages }).map((_, i) => (
              <div key={i} style={{
                width: i === screenPage ? 16 : 6, height: 6, borderRadius: 3,
                background: i === screenPage ? colors.accent : colors.border,
                transition: "all 0.2s",
              }} />
            ))}
          </div>
        )}
        <div style={{ height: 3, background: colors.border }}>
          <div style={{ height: "100%", width: `${progressPct}%`, background: colors.accent, transition: "width 0.4s ease" }} />
        </div>
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
          colors={colors} settings={settings}
          onClose={() => setShowSettings(false)}
          setTheme={setTheme} setFontSize={setFontSize}
          setFontFamily={setFontFamily} setLineSpacing={setLineSpacing} setMargin={setMargin}
        />
      )}
    </div>
  );
}
