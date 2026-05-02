import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { useParams, Link } from "wouter";
import {
  useGetBook,
  getGetBookQueryKey,
  useGetTranslationStatus,
  getGetTranslationStatusQueryKey,
  useGetBookChapters,
  getGetBookChaptersQueryKey,
  useLookupWord,
  getLookupWordQueryKey,
} from "@workspace/api-client-react";
import { useParagraphsOffline } from "@/hooks/use-paragraphs-offline";
import { saveBook, loadBook, saveParagraphPage } from "@/lib/idb";
import type { CachedBook } from "@/lib/idb";
import type { Paragraph } from "@workspace/api-client-react/src/generated/api.schemas";
import { Loader2, ArrowLeft, X, Settings2, List, EyeOff, Search, Link2 } from "lucide-react";
import { BookParagraph } from "@/components/book-paragraph";
import { isHeadingParagraph } from "@/lib/sentences";
import { TocDrawer } from "@/components/toc-drawer";
import { SearchPanel } from "@/components/search-panel";
import { saveLastBook, saveProgress, loadProgress } from "@/hooks/use-reading-progress";
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
  type TextAlign,
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
  const clean = word.toLowerCase().replace(/[^\w\s-]/g, "").trim();

  // Extract just the sentence that contains the word so the GET URL stays short.
  // Full paragraph text can be 26 000+ chars → HTTP 431 on long paragraphs.
  const shortContext = (() => {
    const lower = context.toLowerCase();
    const pos = lower.indexOf(clean);
    if (pos < 0) return context.slice(0, 300);
    // Walk backwards to the nearest sentence boundary (period/newline)
    let start = pos;
    while (start > 0 && context[start - 1] !== "." && context[start - 1] !== "\n") start--;
    // Walk forwards to the next sentence boundary
    let end = pos + clean.length;
    while (end < context.length && context[end] !== "." && context[end] !== "\n") end++;
    return context.slice(start, end + 1).trim().slice(0, 300);
  })();

  const { data: entry, isLoading, isError, isFetching, refetch } = useLookupWord(
    { word: clean, context: shortContext },
    {
      query: {
        enabled: !!clean,
        queryKey: getLookupWordQueryKey({ word: clean, context: shortContext }),
        retry: 2,
        retryDelay: 1500,
        staleTime: 1000 * 60 * 60 * 24 * 7, // 7 days — cache indefinitely once loaded
      },
    }
  );

  if (isLoading || isFetching) return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: colors.muted }}>
      <Loader2 size={14} style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
      <span>Ищем «{word}»…</span>
    </div>
  );
  if (isError || !entry) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 14, color: colors.muted }}>Не удалось загрузить перевод «{word}».</div>
      <button
        onClick={() => refetch()}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 6, padding: "10px 20px", borderRadius: 24,
          border: "none", background: colors.accent,
          color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
        }}
      >
        Попробовать снова
      </button>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Word header: word + transcription + part of speech */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: colors.heading, fontFamily: "Georgia, serif" }}>
          {entry.word}
        </span>
        {entry.transcription && (
          <span style={{ fontSize: 14, color: colors.accent, fontFamily: "monospace", letterSpacing: "0.02em" }}>
            {entry.transcription}
          </span>
        )}
        {entry.partOfSpeech && (
          <span style={{ fontSize: 12, color: colors.muted, fontStyle: "italic" }}>
            {entry.partOfSpeech}
          </span>
        )}
      </div>

      {/* Translations */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {entry.translations.map((t, i) => (
          <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 11, color: colors.muted, minWidth: 16, textAlign: "right" }}>{i + 1}.</span>
            <span style={{ fontSize: i === 0 ? 17 : 15, fontWeight: i === 0 ? 600 : 400, color: colors.text }}>
              {t}
            </span>
          </div>
        ))}
      </div>

      {/* Examples with Russian translations */}
      {entry.examples && entry.examples.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: colors.muted, textTransform: "uppercase" }}>
            Примеры
          </div>
          {entry.examples.map((ex, i) => (
            <div key={i} style={{ paddingLeft: 10, borderLeft: `2.5px solid ${colors.accent}50` }}>
              <div style={{ fontSize: 14, fontStyle: "italic", color: colors.text, opacity: 0.88, fontFamily: "Georgia, serif", lineHeight: 1.55 }}>
                "{ex}"
              </div>
              {entry.exampleTranslations?.[i] && (
                <div style={{ fontSize: 13, color: colors.muted, marginTop: 3, lineHeight: 1.4 }}>
                  {entry.exampleTranslations[i]}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

// ── Settings bottom sheet ──────────────────────────────────────────────────────
function SettingsSheet({ colors, settings, onClose, setTheme, setFontSize, setFontFamily, setLineSpacing, setMargin, setTextAlign }: {
  colors: ThemeColors;
  settings: ReturnType<typeof useReaderSettings>["settings"];
  onClose: () => void;
  setTheme: (v: Theme) => void;
  setFontSize: (v: number) => void;
  setFontFamily: (v: FontFamily) => void;
  setLineSpacing: (v: LineSpacing) => void;
  setMargin: (v: Margin) => void;
  setTextAlign: (v: TextAlign) => void;
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
          <div style={label}>Выравнивание текста</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setTextAlign("left")} style={{ ...chip(settings.textAlign === "left"), display: "flex", alignItems: "center", gap: 6 }}>
              {/* Left-align icon */}
              <svg width="14" height="12" viewBox="0 0 14 12" fill="currentColor">
                <rect x="0" y="0" width="14" height="2" rx="1"/>
                <rect x="0" y="5" width="10" height="2" rx="1"/>
                <rect x="0" y="10" width="12" height="2" rx="1"/>
              </svg>
              По левому краю
            </button>
            <button onClick={() => setTextAlign("justify")} style={{ ...chip(settings.textAlign === "justify"), display: "flex", alignItems: "center", gap: 6 }}>
              {/* Justify icon */}
              <svg width="14" height="12" viewBox="0 0 14 12" fill="currentColor">
                <rect x="0" y="0" width="14" height="2" rx="1"/>
                <rect x="0" y="5" width="14" height="2" rx="1"/>
                <rect x="0" y="10" width="14" height="2" rx="1"/>
              </svg>
              По ширине
            </button>
          </div>
        </div>

        <div style={row}>
          <div style={label}>Тема</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {(Object.keys(THEMES) as Theme[]).map(t => {
              const active = settings.theme === t;
              return (
                <button key={t} onClick={() => setTheme(t)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
                  {/* Swatch styled like a mini book page */}
                  <div style={{ position: "relative", width: 44, height: 52 }}>
                    {/* Page shadow / depth layers */}
                    <div style={{ position: "absolute", bottom: 0, left: 2, right: 2, height: 48, background: THEMES[t].bg, borderRadius: "6px 6px 4px 4px", boxShadow: "1px 1px 3px rgba(0,0,0,0.18)", opacity: 0.6, transform: "rotate(-1.5deg)" }} />
                    <div style={{ position: "absolute", bottom: 0, left: 1, right: 1, height: 50, background: THEMES[t].bg, borderRadius: "6px 6px 4px 4px", boxShadow: "1px 1px 2px rgba(0,0,0,0.13)", opacity: 0.8, transform: "rotate(0.7deg)" }} />
                    {/* Main page */}
                    <div style={{
                      position: "absolute", bottom: 0, left: 0, right: 0, height: 52,
                      borderRadius: "7px 7px 4px 4px",
                      background: THEMES[t].bg,
                      border: active ? `2.5px solid ${colors.accent}` : `1.5px solid ${THEMES[t].border || "rgba(0,0,0,0.12)"}`,
                      boxShadow: active
                        ? `0 0 0 3px ${colors.accent}30, 0 2px 8px rgba(0,0,0,0.14)`
                        : "0 2px 6px rgba(0,0,0,0.10)",
                      transition: "all 0.15s",
                    }}>
                      {/* Faint text lines to simulate book page */}
                      <div style={{ padding: "8px 6px 0", display: "flex", flexDirection: "column", gap: 3 }}>
                        {[100, 70, 85].map((w, i) => (
                          <div key={i} style={{ height: 2, width: `${w}%`, borderRadius: 2, background: THEMES[t].text, opacity: 0.12 }} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: 10, color: active ? colors.text : colors.muted, fontWeight: active ? 600 : 400 }}>
                    {THEME_LABELS[t]}
                  </span>
                </button>
              );
            })}
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
    <>
      {/* No full-screen backdrop — it would block scroll events on EN/RU panels.
          Closing is handled by onClick on EN/RU panels and the ✕ button. */}
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12 }}>
          {panel.kind === "dict" && (
            <span style={{ fontSize: 12, color: colors.muted, fontStyle: "italic" }}>
              «{panel.word}»
            </span>
          )}
          <button
            onClick={onClose}
            aria-label="Закрыть словарь"
            style={{ marginLeft: "auto", background: "transparent", border: "none", cursor: "pointer", color: colors.muted, padding: "4px 2px", display: "flex" }}
          >
            <X size={18} />
          </button>
        </div>
        {panel.kind === "dict" && (
          <WordDict word={panel.word} context={panel.paragraph.originalText} colors={colors} />
        )}
      </div>
    </>
  );
}

// ── Scroll sync helpers ────────────────────────────────────────────────────────
// Per-paragraph DOM positions used for paragraph-fraction sync.
// Each entry maps one EN paragraph element's scroll range to the matching RU element.
interface ParaPos {
  id: number;
  enTop: number;    // offsetTop within EN scroll container
  enBottom: number; // enTop + offsetHeight
  ruTop: number;    // offsetTop within RU scroll container
  ruBottom: number; // ruTop + offsetHeight
}

// Measure element's top offset relative to a scroll container.
function offsetInContainer(el: HTMLElement, container: HTMLElement): number {
  return el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
}

// Compute the RU scroll target that keeps the same fractional position
// within the paragraph currently visible at the top of the EN panel.
// Falls back to proportional when no paragraph data is available.
function paragraphSync(
  en: HTMLElement,
  ru: HTMLElement,
  positions: ParaPos[],
): number {
  if (positions.length === 0) {
    const enS = en.scrollHeight - en.clientHeight;
    const ruS = ru.scrollHeight - ru.clientHeight;
    return enS > 0 ? (en.scrollTop / enS) * ruS : 0;
  }

  const enTop = en.scrollTop;
  // Find the last paragraph whose enTop <= scroll position (binary search).
  // That paragraph "contains" the current view — even if the view is past its enBottom
  // (which can happen at the boundary between two paragraphs).
  let lo = 0, hi = positions.length - 1, idx = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (positions[mid].enTop <= enTop) { idx = mid; lo = mid + 1; }
    else { hi = mid - 1; }
  }
  const p = positions[idx];
  const enSpan = p.enBottom - p.enTop;
  const fraction = enSpan > 0 ? Math.max(0, Math.min(1, (enTop - p.enTop) / enSpan)) : 0;
  const ruSpan = p.ruBottom - p.ruTop;
  return p.ruTop + fraction * ruSpan;
}

function clampRu(ru: HTMLElement, pos: number): number {
  return Math.max(0, Math.min(ru.scrollHeight - ru.clientHeight, pos));
}

// ── Main Reader ────────────────────────────────────────────────────────────────
export default function ReaderPage() {
  const { id } = useParams<{ id: string }>();
  const bookId = parseInt(id || "0", 10);

  const { settings, setTheme, setFontSize, setFontFamily, setLineSpacing, setMargin, setTextAlign } = useReaderSettings();
  const colors = THEMES[settings.theme];

  // Load saved reading progress for this book (before first render)
  const savedProgress = bookId ? loadProgress(bookId) : null;

  // Incremental batch loading — start from saved batch if available
  const [currentBatch, setCurrentBatch] = useState(savedProgress?.lastBatch ?? 1);
  const [totalBatches, setTotalBatches] = useState(1);
  const [allParagraphs, setAllParagraphs] = useState<Paragraph[]>([]);
  const loadingNextBatch = useRef(false);
  // Track the very first batch we loaded this session — to account for paragraphs
  // from batches 1..(startBatch-1) that are NOT in displayParagraphs but were read before
  const startBatchRef = useRef(savedProgress?.lastBatch ?? 1);
  // Scroll ratio to restore after paragraphs load (null = nothing pending)
  const pendingRestoreRatio = useRef<number | null>(savedProgress?.scrollRatio ?? null);

  const [panel, setPanel] = useState<PanelState>({ kind: "hidden" });
  const [showSettings, setShowSettings] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  // Global toggle: show or hide Russian translations
  const [showTranslations, setShowTranslations] = useState(true);

  // ── Sentence sync mode ────────────────────────────────────────────────────
  // Allows user to manually anchor EN sentence N ↔ RU sentence M for a paragraph.
  // The offset (M - N) is stored per paragraph in localStorage and applied to
  // all subsequent word-tap lookups for that paragraph.
  type SyncPhase =
    | { phase: "off" }
    | { phase: "waitEn" }
    | { phase: "waitRu"; paraId: number; enIdx: number };
  const [syncState, setSyncState] = useState<SyncPhase>({ phase: "off" });
  // Keep a ref so callbacks always see the latest state without re-creating.
  const syncStateRef = useRef<SyncPhase>({ phase: "off" });
  syncStateRef.current = syncState;
  // Per-paragraph sentence offset: paraId → (ruSentenceIdx - enSentenceIdx).
  const [syncAnchors, setSyncAnchors] = useState<Record<number, number>>(() => {
    try { return JSON.parse(localStorage.getItem("lingua-sent-anchors") ?? "{}") as Record<number, number>; }
    catch { return {}; }
  });
  const syncAnchorsRef = useRef(syncAnchors);
  syncAnchorsRef.current = syncAnchors;
  const toggleSyncMode = useCallback(() => {
    setSyncState(s => s.phase === "off" ? { phase: "waitEn" } : { phase: "off" });
  }, []);
  // Chapter navigation: id of paragraph we want to scroll to after load
  const [pendingScrollId, setPendingScrollId] = useState<number | null>(null);

  // Two synced scroll panels — EN on top, RU on bottom
  const enRef = useRef<HTMLDivElement>(null);
  const ruRef = useRef<HTMLDivElement>(null);

  // ── Scroll sync state ──────────────────────────────────────────────────────
  // ruOffset: how many px RU deviates from paragraph-synced position.
  // Set by: manual RU scroll, or word click. Persists across EN scroll events.
  const ruOffset = useRef(0);
  // lastProgRuWrite: performance.now() timestamp of the last time WE wrote
  // ru.scrollTop programmatically. handleRuScroll ignores scroll events that
  // fire within 100ms of such a write (they are echoes, not manual scrolls).
  // Using a timestamp avoids clearTimeout/setTimeout churn on every EN scroll event.
  const lastProgRuWrite = useRef(0);
  // Cached paragraph positions (EN + RU offsets). Rebuilt after each render
  // that changes paragraph layout. Used by paragraphSync() in the scroll hot path.
  const paraPositions = useRef<ParaPos[]>([]);

  const scrollPctRef = useRef(0);
  const [scrollPct, setScrollPct] = useState(0);
  const scrollPctTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sentinel div at the bottom of the EN panel to trigger next batch load
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data: bookOnline, isLoading: isLoadingBookOnline } = useGetBook(bookId, {
    query: { enabled: !!bookId, queryKey: getGetBookQueryKey(bookId) },
  });

  // Offline fallback: load book metadata from IDB when network is unavailable
  const [offlineBook, setOfflineBook] = useState<CachedBook | null>(null);
  const [isLoadingOfflineBook, setIsLoadingOfflineBook] = useState(false);

  useEffect(() => {
    if (!bookId || isLoadingBookOnline || bookOnline) return;
    // Network fetch finished with no result → try IDB
    setIsLoadingOfflineBook(true);
    loadBook(bookId).then(b => { setOfflineBook(b); setIsLoadingOfflineBook(false); }).catch(() => setIsLoadingOfflineBook(false));
  }, [bookId, isLoadingBookOnline, bookOnline]);

  // Persist book metadata to IDB whenever we get it from network
  useEffect(() => {
    if (!bookOnline) return;
    saveBook({
      id: bookOnline.id,
      title: bookOnline.title,
      author: bookOnline.author ?? null,
      language: bookOnline.language ?? "en",
      totalParagraphs: bookOnline.totalParagraphs ?? 0,
      translatedParagraphs: bookOnline.translatedParagraphs ?? 0,
      translationStatus: bookOnline.translationStatus ?? "pending",
      cachedAt: Date.now(),
    }).catch(() => {});
  }, [bookOnline]);

  const book = bookOnline ?? offlineBook;
  const isLoadingBook = isLoadingBookOnline || isLoadingOfflineBook;

  const { data: paragraphsData, isSuccess } = useParagraphsOffline(
    bookId,
    currentBatch,
    !!bookId,
  );

  const { data: statusData } = useGetTranslationStatus(bookId, {
    query: {
      enabled: !!bookId && !!bookOnline, // skip when offline
      refetchInterval: 5000,
      queryKey: getGetTranslationStatusQueryKey(bookId),
    },
  });

  const { data: chaptersData } = useGetBookChapters(bookId, {
    query: { enabled: !!bookId && !!bookOnline, queryKey: getGetBookChaptersQueryKey(bookId) },
  });

  // Background prefetch ALL paragraph batches for offline use
  // Runs once when book metadata arrives while we're online
  useEffect(() => {
    if (!bookOnline || !bookId) return;
    const totalPages = Math.ceil((bookOnline.totalParagraphs ?? 0) / PAGE_SIZE);
    if (totalPages <= 0) return;

    // Fetch pages sequentially in the background, skipping the current one
    // (already being loaded by useParagraphsOffline)
    let active = true;
    const prefetch = async () => {
      for (let page = 1; page <= totalPages && active; page++) {
        if (page === currentBatch) continue; // already loading
        try {
          const res = await fetch(`/api/books/${bookId}/paragraphs?page=${page}&pageSize=${PAGE_SIZE}`);
          if (!res.ok || !active) continue;
          const data = await res.json();
          await saveParagraphPage(bookId, page, data);
        } catch {
          // silently skip — network may be gone mid-prefetch
        }
        // Yield between pages to avoid blocking the main thread
        await new Promise(r => setTimeout(r, 200));
      }
    };
    prefetch();
    return () => { active = false; };
  // Only re-run if book or bookId changes (NOT currentBatch — don't restart on scroll)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookOnline?.id, bookId]);

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

  // Deduplicate consecutive heading paragraphs with identical text (DB artifact)
  const displayParagraphs = useMemo(() => {
    const seen = new Set<string>();
    return allParagraphs.filter(p => {
      if (!isHeadingParagraph(p.originalText)) return true;
      const key = p.originalText.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [allParagraphs]);

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

  // Navigate to a chapter: load enough batches, then scroll to the paragraph element
  const navigateToChapter = useCallback((paragraphId: number, position: number) => {
    const neededBatch = Math.ceil((position + 1) / PAGE_SIZE);
    ruOffset.current = 0; // reset any manual offset so RU syncs cleanly after navigation
    setPendingScrollId(paragraphId);
    setCurrentBatch(prev => Math.max(prev, neededBatch));
  }, []);

  // Remember this book as last opened
  useEffect(() => {
    if (bookId) saveLastBook(bookId);
  }, [bookId]);

  // Auto-start background translation if not yet complete
  useEffect(() => {
    if (!statusData) return;
    if (statusData.status === "completed") return;
    // Fire-and-forget: the SSE stream runs in the background, polling will pick up progress
    fetch(`/api/books/${bookId}/translate`, { method: "POST" }).catch(() => {});
  }, [statusData?.status, bookId]);

  // Restore scroll position once enough paragraphs are loaded, then focus EN panel for keyboard scrolling
  useEffect(() => {
    if (allParagraphs.length === 0) return;
    const timer = setTimeout(() => {
      const en = enRef.current;
      if (!en) return;
      if (pendingRestoreRatio.current !== null) {
        const scrollable = en.scrollHeight - en.clientHeight;
        if (scrollable > 0) {
          en.scrollTop = pendingRestoreRatio.current! * scrollable;
          const ru = ruRef.current;
          if (ru) {
            const ruS = ru.scrollHeight - ru.clientHeight;
            // Use proportional position on restore — smooth and consistent
            ru.scrollTop = Math.max(0, Math.min(ruS, paragraphSync(en, ru, paraPositions.current)));
          }
        }
        pendingRestoreRatio.current = null;
      }
      // Auto-focus so keyboard scrolling works immediately
      en.focus({ preventScroll: true });
    }, 120);
    return () => clearTimeout(timer);
  }, [allParagraphs]);

  // When RU panel becomes visible again, sync its position to current EN position
  useEffect(() => {
    if (!showTranslations) return;
    const timer = setTimeout(() => {
      const en = enRef.current;
      const ru = ruRef.current;
      if (!en || !ru) return;
      const ruS = ru.scrollHeight - ru.clientHeight;
      ru.scrollTop = clampRu(ru, paragraphSync(en, ru, paraPositions.current) + ruOffset.current);
    }, 50); // wait for panel to mount + render
    return () => clearTimeout(timer);
  }, [showTranslations]);

  // After batches load: if we have a pending scroll target, execute it
  useEffect(() => {
    if (pendingScrollId === null) return;
    const target = allParagraphs.find(p => p.id === pendingScrollId);
    if (!target) return; // not loaded yet — will retry when more batches arrive
    const el = document.getElementById(`para-${pendingScrollId}`);
    const container = enRef.current;
    if (el && container) {
      // offsetTop relative to scroll container
      const top = el.offsetTop - container.offsetTop;
      container.scrollTo({ top: Math.max(0, top - 12), behavior: "smooth" });
    }
    setPendingScrollId(null);
  }, [allParagraphs, pendingScrollId]);

  // Debounced save of reading progress
  const saveProgressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveProgressDebounced = useCallback((ratio: number) => {
    if (saveProgressTimer.current) clearTimeout(saveProgressTimer.current);
    saveProgressTimer.current = setTimeout(() => {
      saveProgress(bookId, { scrollRatio: ratio, lastBatch: currentBatch });
    }, 800);
  }, [bookId, currentBatch]);

  // ── Paragraph position cache ────────────────────────────────────────────────
  // After every layout change (new batch loaded, font settings changed), measure
  // the EN and RU offsets of each paragraph pair and cache them. The scroll hot
  // path uses these cached values via binary search — zero DOM queries per scroll.
  useLayoutEffect(() => {
    const en = enRef.current;
    const ru = ruRef.current;
    if (!en || !ru || displayParagraphs.length === 0) return;
    // Defer to next animation frame so browser finishes computing layout first
    const raf = requestAnimationFrame(() => {
      const positions: ParaPos[] = [];
      for (const p of displayParagraphs) {
        const enEl = document.getElementById(`para-${p.id}`);
        const ruEl = ru.querySelector<HTMLElement>(`[data-ru-para="${p.id}"]`);
        if (!enEl || !ruEl) continue;
        const enT = offsetInContainer(enEl, en);
        const ruT = offsetInContainer(ruEl, ru);
        positions.push({
          id: p.id,
          enTop: enT,
          enBottom: enT + enEl.offsetHeight,
          ruTop: ruT,
          ruBottom: ruT + ruEl.offsetHeight,
        });
      }
      paraPositions.current = positions;
    });
    return () => cancelAnimationFrame(raf);
  // book is included so that when the book metadata arrives (making isLoadingBook go false
  // and the EN/RU panels mount), we rebuild positions even if displayParagraphs didn't change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayParagraphs, settings.fontSize, settings.fontFamily, settings.lineSpacing, showTranslations, book]);


  // ── EN scroll handler: syncs RU synchronously (same frame) for visual smoothness ──
  const handleEnScroll = useCallback(() => {
    const en = enRef.current;
    if (!en) return;

    // Progress tracking (throttled to ≤ 6 re-renders/s via 150ms cooldown)
    const scrollable = en.scrollHeight - en.clientHeight;
    const ratio = scrollable > 0 ? Math.min(1, en.scrollTop / scrollable) : 0;
    scrollPctRef.current = ratio;
    if (!scrollPctTimer.current) {
      scrollPctTimer.current = setTimeout(() => {
        scrollPctTimer.current = null;
        setScrollPct(scrollPctRef.current);
      }, 150);
    }
    saveProgressDebounced(ratio);

    // Sync RU using paragraph-fraction sync: same fractional position within the
    // paragraph visible at the top of EN. Zero DOM queries — uses cached positions.
    const r = ruRef.current;
    if (!r) return;
    const target = clampRu(r, paragraphSync(en, r, paraPositions.current) + ruOffset.current);
    if (r.scrollTop === target) return;
    // Stamp before writing so handleRuScroll treats this as a programmatic echo.
    lastProgRuWrite.current = performance.now();
    r.scrollTop = target;
  }, [saveProgressDebounced]);

  // ── RU scroll handler: records manual offset; ignores programmatic echoes ──
  const handleRuScroll = useCallback(() => {
    // Ignore scroll events that are echoes of our own programmatic ru.scrollTop
    // writes. We compare against a timestamp because a timer-based lock would
    // require clearTimeout+setTimeout on every EN scroll event (120+/sec on
    // high-refresh mobile), causing unnecessary CPU load. 100ms covers any
    // delayed scroll-event delivery on slow/busy mobile CPUs.
    if (performance.now() - lastProgRuWrite.current < 100) return;
    const ru = ruRef.current;
    const en = enRef.current;
    if (!ru || !en) return;
    // Guard: only update ruOffset when positions are ready. If positions are empty
    // the proportional fallback gives a wrong offset that will break sync once
    // positions are rebuilt.
    if (paraPositions.current.length > 0) {
      ruOffset.current = ru.scrollTop - paragraphSync(en, ru, paraPositions.current);
    }
  }, []);

  // Sync theme to body background
  useEffect(() => {
    document.body.style.background = colors.bg;
    document.documentElement.style.background = colors.bg;
  }, [colors.bg]);

  const handleWordDoubleClick = useCallback((word: string, p: Paragraph) => {
    setPanel({ kind: "dict", word, paragraph: p });
    setShowSettings(false);
  }, []);

  // ── Single tap on EN word ─────────────────────────────────────────────────
  // In normal mode: scroll RU to matching sentence, applying any stored offset.
  // In sync mode (waitEn or waitRu): record the EN sentence and scroll RU to
  // the paragraph so user can tap the corresponding RU sentence.
  const handleWordClick = useCallback((p: Paragraph, sentenceIdx: number) => {
    const ru = ruRef.current;
    const en = enRef.current;
    if (!ru || !en) return;

    const state = syncStateRef.current;
    if (state.phase === "waitEn" || state.phase === "waitRu") {
      // Select/re-select EN sentence; scroll RU to show the same paragraph.
      setSyncState({ phase: "waitRu", paraId: p.id, enIdx: sentenceIdx });
      const paraEl = ru.querySelector<HTMLElement>(`[data-ru-para="${p.id}"]`);
      if (paraEl) {
        const delta = paraEl.getBoundingClientRect().top - ru.getBoundingClientRect().top;
        lastProgRuWrite.current = performance.now();
        ru.scrollTop = clampRu(ru, ru.scrollTop + delta);
        if (paraPositions.current.length > 0) {
          ruOffset.current = ru.scrollTop - paragraphSync(en, ru, paraPositions.current);
        }
      }
      return;
    }

    // Normal mode — apply stored paragraph offset then find the sentence element.
    const offset = syncAnchorsRef.current[p.id] ?? 0;
    const adjustedIdx = Math.max(0, sentenceIdx + offset);
    const el =
      ru.querySelector<HTMLElement>(`[data-ru-sentence="${p.id}-${adjustedIdx}"]`) ??
      ru.querySelector<HTMLElement>(`[data-ru-para="${p.id}"]`);
    if (!el) return;
    const delta = el.getBoundingClientRect().top - ru.getBoundingClientRect().top;
    lastProgRuWrite.current = performance.now();
    ru.scrollTop = clampRu(ru, ru.scrollTop + delta);
    if (paraPositions.current.length > 0) {
      ruOffset.current = ru.scrollTop - paragraphSync(en, ru, paraPositions.current);
    }
  }, []);

  // ── RU sentence tap in sync mode → save alignment anchor ─────────────────
  const handleRuSentenceClick = useCallback((paraId: number, ruIdx: number) => {
    const state = syncStateRef.current;
    if (state.phase !== "waitRu" || state.paraId !== paraId) return;
    const offset = ruIdx - state.enIdx;
    setSyncAnchors(prev => {
      const next = { ...prev, [paraId]: offset };
      try { localStorage.setItem("lingua-sent-anchors", JSON.stringify(next)); } catch { /* ignore */ }
      syncAnchorsRef.current = next;
      return next;
    });
    // Stay in sync mode — user can continue anchoring more paragraphs.
    setSyncState({ phase: "waitEn" });
  }, []);

  const closePanel = useCallback(() => setPanel({ kind: "hidden" }), []);

  const bodyFont = FONT_FAMILIES[settings.fontFamily].css;
  const headingFont = "Georgia, 'Times New Roman', serif";
  const lineHeight = LINE_SPACINGS[settings.lineSpacing].value;

  // Progress info
  const translatedPct = statusData ? Math.round(statusData.progressPercent ?? 0) : null;
  const totalParas = book?.totalParagraphs ?? 0;
  // Global read %: scrollPct is relative to currently-loaded paragraphs only.
  // Batches before startBatch were read in a previous session — count their paragraphs too.
  const parasBeforeStart = (startBatchRef.current - 1) * PAGE_SIZE;
  const globalReadPct = totalParas > 0
    ? Math.min(1, (parasBeforeStart + scrollPct * displayParagraphs.length) / totalParas)
    : scrollPct;
  // Remaining = paragraphs not yet passed by the reader
  const parasRead = globalReadPct * totalParas;
  const remainingParas = Math.max(0, totalParas - parasRead);

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

  const NAV_H = 50;    // px nav row
  const PROG_H = 3;    // px progress bar
  const SYNC_BAR_H = syncState.phase !== "off" ? 30 : 0; // sync status bar
  const HEADER_H = NAV_H + PROG_H + SYNC_BAR_H;

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: colors.bg, color: colors.text }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes headerReveal{from{transform:translateY(-${NAV_H}px)}to{transform:translateY(0)}}
      `}</style>

      {/* ── Always-visible progress bar (top: 0) ─────────────────────── */}
      <div
        onClick={() => { if (!showHeader) setShowHeader(true); }}
        style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 32,
          height: showHeader ? PROG_H : 20,
          cursor: showHeader ? "default" : "pointer",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: PROG_H, background: colors.border }}>
          <div style={{ width: `${globalReadPct * 100}%`, height: "100%", background: colors.accent, transition: "width 0.3s" }} />
        </div>
        {/* Chevron indicator — only shown when header is hidden */}
        {!showHeader && (
          <div style={{
            position: "absolute", top: PROG_H, left: "50%", transform: "translateX(-50%)",
            width: 28, height: 14,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: colors.headerBg,
            borderRadius: "0 0 8px 8px",
            borderBottom: `1px solid ${colors.border}`,
            borderLeft: `1px solid ${colors.border}`,
            borderRight: `1px solid ${colors.border}`,
            boxShadow: "0 2px 6px rgba(0,0,0,0.10)",
          }}>
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
              <path d="M1 1l4 4 4-4" stroke={colors.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}
      </div>

      {/* ── Nav header — slides away when showHeader=false ───────────── */}
      <header style={{
        position: "fixed", top: PROG_H, left: 0, right: 0, zIndex: 30,
        background: colors.headerBg,
        borderBottom: `1px solid ${colors.border}`,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        transform: showHeader ? "translateY(0)" : `translateY(-${NAV_H}px)`,
        transition: "transform 0.25s ease",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 10px", height: NAV_H }}>
          <Link href="/?back=1">
            <button style={{ height: 34, width: 34, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "transparent", border: "none", cursor: "pointer", color: colors.muted }}>
              <ArrowLeft size={17} />
            </button>
          </Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: colors.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {book.title}
            </div>
            <div style={{ fontSize: 11, color: colors.muted, marginTop: 1 }}>
              {Math.round(globalReadPct * 100)}%
              {remainingParas > 0 && ` · ${timeLeft(remainingParas)} осталось`}
              {translatedPct !== null && translatedPct < 100 && (
                <span style={{ marginLeft: 6, color: colors.accent }}>⟳ {translatedPct}% пер.</span>
              )}
            </div>
          </div>
          <button onClick={() => { setShowToc(s => !s); setShowSettings(false); setShowSearch(false); }} style={{ height: 34, width: 34, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "transparent", border: "none", cursor: "pointer", color: colors.muted }}>
            <List size={17} />
          </button>
          <button onClick={() => { setShowSearch(s => !s); setShowToc(false); setShowSettings(false); }} style={{ height: 34, width: 34, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "transparent", border: "none", cursor: "pointer", color: colors.muted }}>
            <Search size={17} />
          </button>
          <button onClick={() => { setShowSettings(s => !s); setShowToc(false); setShowSearch(false); }} style={{ height: 34, width: 34, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "transparent", border: "none", cursor: "pointer", color: colors.muted }}>
            <Settings2 size={17} />
          </button>
          {/* Sentence sync mode button */}
          <button
            onClick={toggleSyncMode}
            title="Привязка предложений EN↔RU"
            style={{
              height: 34, width: 34, display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: "50%", border: "none", cursor: "pointer",
              background: syncState.phase !== "off" ? colors.accent + "22" : "transparent",
              color: syncState.phase !== "off" ? colors.accent : colors.muted,
            }}
          >
            <Link2 size={15} />
          </button>
          {/* Hide header button */}
          <button
            onClick={() => setShowHeader(false)}
            title="Скрыть панель"
            style={{ height: 34, width: 34, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "transparent", border: "none", cursor: "pointer", color: colors.muted }}
          >
            <EyeOff size={15} />
          </button>
        </div>

        {/* Sync mode status bar — shown only when sync mode is active */}
        {syncState.phase !== "off" && (
          <div style={{
            padding: "5px 14px 7px",
            fontSize: 11,
            lineHeight: 1.4,
            display: "flex", alignItems: "center", gap: 6,
            borderTop: `1px solid ${colors.border}`,
            color: syncState.phase === "waitRu" ? colors.accent : colors.muted,
          }}>
            <Link2 size={10} style={{ flexShrink: 0 }} />
            {syncState.phase === "waitEn"
              ? "Тапните слово в англ. тексте — выберите предложение для привязки"
              : "Предложение выбрано. Тапните соответствующее предложение в рус. переводе"}
          </div>
        )}
      </header>


      {/* ── Two synced scroll panels ──────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", paddingTop: showHeader ? HEADER_H : PROG_H, transition: "padding-top 0.25s ease" }}>

        {/* EN panel — takes 85% of space when RU is visible */}
        <div
          ref={enRef}
          onScroll={handleEnScroll}
          tabIndex={0}
          style={{
            flex: 17,
            overflowY: "auto",
            overflowX: "hidden",
            WebkitOverflowScrolling: "touch" as never,
            outline: "none",
          }}
          onClick={() => { if (panel.kind !== "hidden") closePanel(); }}
        >
          {displayParagraphs.length === 0 && (
            <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
              <Loader2 size={22} style={{ color: colors.muted, animation: "spin 1s linear infinite" }} />
            </div>
          )}

          {displayParagraphs.map(p => (
            <div key={p.id} id={`para-${p.id}`}>
              <BookParagraph
                paragraph={p}
                mode="en"
                onWordClick={handleWordClick}
                onWordDoubleClick={handleWordDoubleClick}
                highlightSentenceIdx={
                  syncState.phase === "waitRu" && syncState.paraId === p.id
                    ? syncState.enIdx
                    : undefined
                }
                colors={colors}
                fontSize={settings.fontSize}
                fontFamily={bodyFont}
                headingFontFamily={headingFont}
                lineHeight={lineHeight}
                textAlign={settings.textAlign}
              />
            </div>
          ))}

          {/* Sentinel — triggers next batch load */}
          <div ref={sentinelRef} style={{ height: 1 }} />

          {loadingNextBatch.current && (
            <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
              <Loader2 size={18} style={{ color: colors.muted, animation: "spin 1s linear infinite" }} />
            </div>
          )}

          {currentBatch >= totalBatches && displayParagraphs.length > 0 && (
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

            {/* RU scroll panel — ~18% height, smaller font size */}
            <div
              ref={ruRef}
              onScroll={handleRuScroll}
              onClick={() => { if (panel.kind !== "hidden") closePanel(); }}
              style={{
                flex: 3.75,
                overflowY: "auto",
                overflowX: "hidden",
                WebkitOverflowScrolling: "touch" as never,
              }}
            >
              {displayParagraphs.map(p => (
                <div key={p.id} data-ru-para={p.id}>
                  <BookParagraph
                    paragraph={p}
                    mode="ru"
                    onSentenceClick={
                      syncState.phase === "waitRu" && syncState.paraId === p.id
                        ? handleRuSentenceClick
                        : undefined
                    }
                    colors={colors}
                    fontSize={Math.max(10, Math.round(settings.fontSize * 0.75))}
                    fontFamily={bodyFont}
                    headingFontFamily={headingFont}
                    lineHeight={lineHeight}
                    textAlign={settings.textAlign}
                  />
                </div>
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

      {/* ── TOC drawer ───────────────────────────────────────────────── */}
      {showToc && (
        <TocDrawer
          chapters={chaptersData?.chapters ?? []}
          colors={colors}
          fontSize={settings.fontSize - 1}
          onNavigate={ch => navigateToChapter(ch.id, ch.position)}
          onClose={() => setShowToc(false)}
          readingPct={globalReadPct}
          totalParagraphs={book?.totalParagraphs ?? 0}
        />
      )}

      {/* ── Search panel ─────────────────────────────────────────────── */}
      {showSearch && bookId && (
        <SearchPanel
          bookId={bookId}
          colors={colors}
          fontSize={settings.fontSize}
          onNavigate={(id, pos) => navigateToChapter(id, pos)}
          onClose={() => setShowSearch(false)}
        />
      )}

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
          setTextAlign={setTextAlign}
        />
      )}

      {/* ── Dictionary drawer ────────────────────────────────────────── */}
      <DictDrawer panel={panel} colors={colors} onClose={closePanel} />
    </div>
  );
}
