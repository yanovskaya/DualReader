import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { useParams, Link, useLocation } from "wouter";
import {
  useGetBook,
  getGetBookQueryKey,
  useGetTranslationStatus,
  getGetTranslationStatusQueryKey,
  useGetBookChapters,
  getGetBookChaptersQueryKey,
  useGetChapterIllustrations,
  useGenerateIllustrations,
  useLookupWord,
  getLookupWordQueryKey,
} from "@workspace/api-client-react";
import { useParagraphsOffline } from "@/hooks/use-paragraphs-offline";
import { saveBook, loadBook, saveParagraphPage } from "@/lib/idb";
import type { CachedBook } from "@/lib/idb";
import type { Paragraph } from "@workspace/api-client-react/src/generated/api.schemas";
import { Loader2, ArrowLeft, X, Settings2, List, EyeOff, Search, Bookmark, ImageIcon, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { BookParagraph } from "@/components/book-paragraph";
import { isHeadingParagraph } from "@/lib/sentences";
import { TocDrawer } from "@/components/toc-drawer";
import { SearchPanel } from "@/components/search-panel";
import { saveLastBook, recordBookOpened, saveBookmark, saveBookmarkToServer, loadBookmark, loadBookmarkFromServer, type Bookmark as BookmarkData } from "@/hooks/use-reading-progress";
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
import {
  loadScrollSpeed,
  saveScrollSpeed,
  SCROLL_SPEED_MIN,
  SCROLL_SPEED_MAX,
} from "@/hooks/use-scroll-speed";

const PAGE_SIZE = 40;

// ── Dictionary entry ───────────────────────────────────────────────────────────
function WordDict({ word, context, colors }: { word: string; context: string; colors: ThemeColors }) {
  const clean = word.toLowerCase().replace(/[^\w\s-]/g, "").trim();

  const shortContext = (() => {
    const lower = context.toLowerCase();
    const pos = lower.indexOf(clean);
    if (pos < 0) return context.slice(0, 300);
    let start = pos;
    while (start > 0 && context[start - 1] !== "." && context[start - 1] !== "\n") start--;
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
        staleTime: 1000 * 60 * 60 * 24 * 7,
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

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {entry.translations.map((t, i) => {
          const syn = entry.synonyms?.[i];
          return (
            <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 11, color: colors.muted, minWidth: 16, textAlign: "right" }}>{i + 1}.</span>
              <span style={{ fontSize: i === 0 ? 17 : 15, fontWeight: i === 0 ? 600 : 400, color: colors.text }}>
                {t}
              </span>
              {syn && (
                <span style={{ fontSize: 12, color: colors.muted, fontStyle: "italic" }}>({syn})</span>
              )}
            </div>
          );
        })}
      </div>

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
function SettingsSheet({ colors, settings, onClose, setTheme, setFontSize, setFontFamily, setLineSpacing, setMargin, setTextAlign, scrollSpeed, setScrollSpeed, onRegenerateIllustrations, isRegenerating }: {
  colors: ThemeColors;
  settings: ReturnType<typeof useReaderSettings>["settings"];
  onClose: () => void;
  setTheme: (v: Theme) => void;
  setFontSize: (v: number) => void;
  setFontFamily: (v: FontFamily) => void;
  setLineSpacing: (v: LineSpacing) => void;
  setMargin: (v: Margin) => void;
  setTextAlign: (v: TextAlign) => void;
  scrollSpeed: number;
  setScrollSpeed: (v: number) => void;
  onRegenerateIllustrations?: () => void;
  isRegenerating?: boolean;
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
          <div style={label}>Скорость прокрутки перевода — {scrollSpeed.toFixed(1)}×</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: colors.muted }}>Мед.</span>
            <input
              type="range"
              min={SCROLL_SPEED_MIN}
              max={SCROLL_SPEED_MAX}
              step={0.1}
              value={scrollSpeed}
              onChange={e => setScrollSpeed(parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: colors.accent }}
            />
            <span style={{ fontSize: 12, color: colors.muted }}>Быст.</span>
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
              <svg width="14" height="12" viewBox="0 0 14 12" fill="currentColor">
                <rect x="0" y="0" width="14" height="2" rx="1"/>
                <rect x="0" y="5" width="10" height="2" rx="1"/>
                <rect x="0" y="10" width="12" height="2" rx="1"/>
              </svg>
              По левому краю
            </button>
            <button onClick={() => setTextAlign("justify")} style={{ ...chip(settings.textAlign === "justify"), display: "flex", alignItems: "center", gap: 6 }}>
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
                  <div style={{ position: "relative", width: 44, height: 52 }}>
                    <div style={{ position: "absolute", bottom: 0, left: 2, right: 2, height: 48, background: THEMES[t].bg, borderRadius: "6px 6px 4px 4px", boxShadow: "1px 1px 3px rgba(0,0,0,0.18)", opacity: 0.6, transform: "rotate(-1.5deg)" }} />
                    <div style={{ position: "absolute", bottom: 0, left: 1, right: 1, height: 50, background: THEMES[t].bg, borderRadius: "6px 6px 4px 4px", boxShadow: "1px 1px 2px rgba(0,0,0,0.13)", opacity: 0.8, transform: "rotate(0.7deg)" }} />
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

        {/* Regenerate illustrations */}
        {onRegenerateIllustrations && (
          <div style={{ borderTop: `1px solid ${colors.border}`, marginTop: 4, paddingTop: 20 }}>
            <button
              onClick={() => { onRegenerateIllustrations(); onClose(); }}
              disabled={isRegenerating}
              style={{
                width: "100%", padding: "11px 16px",
                borderRadius: 12,
                border: `1.5px solid ${colors.border}`,
                background: "transparent",
                color: isRegenerating ? colors.muted : colors.text,
                fontSize: 14, fontWeight: 500, cursor: isRegenerating ? "default" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "background 0.15s",
              }}
            >
              {isRegenerating
                ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
                : <RefreshCw size={15} />
              }
              {isRegenerating ? "Генерируются иллюстрации…" : "Обновить иллюстрации"}
            </button>
          </div>
        )}
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
interface ParaPos {
  id: number;
  enTop: number;
  enBottom: number;
}

function offsetInContainer(el: HTMLElement, container: HTMLElement): number {
  return el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
}

function syncRuToEn(en: HTMLElement, ru: HTMLElement): number {
  return Math.max(0, Math.min(ru.scrollHeight - ru.clientHeight, en.scrollTop));
}

// ── Main Reader ────────────────────────────────────────────────────────────────
export default function ReaderPage() {
  const { id } = useParams<{ id: string }>();
  const bookId = parseInt(id || "0", 10);
  const [, navigate] = useLocation();

  const { settings, setTheme, setFontSize, setFontFamily, setLineSpacing, setMargin, setTextAlign } = useReaderSettings();
  const colors = THEMES[settings.theme];

  // Load saved bookmark from localStorage (instant, no network)
  const savedBookmark = bookId ? loadBookmark(bookId) : null;
  const initBatch = savedBookmark?.paragraphPosition != null
    ? Math.ceil((savedBookmark.paragraphPosition + 1) / PAGE_SIZE)
    : 1;

  const [currentBatch, setCurrentBatch] = useState(initBatch);
  const currentBatchRef = useRef(initBatch);
  const [totalBatches, setTotalBatches] = useState(1);
  const [allParagraphs, setAllParagraphs] = useState<Paragraph[]>([]);
  const loadingNextBatch = useRef(false);

  // Paragraph-ID based restore: null = nothing pending, number = scroll to this paragraph
  const [pendingRestoreId, setPendingRestoreId] = useState<number | null>(savedBookmark?.paragraphId ?? null);

  const pendingRestoreParagraphOffset = useRef<number>(savedBookmark?.paragraphOffset ?? 0);
  const pendingRestoreRuOffset = useRef<number | null>(savedBookmark?.ruOffset ?? null);

  // True once the restore scroll has executed (or was skipped). Prevents a late
  // server response from bouncing the user back to an old position.
  const hasRestoredRef = useRef(false);


  // Tracks the first visible paragraph — used when the user sets a bookmark
  const firstVisibleParaRef = useRef<{ id: number; position: number; paragraphOffset: number } | null>(null);

  // Bookmark feedback state
  const [bookmarkSaved, setBookmarkSaved] = useState(false);
  const bookmarkSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep currentBatchRef in sync so async callbacks always see the latest value
  useEffect(() => { currentBatchRef.current = currentBatch; }, [currentBatch]);

  // On mount: fetch bookmark from server in the background.
  // Content is always shown immediately (no blocking spinner).
  // If the server returns a position ahead of the local one, and restore
  // hasn't fired yet, we silently update the pending restore target.
  useEffect(() => {
    if (!bookId) return;
    let cancelled = false;

    const run = async () => {
      // Timeout: 2 s — fast enough for a new-device first-open, short enough
      // that offline users never wait.
      const timeout = new Promise<null>(r => setTimeout(() => r(null), 2000));

      const serverBm = await Promise.race([loadBookmarkFromServer(bookId), timeout]);

      if (cancelled) return;

      if (serverBm) {
        // Keep localStorage fresh for the next (same-device) open
        saveBookmark(bookId, serverBm);

        if (!hasRestoredRef.current) {
          const localPos = savedBookmark?.paragraphPosition ?? -1;
          if (serverBm.paragraphPosition > localPos) {
            // Server is ahead — restore to the server position
            setPendingRestoreId(serverBm.paragraphId);
            pendingRestoreParagraphOffset.current = serverBm.paragraphOffset ?? 0;
            const neededBatch = Math.ceil((serverBm.paragraphPosition + 1) / PAGE_SIZE);
            setCurrentBatch(prev => Math.max(prev, neededBatch));
          }
        }
      }

    };

    run();
    return () => { cancelled = true; };
  // Intentionally run only once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  // ── Per-book scroll speed ─────────────────────────────────────────────────
  const [scrollSpeed, setScrollSpeedState] = useState(() => loadScrollSpeed(bookId));
  const scrollSpeedRef = useRef(scrollSpeed);
  const setScrollSpeed = useCallback((v: number) => {
    scrollSpeedRef.current = v;
    setScrollSpeedState(v);
    saveScrollSpeed(bookId, v);
  }, [bookId]);

  const [panel, setPanel] = useState<PanelState>({ kind: "hidden" });
  const [showSettings, setShowSettings] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showIllustration, setShowIllustration] = useState(false);
  const [currentChapterParaId, setCurrentChapterParaId] = useState<number | null>(null);
  const [showHeader, setShowHeader] = useState(true);
  const [showTranslations, setShowTranslations] = useState(true);

  // Chapter navigation: id of paragraph we want to scroll to after load
  const [pendingScrollId, setPendingScrollId] = useState<number | null>(null);

  const enRef = useRef<HTMLDivElement>(null);
  const ruRef = useRef<HTMLDivElement>(null);

  // ── Scroll sync state ──────────────────────────────────────────────────────
  // Track last EN scrollTop to compute delta for RU sync
  const lastEnScrollTop = useRef(0);
  const paraPositions = useRef<ParaPos[]>([]);

  // DOM fallback throttle for paragraph position tracking
  const domFallbackLastRun = useRef<number>(0);

  // Ref to chapters for use in scroll handler without stale closure
  const chaptersRef = useRef<Array<{ id: number; position: number }>>([]);

  // Throttle for updating current-chapter state
  const chapterUpdateThrottle = useRef<number>(0);

  // Sentinel div at the bottom of the EN panel to trigger next batch load
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data: bookOnline, isLoading: isLoadingBookOnline, isError: isBookError } = useGetBook(bookId, {
    query: { enabled: !!bookId, queryKey: getGetBookQueryKey(bookId), retry: 1 },
  });

  const [offlineBook, setOfflineBook] = useState<CachedBook | null>(null);
  const [isLoadingOfflineBook, setIsLoadingOfflineBook] = useState(true);

  // Load IDB book immediately on mount, in parallel with the network request.
  // This means offline users see the book instantly without waiting for a network timeout.
  useEffect(() => {
    if (!bookId) return;
    setIsLoadingOfflineBook(true);
    loadBook(bookId)
      .then(b => { setOfflineBook(b); setIsLoadingOfflineBook(false); })
      .catch(() => setIsLoadingOfflineBook(false));
  }, [bookId]);

  // If the server says the book doesn't exist and IDB has no copy either, go home
  useEffect(() => {
    if (isBookError && !isLoadingOfflineBook && !offlineBook) {
      navigate("/");
    }
  }, [isBookError, isLoadingOfflineBook, offlineBook, navigate]);

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
  // Show spinner only while BOTH network and IDB are still loading.
  // As soon as either returns data (or IDB returns null), we render.
  const isLoadingBook = isLoadingBookOnline && isLoadingOfflineBook;

  const { data: paragraphsData, isSuccess } = useParagraphsOffline(
    bookId,
    currentBatch,
    !!bookId,
  );

  const { data: statusData } = useGetTranslationStatus(bookId, {
    query: {
      enabled: !!bookId && !!bookOnline,
      refetchInterval: 5000,
      queryKey: getGetTranslationStatusQueryKey(bookId),
    },
  });

  const { data: chaptersData } = useGetBookChapters(bookId, {
    query: { enabled: !!bookId && !!bookOnline, queryKey: getGetBookChaptersQueryKey(bookId) },
  });

  const { data: illustrationsData, refetch: refetchIllustrations } = useGetChapterIllustrations(bookId, {
    query: {
      enabled: !!bookId && !!bookOnline,
      queryKey: [`/api/books/${bookId}/chapter-illustrations`],
      refetchInterval: 30000, // re-check as illustrations generate
    },
  });
  // Map from paragraphId → sorted array of imageUrls (by sceneIndex)
  const illustrationMap = useMemo(() => {
    const map = new Map<number, string[]>();
    illustrationsData?.illustrations?.forEach(i => {
      const existing = map.get(i.paragraphId) ?? [];
      existing.push(i.imageUrl);
      map.set(i.paragraphId, existing);
    });
    return map;
  }, [illustrationsData]);

  // Carousel index per chapter (resets when chapter changes)
  const [illustrationIndex, setIllustrationIndex] = useState(0);
  useEffect(() => { setIllustrationIndex(0); }, [currentChapterParaId]);
  const regenerateIllustrationsMutation = useGenerateIllustrations();

  // Background prefetch ALL paragraph batches for offline use
  useEffect(() => {
    if (!bookOnline || !bookId) return;
    const totalPages = Math.ceil((bookOnline.totalParagraphs ?? 0) / PAGE_SIZE);
    if (totalPages <= 0) return;

    let active = true;
    const prefetch = async () => {
      for (let page = 1; page <= totalPages && active; page++) {
        if (page === currentBatch) continue;
        try {
          const res = await fetch(`/api/books/${bookId}/paragraphs?page=${page}&pageSize=${PAGE_SIZE}`);
          if (!res.ok || !active) continue;
          const data = await res.json();
          await saveParagraphPage(bookId, page, data);
        } catch {}
        await new Promise(r => setTimeout(r, 200));
      }
    };
    prefetch();
    return () => { active = false; };
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

  // Deduplicate consecutive heading paragraphs with identical text
  const displayParagraphsRef = useRef<typeof allParagraphs>([]);
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
  useEffect(() => { displayParagraphsRef.current = displayParagraphs; }, [displayParagraphs]);

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

  // Navigate to a chapter
  const navigateToChapter = useCallback((paragraphId: number, position: number) => {
    const neededBatch = Math.ceil((position + 1) / PAGE_SIZE);
    setPendingScrollId(paragraphId);
    setCurrentBatch(prev => Math.max(prev, neededBatch));
  }, []);

  // Remember this book as last opened
  useEffect(() => {
    if (bookId) { saveLastBook(bookId); recordBookOpened(bookId); }
  }, [bookId]);

  // Auto-start background translation if not yet complete
  useEffect(() => {
    if (!statusData) return;
    if (statusData.status === "completed") return;
    fetch(`/api/books/${bookId}/translate`, { method: "POST" }).catch(() => {});
  }, [statusData?.status, bookId]);

  // Restore scroll to bookmark position when paragraphs are available
  useEffect(() => {
    if (allParagraphs.length === 0) return;
    if (pendingRestoreId === null) {
      // Seed firstVisibleParaRef with whichever paragraph is at the top when no bookmark exists,
      // so the bookmark button works immediately without requiring a manual scroll first.
      if (firstVisibleParaRef.current === null && displayParagraphsRef.current.length > 0) {
        const first = displayParagraphsRef.current[0];
        if (first != null && first.position != null) {
          firstVisibleParaRef.current = { id: first.id as number, position: first.position, paragraphOffset: 0 };
        }
      }
      enRef.current?.focus({ preventScroll: true });
      return;
    }
    const paragraphId = pendingRestoreId;
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById(`para-${paragraphId}`);
      const container = enRef.current;
      if (!el || !container) return;
      const top = offsetInContainer(el, container);
      const withinPara = pendingRestoreParagraphOffset.current * el.offsetHeight;
      const newEnTop = Math.max(0, top + withinPara - 12);
      lastEnScrollTop.current = newEnTop; // set BEFORE to neutralise handleEnScroll delta
      container.scrollTop = newEnTop;
      const ru = ruRef.current;
      if (ru) {
        if (pendingRestoreRuOffset.current !== null) {
          // Restore exact RU scroll position saved at bookmark time
          ru.scrollTop = pendingRestoreRuOffset.current;
        } else {
          const ruEl = ru.querySelector(`[data-ru-para="${paragraphId}"]`) as HTMLElement | null;
          if (ruEl) {
            ru.scrollTop = Math.max(0, offsetInContainer(ruEl, ru) - 12);
          }
        }
      }
      // Seed firstVisibleParaRef so bookmark button works immediately after restore
      const restoredPara = allParagraphs.find(p => p.id === paragraphId);
      if (restoredPara != null && restoredPara.position != null) {
        firstVisibleParaRef.current = {
          id: restoredPara.id as number,
          position: restoredPara.position,
          paragraphOffset: pendingRestoreParagraphOffset.current,
        };
      }
      // Mark restore as done — prevents late server response from re-triggering scroll.
      hasRestoredRef.current = true;
      setPendingRestoreId(null);
      container.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [allParagraphs, pendingRestoreId, book]);

  // When RU panel becomes visible again, sync to EN only if RU is still at top
  useEffect(() => {
    if (!showTranslations) return;
    const timer = setTimeout(() => {
      const en = enRef.current;
      const ru = ruRef.current;
      if (!en || !ru) return;
      // Always keep lastEnScrollTop in sync so delta calculation is correct
      lastEnScrollTop.current = en.scrollTop;
      // Only reset RU position if it hasn't been positioned yet (still at 0)
      if (ru.scrollTop === 0) {
        ru.scrollTop = syncRuToEn(en, ru);
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [showTranslations]);

  // After batches load: if we have a pending scroll target, execute it
  useEffect(() => {
    if (pendingScrollId === null) return;
    const target = allParagraphs.find(p => p.id === pendingScrollId);
    if (!target) return;
    const id = pendingScrollId;
    const raf = requestAnimationFrame(() => {
      const enEl = document.getElementById(`para-${id}`);
      const enContainer = enRef.current;
      const ruContainer = ruRef.current;
      if (!enEl || !enContainer) return;
      const newChTop = Math.max(0, offsetInContainer(enEl, enContainer) - 12);
      lastEnScrollTop.current = newChTop; // set BEFORE to neutralise handleEnScroll delta
      enContainer.scrollTop = newChTop;
      // Scroll RU to the matching paragraph directly
      if (ruContainer) {
        const ruEl = ruContainer.querySelector(`[data-ru-para="${id}"]`) as HTMLElement | null;
        if (ruEl) {
          ruContainer.scrollTop = Math.max(0, offsetInContainer(ruEl, ruContainer) - 12);
        }
      }
      setPendingScrollId(null);
    });
    return () => cancelAnimationFrame(raf);
  }, [allParagraphs, pendingScrollId]);

  // ── Paragraph position cache ────────────────────────────────────────────────
  useLayoutEffect(() => {
    const en = enRef.current;
    const ru = ruRef.current;
    if (!en || !ru || displayParagraphs.length === 0) return;
    const positions: ParaPos[] = [];
    for (const p of displayParagraphs) {
      const enEl = document.getElementById(`para-${p.id}`);
      if (!enEl) continue;
      const enT = offsetInContainer(enEl, en);
      positions.push({
        id: p.id,
        enTop: enT,
        enBottom: enT + enEl.offsetHeight,
      });
    }
    paraPositions.current = positions;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayParagraphs, settings.fontSize, settings.fontFamily, settings.lineSpacing, showTranslations, book]);

  // ── EN scroll handler ──────────────────────────────────────────────────────
  const handleEnScroll = useCallback(() => {
    const en = enRef.current;
    if (!en) return;

    // Track first visible paragraph for bookmark placement
    const visiblePos = paraPositions.current.find(p => p.enBottom > en.scrollTop + 10);
    if (visiblePos) {
      const para = displayParagraphsRef.current.find(p => p.id === visiblePos.id);
      if (para != null && para.position != null) {
        const paraHeight = visiblePos.enBottom - visiblePos.enTop;
        const scrolledInto = en.scrollTop - visiblePos.enTop;
        const paragraphOffset = paraHeight > 0 ? Math.max(0, Math.min(1, scrolledInto / paraHeight)) : 0;
        firstVisibleParaRef.current = { id: para.id as number, position: para.position, paragraphOffset };
      }
    } else {
      const now = performance.now();
      if (now - domFallbackLastRun.current > 500) {
        domFallbackLastRun.current = now;
        for (const p of displayParagraphsRef.current) {
          if (p.position == null) continue;
          const el = document.getElementById(`para-${p.id}`);
          if (!el) continue;
          const top = offsetInContainer(el, en);
          if (top + el.offsetHeight > en.scrollTop + 10) {
            const paraHeight = el.offsetHeight;
            const scrolledInto = en.scrollTop - top;
            const paragraphOffset = paraHeight > 0 ? Math.max(0, Math.min(1, scrolledInto / paraHeight)) : 0;
            firstVisibleParaRef.current = { id: p.id as number, position: p.position, paragraphOffset };
            break;
          }
        }
      }
    }

    // Update current chapter (throttled to once per 500ms)
    const now = performance.now();
    if (now - chapterUpdateThrottle.current > 500) {
      chapterUpdateThrottle.current = now;
      const pos = firstVisibleParaRef.current?.position;
      if (pos != null) {
        const chs = chaptersRef.current;
        let best: number | null = null;
        for (const ch of chs) {
          if (ch.position <= pos) best = ch.id;
          else break;
        }
        setCurrentChapterParaId(prev => prev === best ? prev : best);
      }
    }

    // Delta-sync RU: apply the same scroll delta as EN, scaled by per-book scroll speed
    const delta = en.scrollTop - lastEnScrollTop.current;
    lastEnScrollTop.current = en.scrollTop;
    const r = ruRef.current;
    if (!r || delta === 0) return;
    r.scrollTop = Math.max(0, Math.min(r.scrollHeight - r.clientHeight, r.scrollTop + delta * scrollSpeedRef.current));
  }, []);

  // ── RU scroll handler — RU scrolls freely, no EN sync needed ──
  const handleRuScroll = useCallback(() => {
    // nothing — RU is independent; EN drives via delta above
  }, []);


  // ── Set bookmark manually ──────────────────────────────────────────────────
  const setBookmarkNow = useCallback(() => {
    let para = firstVisibleParaRef.current;
    // Fallback: scan DOM to find the first visible paragraph if ref isn't seeded yet
    if (!para) {
      const en = enRef.current;
      if (en) {
        for (const p of displayParagraphsRef.current) {
          if (p.position == null) continue;
          const el = document.getElementById(`para-${p.id}`);
          if (!el) continue;
          const top = offsetInContainer(el, en);
          if (top + el.offsetHeight > en.scrollTop + 10) {
            const paraHeight = el.offsetHeight;
            const scrolledInto = en.scrollTop - top;
            const paragraphOffset = paraHeight > 0 ? Math.max(0, Math.min(1, scrolledInto / paraHeight)) : 0;
            para = { id: p.id as number, position: p.position, paragraphOffset };
            firstVisibleParaRef.current = para;
            break;
          }
        }
      }
    }
    if (!para) return;
    const bm: BookmarkData = {
      paragraphId: para.id,
      paragraphPosition: para.position,
      paragraphOffset: para.paragraphOffset,
      ruOffset: ruRef.current?.scrollTop ?? undefined,
    };
    saveBookmark(bookId, bm);
    saveBookmarkToServer(bookId, bm);
    if (bookmarkSavedTimer.current) clearTimeout(bookmarkSavedTimer.current);
    setBookmarkSaved(true);
    bookmarkSavedTimer.current = setTimeout(() => setBookmarkSaved(false), 2000);
  }, [bookId]);

  // Sync theme to body background
  useEffect(() => {
    document.body.style.background = colors.bg;
    document.documentElement.style.background = colors.bg;
  }, [colors.bg]);

  const handleWordClick = useCallback((word: string, p: Paragraph) => {
    setPanel({ kind: "dict", word, paragraph: p });
    setShowSettings(false);
  }, []);

  const closePanel = useCallback(() => setPanel({ kind: "hidden" }), []);

  const bodyFont = FONT_FAMILIES[settings.fontFamily].css;
  const headingFont = "Georgia, 'Times New Roman', serif";
  const lineHeight = LINE_SPACINGS[settings.lineSpacing].value;

  const translatedPct = statusData ? Math.round(statusData.progressPercent ?? 0) : null;

  // Current chapter name for the header subtitle
  const chapters = chaptersData?.chapters ?? [];

  // Keep chaptersRef in sync for use inside scroll handler
  chaptersRef.current = chapters as Array<{ id: number; position: number }>;

  if (isLoadingBook) {
    return (
      <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: colors.bg }}>
        <Loader2 size={28} style={{ color: colors.muted, animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  // Still waiting for the network response — don't flash "not found" yet.
  if (!book && isLoadingBookOnline) {
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

  const NAV_H = 50;
  const HEADER_H = NAV_H;

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: colors.bg, color: colors.text }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes headerReveal{from{transform:translateY(-${NAV_H}px)}to{transform:translateY(0)}}
      `}</style>

      {/* ── Tap zone to restore hidden header ─────────────────────────── */}
      {!showHeader && (
        <div
          onClick={() => setShowHeader(true)}
          style={{
            position: "fixed", top: 0, left: 0, right: 0, zIndex: 32,
            height: 20, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div style={{
            width: 28, height: 14,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: colors.headerBg,
            borderRadius: "0 0 8px 8px",
            border: `1px solid ${colors.border}`,
            borderTop: "none",
            boxShadow: "0 2px 6px rgba(0,0,0,0.10)",
          }}>
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
              <path d="M1 1l4 4 4-4" stroke={colors.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      )}

      {/* ── Nav header ───────────────────────────────────────────────── */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 30,
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
            {(chapters.length > 0 || (translatedPct !== null && translatedPct < 100)) && (
              <div style={{ fontSize: 11, color: colors.muted, marginTop: 1, display: "flex", alignItems: "center", gap: 6 }}>
                {translatedPct !== null && translatedPct < 100 && (
                  <span style={{ color: colors.accent }}>⟳ {translatedPct}% пер.</span>
                )}
              </div>
            )}
          </div>

          {/* Bookmark button */}
          <button
            onClick={setBookmarkNow}
            title="Поставить закладку"
            style={{
              height: 34, minWidth: bookmarkSaved ? "auto" : 34,
              padding: bookmarkSaved ? "0 10px" : "0",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              borderRadius: bookmarkSaved ? 17 : "50%",
              background: bookmarkSaved ? colors.accent + "22" : "transparent",
              border: bookmarkSaved ? `1px solid ${colors.accent}44` : "none",
              cursor: "pointer",
              color: bookmarkSaved ? colors.accent : colors.muted,
              transition: "all 0.2s",
              whiteSpace: "nowrap",
              fontSize: 12, fontWeight: 600,
            }}
          >
            <Bookmark size={17} style={{ fill: bookmarkSaved ? colors.accent : "none", flexShrink: 0 }} />
            {bookmarkSaved && <span>Закладка</span>}
          </button>

          <button onClick={() => { setShowToc(s => !s); setShowSettings(false); setShowSearch(false); setShowIllustration(false); }} style={{ height: 34, width: 34, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "transparent", border: "none", cursor: "pointer", color: colors.muted }}>
            <List size={17} />
          </button>
          <button onClick={() => { setShowSearch(s => !s); setShowToc(false); setShowSettings(false); setShowIllustration(false); }} style={{ height: 34, width: 34, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "transparent", border: "none", cursor: "pointer", color: colors.muted }}>
            <Search size={17} />
          </button>
          <button onClick={() => { setShowSettings(s => !s); setShowToc(false); setShowSearch(false); setShowIllustration(false); }} style={{ height: 34, width: 34, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "transparent", border: "none", cursor: "pointer", color: colors.muted }}>
            <Settings2 size={17} />
          </button>
          <button
            onClick={() => setShowHeader(false)}
            title="Скрыть панель"
            style={{ height: 34, width: 34, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "transparent", border: "none", cursor: "pointer", color: colors.muted }}
          >
            <EyeOff size={15} />
          </button>
        </div>
      </header>

      {/* ── Two synced scroll panels ──────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", paddingTop: showHeader ? HEADER_H : 20, transition: "padding-top 0.25s ease" }}>

        {/* EN panel */}
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
                colors={colors}
                fontSize={settings.fontSize}
                fontFamily={bodyFont}
                headingFontFamily={headingFont}
                lineHeight={lineHeight}
                textAlign={settings.textAlign}
              />
            </div>
          ))}

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
          readingPct={(firstVisibleParaRef.current?.position ?? 0) / Math.max(1, book?.totalParagraphs ?? 1)}
          totalParagraphs={book?.totalParagraphs ?? 0}
          currentChapterParaId={currentChapterParaId}
          illustrationMap={illustrationMap}
          onShowIllustration={paraId => {
            setCurrentChapterParaId(paraId);
            setShowIllustration(true);
            setShowToc(false);
          }}
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
          scrollSpeed={scrollSpeed}
          setScrollSpeed={setScrollSpeed}
          onRegenerateIllustrations={bookId ? () => {
            regenerateIllustrationsMutation.mutate(
              { id: bookId, params: { force: true } },
              { onSuccess: () => setTimeout(() => refetchIllustrations(), 5000) }
            );
          } : undefined}
          isRegenerating={regenerateIllustrationsMutation.isPending}
        />
      )}

      {/* ── Illustration panel ───────────────────────────────────────── */}
      {showIllustration && (() => {
        const ilUrls = currentChapterParaId != null
          ? (illustrationMap.get(currentChapterParaId) ?? [])
          : [];
        const clampedIdx = Math.min(illustrationIndex, Math.max(0, ilUrls.length - 1));
        const ilUrl = ilUrls[clampedIdx] ?? null;
        const currentChapter = currentChapterParaId != null
          ? chapters.find((ch: { id: number }) => ch.id === currentChapterParaId)
          : null;
        const chapterTitle = (currentChapter as { text?: string } | null)?.text ?? null;

        return (
          <div
            style={{
              position: "fixed", inset: 0, zIndex: 35,
              background: "#000",
              display: "flex", flexDirection: "column",
            }}
            onClick={() => setShowIllustration(false)}
          >
            {/* Close button — top right */}
            <button
              onClick={() => setShowIllustration(false)}
              style={{
                position: "absolute", top: "env(safe-area-inset-top, 12px)", right: 12,
                zIndex: 2,
                width: 36, height: 36,
                borderRadius: "50%",
                background: "rgba(0,0,0,0.55)",
                border: "none", cursor: "pointer",
                color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
              }}
            >
              <X size={18} />
            </button>

            {/* Image — fills the whole screen */}
            {ilUrl ? (
              <img
                src={ilUrl}
                alt={chapterTitle ?? ""}
                style={{
                  width: "100%", height: "100%",
                  objectFit: "cover",
                  objectPosition: "center",
                  display: "block",
                }}
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <div style={{
                flex: 1,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 12, color: "rgba(255,255,255,0.5)", textAlign: "center", padding: 32,
              }}>
                <ImageIcon size={40} style={{ opacity: 0.4 }} />
                <span style={{ fontSize: 14 }}>
                  {illustrationMap.size === 0
                    ? "Иллюстрации ещё генерируются…"
                    : "Для этой главы иллюстрация ещё не готова"}
                </span>
              </div>
            )}

            {/* Chapter title — gradient overlay at the bottom */}
            {chapterTitle && ilUrl && (
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                padding: "48px 20px 28px",
                background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)",
                color: "#fff",
                fontSize: 15, fontStyle: "italic",
                letterSpacing: "0.01em",
                paddingBottom: "max(28px, env(safe-area-inset-bottom, 28px))",
              }}>
                {chapterTitle}
              </div>
            )}

            {/* Carousel controls — only when there's at least one image */}
            {ilUrls.length > 0 && (
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  position: "absolute",
                  top: "50%", left: 0, right: 0,
                  transform: "translateY(-50%)",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  pointerEvents: "none",
                  padding: "0 8px",
                  zIndex: 3,
                }}
              >
                <button
                  onClick={e => { e.stopPropagation(); setIllustrationIndex(i => Math.max(0, i - 1)); }}
                  disabled={clampedIdx === 0}
                  style={{
                    pointerEvents: "all",
                    width: 40, height: 40, borderRadius: "50%",
                    background: clampedIdx === 0 ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.55)",
                    border: "none", cursor: clampedIdx === 0 ? "default" : "pointer",
                    color: "#fff", opacity: clampedIdx === 0 ? 0.3 : 1,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
                    transition: "opacity 0.15s",
                  }}
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setIllustrationIndex(i => Math.min(ilUrls.length - 1, i + 1)); }}
                  disabled={clampedIdx === ilUrls.length - 1}
                  style={{
                    pointerEvents: "all",
                    width: 40, height: 40, borderRadius: "50%",
                    background: clampedIdx === ilUrls.length - 1 ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.55)",
                    border: "none", cursor: clampedIdx === ilUrls.length - 1 ? "default" : "pointer",
                    color: "#fff", opacity: clampedIdx === ilUrls.length - 1 ? 0.3 : 1,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
                    transition: "opacity 0.15s",
                  }}
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            )}

            {/* Dot indicators + Generate more button */}
            {ilUrls.length > 0 && (
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  position: "absolute",
                  bottom: "max(80px, calc(env(safe-area-inset-bottom, 28px) + 56px))",
                  left: 0, right: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  gap: 8, zIndex: 3,
                }}
              >
                {ilUrls.map((_, dotIdx) => (
                  <button
                    key={dotIdx}
                    onClick={e => { e.stopPropagation(); setIllustrationIndex(dotIdx); }}
                    style={{
                      width: dotIdx === clampedIdx ? 20 : 7,
                      height: 7,
                      borderRadius: 4,
                      background: dotIdx === clampedIdx ? "#fff" : "rgba(255,255,255,0.4)",
                      border: "none", cursor: "pointer", padding: 0,
                      transition: "width 0.2s, background 0.2s",
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Dictionary drawer ────────────────────────────────────────── */}
      <DictDrawer panel={panel} colors={colors} onClose={closePanel} />
    </div>
  );
}
