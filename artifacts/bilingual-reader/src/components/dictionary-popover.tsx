import { useLookupWord, getLookupWordQueryKey } from "@workspace/api-client-react";
import { Loader2, BookOpen, RefreshCw } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQueryClient } from "@tanstack/react-query";

interface DictionaryPopoverProps {
  word: string;
  context?: string;
  children?: React.ReactNode;
}

export function DictionaryPopover({ word, context, children }: DictionaryPopoverProps) {
  const cleanWord = word.toLowerCase().replace(/[^\w\s-]/g, "").trim();
  const { data: entry, isLoading, isError } = useLookupWord(
    { word: cleanWord, context },
    { query: { enabled: !!cleanWord, queryKey: getLookupWordQueryKey({ word: cleanWord, context }) } }
  );

  return <>{children}</>;
}

// Standalone dictionary card used directly in reader panels (no Popover wrapper needed)
export function DictionaryCard({
  word,
  context,
  bg = "#ffffff",
  textColor = "#1a1a1a",
  mutedColor = "#6b7280",
  borderColor = "rgba(0,0,0,0.09)",
  accentColor = "#059669",
}: {
  word: string;
  context?: string;
  bg?: string;
  textColor?: string;
  mutedColor?: string;
  borderColor?: string;
  accentColor?: string;
}) {
  const cleanWord = word.toLowerCase().replace(/[^\w\s-]/g, "").trim();
  const queryClient = useQueryClient();
  const queryKey = getLookupWordQueryKey({ word: cleanWord, context });

  const { data: entry, isLoading, isError } = useLookupWord(
    { word: cleanWord, context },
    {
      query: {
        enabled: !!cleanWord,
        queryKey,
        // Never keep failed/fallback lookups in cache — always refetch fresh
        staleTime: 0,
        gcTime: 0,
      }
    }
  );

  // Treat "перевод недоступен" as a retriable failure (server returned it when AI was unavailable)
  const isFallback = entry?.translations?.length === 1 && entry.translations[0] === "перевод недоступен";

  const retry = () => {
    queryClient.removeQueries({ queryKey });
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", color: mutedColor, fontSize: 13 }}>
        <Loader2 size={14} style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
        <span>Ищем «{word}»…</span>
      </div>
    );
  }

  if (isError || !entry || isFallback) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", color: mutedColor, fontSize: 13 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <BookOpen size={14} style={{ flexShrink: 0 }} />
          <span>{isFallback ? "ИИ сейчас недоступен" : `Не найдено для «${word}»`}</span>
        </div>
        {isFallback && (
          <button
            onClick={retry}
            style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: accentColor, fontSize: 12, padding: "2px 4px" }}
          >
            <RefreshCw size={12} />
            Повторить
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ fontSize: 14, lineHeight: 1.55 }}>
      {/* Header: word + transcription + part of speech */}
      <div style={{ padding: "10px 14px 8px", borderBottom: `1px solid ${borderColor}`, display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 700, fontSize: 16, color: textColor, fontFamily: "Georgia, serif" }}>
          {entry.word}
        </span>
        {entry.transcription && (
          <span style={{ fontSize: 13, color: accentColor, fontFamily: "monospace" }}>
            {entry.transcription}
          </span>
        )}
        {entry.partOfSpeech && (
          <span style={{ fontSize: 11, color: mutedColor, fontStyle: "italic", marginLeft: "auto" }}>
            {entry.partOfSpeech}
          </span>
        )}
      </div>

      <div style={{ padding: "8px 14px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Translations */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: mutedColor, textTransform: "uppercase", marginBottom: 4 }}>
            Перевод
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {entry.translations.map((t, i) => (
              <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 10, color: mutedColor, minWidth: 12, textAlign: "right" }}>{i + 1}.</span>
                <span style={{ fontWeight: i === 0 ? 600 : 400, color: textColor }}>{t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Examples with translations */}
        {entry.examples && entry.examples.length > 0 && (
          <div>
            <div style={{ height: 1, background: borderColor, marginBottom: 8 }} />
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: mutedColor, textTransform: "uppercase", marginBottom: 6 }}>
              Примеры
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {entry.examples.map((ex, i) => (
                <div key={i} style={{ paddingLeft: 8, borderLeft: `2px solid ${accentColor}40` }}>
                  <div style={{ fontStyle: "italic", color: textColor, opacity: 0.85 }}>"{ex}"</div>
                  {entry.exampleTranslations?.[i] && (
                    <div style={{ color: mutedColor, marginTop: 2, fontSize: 12 }}>
                      {entry.exampleTranslations[i]}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
