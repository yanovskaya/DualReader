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
import { BookParagraph } from "@/components/book-paragraph";
import {
  useReaderSettings,
  THEMES,
  THEME_LABELS,
  FONT_FAMILIES,
  LINE_SPACINGS,
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
  type Theme,
  type FontFamily,
  type LineSpacing,
  type Margin,
  type ThemeColors,
} from "@/hooks/use-reader-settings";

const PAGE_SIZE = 40;
const WORDS_PER_MINUTE = 200;
const AVG_WORDS_PER_PARA = 50;

function timeLeft(remaining: number) {
  const m = Math.round(remaining * AVG_WORDS_PER_PARA / WORDS_PER_MINUTE);
  if (m < 1) return "< 1 мин";
  if (m < 60) return `~${m} мин`;
  return `~${Math.round(m / 60)} ч`;
}

// ── Dictionary entry ───────────────────────────────────────────────────────────
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

// ── Settings bottom sheet ──────────────────────────────────────────────────────
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
            Пример / Sample
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

// ── Dictionary drawer ──────────────────────────────────────────────────────────
type PanelState =
  | { kind: "hidden" }
  | { kind: "dict"; word: string; paragraph: Paragraph };

function DictDrawer({ panel, colors, onClose }: { panel: PanelState; colors: ThemeColors; onClose: () => void }) {
  if (panel.kind === "hidden") return null;
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 40,
      background: colors.drawerBg, borderRadius: "18px 18px 0 0",
      boxShadow: "0 -4px 24px rgba(0,0,0,0.18)",
      padding: "0 20px 44px", maxHeight: "55vh", overflowY: "auto",
      animation: "slideUp 0.22s ease",
    }}>
      <style>{`@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 10, paddingBottom: 4 }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: colors.border }} />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", paddingBottom: 12 }}>
        <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.muted }}>
          <X size={16} />
        </button>
      </div>
      {panel.kind === "dict" && (
        <WordDict word={panel.word} context={panel.paragraph.originalText} colors={colors} />
      )}
    </div>
  );
}

// ── Main Reader ────────────────────────────────────────────────────────────────
export default function ReaderPage() {
  const { id } = useParams<{ id: string }>();
  const bookId = parseInt(id || "0", 10);

  const { settings, setTheme, setFontSize, setFontFamily, setLineSpacing, setMargin } = useReaderSettings();
  const colors = THEMES[settings.theme];

  // Incremental batch loading — always starts at 1, accumulates
  const [currentBatch, setCurrentBatch] = useState(1);
  const [totalBatches, setTotalBatches] = useState(1);
  const [allParagraphs, setAllParagraphs] = useState<Paragraph[]>([]);
  const loadingNextBatch = useRef(false);

  const [panel, setPanel] = useState<PanelState>({ kind: "hidden" });
  const [showSettings, setShowSettings] = useState(false);
  // Global toggle: show or hide Russian translations
  const [showTranslations, setShowTranslations] = useState(true);

  // Two synced scroll panels — EN on top, RU on bottom
  const enRef = useRef<HTMLDivElement>(null);
  const ruRef = useRef<HTMLDivElement>(null);
  // Track which panel is the source of a sync to avoid ping-pong
  const syncSource = useRef<"en" | "ru" | null>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scrollPct, setScrollPct] = useState(0);

  // Sentinel div at the bottom of the EN panel to trigger next batch load
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data: book, isLoading: isLoadingBook } = useGetBook(bookId, {
    query: { enabled: !!bookId, queryKey: getGetBookQueryKey(bookId) },
  });

  const { data: paragraphsData, isSuccess } = useListParagraphs(
    bookId,
    { page: currentBatch, pageSize: PAGE_SIZE },
    { query: { enabled: !!bookId, queryKey: getListParagraphsQueryKey(bookId, { page: currentBatch, pageSize: PAGE_SIZE }) } }
  );

  const { data: statusData } = useGetTranslationStatus(bookId, {
    query: {
      enabled: !!bookId,
      refetchInterval: 5000,
      queryKey: getGetTranslationStatusQueryKey(bookId),
    },
  });

  // Accumulate paragraphs as batches load
  useEffect(() => {
    if (!isSuccess || !paragraphsData?.paragraphs) return;
    setTotalBatches(paragraphsData.totalPages ?? 1);
    setAllParagraphs(prev => {
      const existingIds = new Set(prev.map(p => p.id));
      const newOnes = paragraphsData.paragraphs.filter(p => !existingIds.has(p.id));
      if (newOnes.length === 0) return prev;
      return [...prev, ...newOnes];
    });
    loadingNextBatch.current = false;
  }, [isSuccess, paragraphsData]);

  // Infinite scroll — load next batch when sentinel becomes visible
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !loadingNextBatch.current) {
        setCurrentBatch(prev => {
          if (prev < totalBatches) {
            loadingNextBatch.current = true;
            return prev + 1;
          }
          return prev;
        });
      }
    }, { rootMargin: "200px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [totalBatches]);

  // Sync scroll between EN and RU panels without ping-pong
  const clearSyncTimer = useCallback(() => {
    if (syncTimer.current) { clearTimeout(syncTimer.current); syncTimer.current = null; }
  }, []);

  const handleEnScroll = useCallback(() => {
    const en = enRef.current;
    if (!en) return;
    // Update progress bar regardless
    const scrollable = en.scrollHeight - en.clientHeight;
    setScrollPct(scrollable > 0 ? Math.min(1, en.scrollTop / scrollable) : 0);
    // Only propagate if EN is the active source (or no source yet)
    if (syncSource.current === "ru") return;
    const ru = ruRef.current;
    if (!ru) return;
    syncSource.current = "en";
    clearSyncTimer();
    const ratio = scrollable > 0 ? en.scrollTop / scrollable : 0;
    ru.scrollTop = ratio * (ru.scrollHeight - ru.clientHeight);
    syncTimer.current = setTimeout(() => { syncSource.current = null; }, 80);
  }, [clearSyncTimer]);

  const handleRuScroll = useCallback(() => {
    // Only propagate if RU is the active source (or no source yet)
    if (syncSource.current === "en") return;
    const ru = ruRef.current;
    const en = enRef.current;
    if (!ru || !en) return;
    syncSource.current = "ru";
    clearSyncTimer();
    const ruScrollable = ru.scrollHeight - ru.clientHeight;
    const ratio = ruScrollable > 0 ? ru.scrollTop / ruScrollable : 0;
    en.scrollTop = ratio * (en.scrollHeight - en.clientHeight);
    setScrollPct(ratio);
    syncTimer.current = setTimeout(() => { syncSource.current = null; }, 80);
  }, [clearSyncTimer]);

  // Sync theme to body background
  useEffect(() => {
    document.body.style.background = colors.bg;
    document.documentElement.style.background = colors.bg;
  }, [colors.bg]);

  const handleWordDoubleClick = useCallback((word: string, p: Paragraph) => {
    setPanel({ kind: "dict", word, paragraph: p });
    setShowSettings(false);
  }, []);

  const closePanel = useCallback(() => setPanel({ kind: "hidden" }), []);

  const bodyFont = FONT_FAMILIES[settings.fontFamily].css;
  const headingFont = "Georgia, 'Times New Roman', serif";
  const lineHeight = LINE_SPACINGS[settings.lineSpacing].value;

  // Progress info
  const translatedPct = statusData ? Math.round(statusData.progressPercent ?? 0) : null;
  const totalParas = book?.totalParagraphs ?? 0;
  const remaining = Math.max(0, totalParas - allParagraphs.length);

  if (isLoadingBook) {
    return (
      <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: colors.bg }}>
        <Loader2 size={28} style={{ color: colors.muted, animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!book) {
    return (
      <div style={{ height: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: colors.bg }}>
        <p style={{ color: colors.muted }}>Книга не найдена.</p>
        <Link href="/"><button style={{ color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "6px 16px", background: "transparent", cursor: "pointer" }}>← Библиотека</button></Link>
      </div>
    );
  }

  const HEADER_H = 53; // px — header (50 nav + 3 progress bar)

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: colors.bg, color: colors.text }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── Fixed header ─────────────────────────────────────────────── */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 30,
        background: colors.headerBg,
        borderBottom: `1px solid ${colors.border}`,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}>
        {/* Row 1: nav */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 10px", height: 50 }}>
          <Link href="/">
            <button style={{ height: 34, width: 34, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "transparent", border: "none", cursor: "pointer", color: colors.muted }}>
              <ArrowLeft size={17} />
            </button>
          </Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: colors.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {book.title}
            </div>
            <div style={{ fontSize: 11, color: colors.muted, marginTop: 1 }}>
              {Math.round(scrollPct * 100)}%
              {remaining > 0 && ` · ${timeLeft(remaining)} осталось`}
              {translatedPct !== null && translatedPct < 100 && (
                <span style={{ marginLeft: 6, color: colors.accent }}>⟳ {translatedPct}% пер.</span>
              )}
            </div>
          </div>
          <button onClick={() => setShowSettings(s => !s)} style={{ height: 34, width: 34, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "transparent", border: "none", cursor: "pointer", color: colors.muted }}>
            <Settings2 size={17} />
          </button>
        </div>

        {/* Row 2: progress bar */}
        <div style={{ height: 3, background: colors.border }}>
          <div style={{ width: `${scrollPct * 100}%`, height: "100%", background: colors.accent, transition: "width 0.3s" }} />
        </div>
      </header>

      {/* ── Two synced scroll panels ──────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", paddingTop: HEADER_H }}>

        {/* EN panel — takes 3/4 of space when RU is visible */}
        <div
          ref={enRef}
          onScroll={handleEnScroll}
          style={{
            flex: 3,
            overflowY: "auto",
            overflowX: "hidden",
            WebkitOverflowScrolling: "touch" as never,
          }}
          onClick={() => { if (panel.kind !== "hidden") closePanel(); }}
        >
          {allParagraphs.length === 0 && (
            <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
              <Loader2 size={22} style={{ color: colors.muted, animation: "spin 1s linear infinite" }} />
            </div>
          )}

          {allParagraphs.map(p => (
            <BookParagraph
              key={p.id}
              paragraph={p}
              mode="en"
              onWordDoubleClick={handleWordDoubleClick}
              colors={colors}
              fontSize={settings.fontSize}
              fontFamily={bodyFont}
              headingFontFamily={headingFont}
              lineHeight={lineHeight}
            />
          ))}

          {/* Sentinel — triggers next batch load */}
          <div ref={sentinelRef} style={{ height: 1 }} />

          {loadingNextBatch.current && (
            <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
              <Loader2 size={18} style={{ color: colors.muted, animation: "spin 1s linear infinite" }} />
            </div>
          )}

          {currentBatch >= totalBatches && allParagraphs.length > 0 && (
            <div style={{ textAlign: "center", padding: "32px 20px 60px", color: colors.muted, fontSize: 13 }}>
              ✦ Конец книги ✦
            </div>
          )}
        </div>

        {/* RU panel divider + panel */}
        {showTranslations && (
          <>
            {/* Divider bar with label and hide button */}
            <div style={{
              flexShrink: 0, height: 28,
              background: colors.border + "44",
              borderTop: `1px solid ${colors.border}`,
              borderBottom: `1px solid ${colors.border}`,
              display: "flex", alignItems: "center",
              paddingLeft: 14, paddingRight: 10, gap: 8,
            }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: colors.accent }}>RU</span>
              <div style={{ flex: 1, height: 1, background: colors.border }} />
              <button
                onClick={() => setShowTranslations(false)}
                style={{
                  background: "transparent", border: "none", cursor: "pointer",
                  color: colors.muted, fontSize: 13, padding: "0 4px", lineHeight: 1,
                }}
                title="Скрыть перевод"
              >✕</button>
            </div>

            {/* RU scroll panel — 1/4 height, half font size */}
            <div
              ref={ruRef}
              onScroll={handleRuScroll}
              style={{
                flex: 1,
                overflowY: "auto",
                overflowX: "hidden",
                WebkitOverflowScrolling: "touch" as never,
              }}
            >
              {allParagraphs.map(p => (
                <BookParagraph
                  key={p.id}
                  paragraph={p}
                  mode="ru"
                  colors={colors}
                  fontSize={Math.max(10, Math.round(settings.fontSize / 2))}
                  fontFamily={bodyFont}
                  headingFontFamily={headingFont}
                  lineHeight={lineHeight}
                />
              ))}
            </div>
          </>
        )}

        {/* Show RU button when hidden */}
        {!showTranslations && (
          <div style={{ flexShrink: 0, display: "flex", justifyContent: "center", padding: "10px 0 6px", borderTop: `1px solid ${colors.border}` }}>
            <button
              onClick={() => setShowTranslations(true)}
              style={{
                padding: "5px 16px", borderRadius: 14,
                border: `1px solid ${colors.border}`,
                background: "transparent", color: colors.muted,
                fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
            >
              Показать перевод ▸
            </button>
          </div>
        )}
      </div>

      {/* ── Settings sheet ───────────────────────────────────────────── */}
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

      {/* ── Dictionary drawer ────────────────────────────────────────── */}
      <DictDrawer panel={panel} colors={colors} onClose={closePanel} />
    </div>
  );
}
