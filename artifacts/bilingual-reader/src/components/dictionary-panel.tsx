import { useLookupWord, getLookupWordQueryKey } from "@workspace/api-client-react";
import { Loader2, X } from "lucide-react";

interface DictionaryPanelProps {
  word: string;
  context?: string;
  onClose: () => void;
  inline?: boolean;
  textColor?: string;
  mutedColor?: string;
  accentColor?: string;
}

export function DictionaryPanel({ word, context, onClose, inline, textColor = "#1a1a1a", mutedColor = "#6b7280", accentColor = "#059669" }: DictionaryPanelProps) {
  const clean = word.toLowerCase().replace(/[^\w\s-]/g, "").trim();

  const { data: entry, isLoading, isError } = useLookupWord(
    { word: clean, context },
    { query: { enabled: !!clean, queryKey: getLookupWordQueryKey({ word: clean, context }) } }
  );

  const content = () => {
    if (isLoading) return (
      <span style={{ display: "flex", alignItems: "center", gap: 6, color: mutedColor }}>
        <Loader2 size={12} style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
        <em>{word}</em>…
      </span>
    );
    if (isError) return <span style={{ color: "#ef4444" }}>Не удалось найти «{word}».</span>;
    if (!entry) return <span style={{ color: mutedColor }}>Нет перевода для «{word}».</span>;

    return (
      <span style={{ display: "inline" }}>
        {/* Word (may be full phrasal verb) + part of speech */}
        <span style={{ fontWeight: 700, color: textColor }}>{entry.word}</span>
        {entry.transcription && (
          <span style={{ color: mutedColor, fontSize: 12, marginLeft: 5 }}>{entry.transcription}</span>
        )}
        {entry.partOfSpeech && (
          <span style={{ color: accentColor, fontStyle: "italic", fontSize: 12, marginLeft: 6 }}>{entry.partOfSpeech}</span>
        )}
        {/* Translations */}
        <span style={{ color: textColor }}> — {entry.translations.join(", ")}</span>
        {/* First example + its translation */}
        {entry.examples?.[0] && (
          <span>
            <span style={{ color: mutedColor }}> · <em>"{entry.examples[0]}"</em></span>
            {entry.exampleTranslations?.[0] && (
              <span style={{ color: mutedColor }}> — {entry.exampleTranslations[0]}</span>
            )}
          </span>
        )}
      </span>
    );
  };

  if (inline) {
    return (
      <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
        <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: accentColor, flexShrink: 0, marginTop: "0.35em" }} />
        <p style={{ margin: 0, fontSize: 14, lineHeight: "22px", flex: 1 }}>{content()}</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
      <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: accentColor, flexShrink: 0, marginTop: "0.35em" }} />
      <p style={{ margin: 0, fontSize: 14, lineHeight: "22px", flex: 1 }}>{content()}</p>
      <button
        onClick={onClose}
        style={{ height: 22, width: 22, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "transparent", border: "none", cursor: "pointer", color: mutedColor, flexShrink: 0 }}
      >
        <X size={12} />
      </button>
    </div>
  );
}
