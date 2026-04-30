import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { BookOpen, CheckCircle2, WifiOff } from "lucide-react";
import { useGetTranslationStatus, useGetBook } from "@workspace/api-client-react";

// SVG arc progress ring
function ProgressRing({ pct, size = 180, stroke = 10 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const center = size / 2;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={center} cy={center} r={r} fill="none" stroke="#e8e3da" strokeWidth={stroke} />
      <circle
        cx={center} cy={center} r={r} fill="none"
        stroke="#059669" strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
    </svg>
  );
}

type Phase = "translating" | "caching" | "ready" | "error";

export default function ProcessingPage() {
  const { id } = useParams<{ id: string }>();
  const bookId = parseInt(id || "0", 10);
  const [, navigate] = useLocation();

  const [phase, setPhase] = useState<Phase>("translating");
  const [cachedPages, setCachedPages] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const cachingDoneRef = useRef(false);

  const { data: book } = useGetBook(bookId, {
    query: { enabled: !!bookId },
  });

  const { data: status, isError } = useGetTranslationStatus(bookId, {
    query: {
      enabled: !!bookId && phase === "translating",
      refetchInterval: 2000,
    },
  });

  // Pre-cache all paragraph pages so book works offline
  const preCacheAll = useCallback(async (total: number) => {
    if (cachingDoneRef.current) return;
    cachingDoneRef.current = true;
    setPhase("caching");

    const pageSize = 40;
    const pages = Math.ceil(total / pageSize);
    setTotalPages(pages);

    for (let page = 1; page <= pages; page++) {
      try {
        await fetch(`/api/books/${bookId}/paragraphs?page=${page}&pageSize=${pageSize}`);
      } catch {
        // offline or server error — still continue
      }
      setCachedPages(page);
    }

    // Cache book metadata too
    try { await fetch(`/api/books/${bookId}`); } catch { /* ignore */ }

    setPhase("ready");
  }, [bookId]);

  // When translation completes, kick off caching
  useEffect(() => {
    if (status?.status === "completed" && !cachingDoneRef.current) {
      preCacheAll(status.totalParagraphs);
    }
  }, [status?.status, status?.totalParagraphs, preCacheAll]);

  // If there's no pending translation on mount (already done), go straight to caching
  useEffect(() => {
    if (status?.status === "completed" && !cachingDoneRef.current) {
      preCacheAll(status.totalParagraphs);
    }
  }, [status, preCacheAll]);

  const translationPct = status?.progressPercent ?? 0;
  const cachePct = totalPages > 0 ? Math.round((cachedPages / totalPages) * 100) : 0;

  const ringPct = phase === "translating" ? translationPct
    : phase === "caching" ? cachePct
    : 100;

  const phaseLabel =
    phase === "translating" ? "Переводим книгу…"
    : phase === "caching" ? "Сохраняем для офлайн…"
    : phase === "ready" ? "Готово!"
    : "Ошибка";

  const subLabel =
    phase === "translating"
      ? status
        ? `${status.translatedParagraphs} из ${status.totalParagraphs} параграфов`
        : "Запуск перевода…"
      : phase === "caching"
      ? `Страница ${cachedPages} из ${totalPages}`
      : phase === "ready"
      ? "Книга сохранена и доступна офлайн"
      : "Попробуйте обновить страницу";

  return (
    <div style={{
      minHeight: "100dvh",
      background: "#FAF8F3",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "32px 20px",
      fontFamily: "'Georgia', serif",
    }}>

      {/* Book icon / check */}
      <div style={{ marginBottom: 8, color: phase === "ready" ? "#059669" : "#6b7280" }}>
        {phase === "ready"
          ? <CheckCircle2 size={28} strokeWidth={1.8} />
          : isError
          ? <WifiOff size={28} strokeWidth={1.8} />
          : <BookOpen size={28} strokeWidth={1.8} />
        }
      </div>

      {/* Book title */}
      {book && (
        <p style={{
          fontSize: 13, fontFamily: "system-ui, sans-serif", fontWeight: 600,
          color: "#6b7280", letterSpacing: "0.02em", textAlign: "center",
          marginBottom: 28, maxWidth: 280,
        }}>
          {book.title}
        </p>
      )}

      {/* Progress ring + percentage */}
      <div style={{ position: "relative", width: 180, height: 180, marginBottom: 24 }}>
        <ProgressRing pct={ringPct} />
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 36, fontWeight: 700, color: "#1a1a1a", lineHeight: 1 }}>
            {ringPct}%
          </span>
        </div>
      </div>

      {/* Phase label */}
      <p style={{
        fontSize: 18, fontWeight: 600, color: "#1a1a1a",
        marginBottom: 6, textAlign: "center",
        fontFamily: "system-ui, sans-serif",
      }}>
        {phaseLabel}
      </p>

      {/* Sub-label */}
      <p style={{
        fontSize: 14, color: "#6b7280", marginBottom: 32,
        textAlign: "center", fontFamily: "system-ui, sans-serif",
      }}>
        {subLabel}
      </p>

      {/* Phase steps */}
      <div style={{
        display: "flex", gap: 8, alignItems: "center",
        marginBottom: 40, fontFamily: "system-ui, sans-serif",
      }}>
        {[
          { key: "translating", label: "Перевод" },
          { key: "caching", label: "Офлайн" },
          { key: "ready", label: "Готово" },
        ].map(({ key, label }, i) => {
          const order = ["translating", "caching", "ready"];
          const isDone = order.indexOf(phase) > i;
          const isCurrent = phase === key;
          return (
            <div key={key} style={{ display: "contents" }}>
              {i > 0 && (
                <div style={{ width: 24, height: 1, background: isDone ? "#059669" : "#e8e3da" }} />
              )}
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              }}>
                <div style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: isDone || isCurrent ? "#059669" : "#e8e3da",
                  transition: "background 0.3s",
                }} />
                <span style={{
                  fontSize: 11, color: isCurrent ? "#059669" : isDone ? "#059669" : "#9ca3af",
                  fontWeight: isCurrent ? 600 : 400,
                  transition: "color 0.3s",
                }}>
                  {label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA button when ready */}
      {phase === "ready" && (
        <button
          onClick={() => navigate(`/reader/${bookId}`)}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "#059669", color: "#fff",
            border: "none", borderRadius: 14,
            padding: "14px 32px",
            fontSize: 16, fontWeight: 600,
            fontFamily: "system-ui, sans-serif",
            cursor: "pointer",
            boxShadow: "0 4px 16px rgba(5,150,105,0.25)",
            animation: "fadeIn 0.4s ease",
          }}
        >
          <BookOpen size={18} />
          Начать читать
        </button>
      )}

      {/* During translation: info note */}
      {phase === "translating" && (
        <p style={{
          fontSize: 12, color: "#9ca3af", textAlign: "center",
          maxWidth: 280, fontFamily: "system-ui, sans-serif",
        }}>
          Перевод займёт несколько минут.<br />
          Не закрывайте страницу — потом книга будет доступна офлайн.
        </p>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
