import { useState, useRef, useEffect, useCallback } from "react";
import type { ThemeColors } from "@/hooks/use-reader-settings";
import type { SearchResult } from "@workspace/api-client-react/src/generated/api.schemas";
import { useSearchBook, getSearchBookQueryKey } from "@workspace/api-client-react";
import { Loader2, Search, X } from "lucide-react";

interface SearchPanelProps {
  bookId: number;
  colors: ThemeColors;
  fontSize: number;
  onNavigate: (paragraphId: number, position: number) => void;
  onClose: () => void;
}

/** Extract a window of text around the first occurrence of query (≈120 chars each side). */
function extractSnippet(text: string, query: string, radius = 120): string {
  if (!query.trim()) return text.slice(0, radius * 2);
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, radius * 2);
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + query.length + radius);
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}

function highlight(text: string, query: string): (string | JSX.Element)[] {
  if (!query.trim()) return [text];
  const escapedQ = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(${escapedQ})`, "gi");
  const parts = text.split(re);
  // When splitting with a capturing group, odd-indexed parts are the matches.
  // Do NOT use re.test() here — with the g flag, lastIndex advances between
  // calls and every second match incorrectly returns false.
  return parts.map((p, i) =>
    i % 2 === 1
      ? <mark key={i} style={{ background: "#fde68a", color: "#92400e", borderRadius: 2, padding: "0 1px" }}>{p}</mark>
      : p
  );
}

function Snippet({ text, query, style }: { text: string; query: string; style?: React.CSSProperties }) {
  return (
    <span style={style}>
      {highlight(extractSnippet(text, query), query)}
    </span>
  );
}

export function SearchPanel({ bookId, colors, fontSize, onNavigate, onClose }: SearchPanelProps) {
  const [inputValue, setInputValue] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input on mount
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedQ(val.trim()), 350);
  }, []);

  const { data, isFetching } = useSearchBook(
    bookId,
    { q: debouncedQ },
    {
      query: {
        enabled: debouncedQ.length >= 2,
        queryKey: getSearchBookQueryKey(bookId, { q: debouncedQ }),
      },
    }
  );

  const results: SearchResult[] = data?.results ?? [];
  const hasQuery = debouncedQ.length >= 2;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.45)" }}
      />

      {/* Panel — slides up from bottom */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
        background: colors.bg,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        maxHeight: "80dvh",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 -4px 32px rgba(0,0,0,0.18)",
      }}>
        {/* Handle */}
        <div style={{ padding: "10px 20px 0", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: colors.border, margin: "0 auto 14px" }} />
        </div>

        {/* Header row */}
        <div style={{ padding: "0 16px 12px", flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <Search size={16} color={colors.muted} />
          <input
            ref={inputRef}
            value={inputValue}
            onChange={handleInput}
            placeholder="Поиск по тексту книги…"
            style={{
              flex: 1, border: "none", outline: "none", background: "transparent",
              fontSize: 16, color: colors.text, fontFamily: "inherit",
            }}
          />
          {inputValue && (
            <button
              onClick={() => { setInputValue(""); setDebouncedQ(""); inputRef.current?.focus(); }}
              style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.muted, padding: 2, display: "flex" }}
            >
              <X size={16} />
            </button>
          )}
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.muted, fontSize: 20, padding: "0 2px", lineHeight: 1 }}
          >✕</button>
        </div>

        {/* Divider */}
        <div style={{ width: "100%", height: 1, background: colors.border, flexShrink: 0 }} />

        {/* Results */}
        <div style={{ overflowY: "auto", flex: 1, paddingBottom: 32 }}>
          {/* Idle state */}
          {!hasQuery && (
            <p style={{ textAlign: "center", color: colors.muted, fontSize: 14, padding: "32px 20px" }}>
              Введите не менее 2 символов
            </p>
          )}

          {/* Loading */}
          {hasQuery && isFetching && (
            <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
              <Loader2 size={20} color={colors.muted} style={{ animation: "spin 1s linear infinite" }} />
            </div>
          )}

          {/* No results */}
          {hasQuery && !isFetching && results.length === 0 && (
            <p style={{ textAlign: "center", color: colors.muted, fontSize: 14, padding: "32px 20px" }}>
              Ничего не найдено
            </p>
          )}

          {/* Results count */}
          {hasQuery && !isFetching && results.length > 0 && (
            <div style={{ padding: "8px 16px 4px", fontSize: 11, color: colors.muted, letterSpacing: "0.05em" }}>
              {results.length} совпадений{results.length === 80 ? " (показаны первые 80)" : ""}
            </div>
          )}

          {/* Result list */}
          {results.map(r => (
            <button
              key={r.id}
              onClick={() => { onNavigate(r.id, r.position); onClose(); }}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "10px 16px",
                border: "none", borderBottom: `1px solid ${colors.border}`,
                background: "transparent", cursor: "pointer",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = colors.hover; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              {/* Chapter number badge */}
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 10, color: colors.accent, fontWeight: 600, letterSpacing: "0.05em", flexShrink: 0 }}>
                  §{r.position + 1}
                </span>
                {r.isHeading && (
                  <span style={{ fontSize: 10, color: colors.muted, flexShrink: 0 }}>Заголовок</span>
                )}
              </div>

              {/* EN text */}
              <p style={{
                margin: 0, fontSize: fontSize - 1, color: colors.text,
                lineHeight: 1.4, wordBreak: "break-word",
                display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
              }}>
                <Snippet text={r.originalText} query={debouncedQ} />
              </p>

              {/* RU text (if available and different) */}
              {r.translatedText && (
                <p style={{
                  margin: "4px 0 0", fontSize: fontSize - 2, color: colors.muted,
                  lineHeight: 1.35, fontStyle: "italic", wordBreak: "break-word",
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                }}>
                  <Snippet text={r.translatedText} query={debouncedQ} />
                </p>
              )}
            </button>
          ))}
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  );
}
