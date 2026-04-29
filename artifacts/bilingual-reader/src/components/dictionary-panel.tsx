import { useLookupWord, getLookupWordQueryKey } from "@workspace/api-client-react";
import { Loader2, X } from "lucide-react";

interface DictionaryPanelProps {
  word: string;
  context?: string;
  onClose: () => void;
  inline?: boolean;
  textColor?: string;
  mutedColor?: string;
}

export function DictionaryPanel({ word, context, onClose, inline, textColor = "#1a1a1a", mutedColor = "#6b7280" }: DictionaryPanelProps) {
  const clean = word.toLowerCase().replace(/[^\w-]/g, "");

  const { data: entry, isLoading, isError } = useLookupWord(
    { params: { word: clean, context } },
    { query: { enabled: !!clean, queryKey: getLookupWordQueryKey({ word: clean, context }) } }
  );

  const content = () => {
    if (isLoading) return (
      <span style={{ display: "flex", alignItems: "center", gap: 6, color: mutedColor }}>
        <Loader2 size={12} style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
        <em>{word}</em>...
      </span>
    );
    if (isError) return <span style={{ color: "#ef4444" }}>Не удалось найти «{word}».</span>;
    if (!entry) return <span style={{ color: mutedColor }}>Нет перевода для «{word}».</span>;
    return (
      <span>
        <span style={{ fontWeight: 600, color: textColor }}>{word}</span>
        {entry.partOfSpeech && <span style={{ color: mutedColor, fontStyle: "italic", fontSize: 12, marginLeft: 6 }}>{entry.partOfSpeech}</span>}
        <span style={{ color: textColor }}> — {entry.translations.join(", ")}</span>
        {entry.examples?.[0] && (
          <span style={{ color: mutedColor }}> · <em>{entry.examples[0]}</em></span>
        )}
      </span>
    );
  };

  if (inline) {
    return (
      <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
        <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#10b981", flexShrink: 0, marginTop: "0.35em" }} />
        <p style={{ margin: 0, fontSize: 14, lineHeight: "22px", flex: 1 }}>{content()}</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
      <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#10b981", flexShrink: 0, marginTop: "0.35em" }} />
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
