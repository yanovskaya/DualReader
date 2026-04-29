import { useLookupWord, getLookupWordQueryKey } from "@workspace/api-client-react";
import { Loader2, X } from "lucide-react";

interface DictionaryPanelProps {
  word: string;
  context?: string;
  onClose: () => void;
  /** When true, renders inline without its own close button (parent panel handles it) */
  inline?: boolean;
}

export function DictionaryPanel({ word, context, onClose, inline }: DictionaryPanelProps) {
  const clean = word.toLowerCase().replace(/[^\w-]/g, "");

  const { data: entry, isLoading, isError } = useLookupWord(
    { params: { word: clean, context } },
    { query: { enabled: !!clean, queryKey: getLookupWordQueryKey({ word: clean, context }) } }
  );

  const content = () => {
    if (isLoading) return (
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin shrink-0" />
        <em>{word}</em>...
      </span>
    );
    if (isError) return <span className="text-destructive">Не удалось найти «{word}».</span>;
    if (!entry) return <span className="text-muted-foreground">Нет перевода для «{word}».</span>;
    return (
      <span>
        <span className="font-semibold">{word}</span>
        {entry.partOfSpeech && <span className="text-muted-foreground italic ml-1.5 text-xs">{entry.partOfSpeech}</span>}
        {" — "}
        <span>{entry.translations.join(", ")}</span>
        {entry.examples && entry.examples[0] && (
          <span className="text-muted-foreground"> · <em>{entry.examples[0]}</em></span>
        )}
      </span>
    );
  };

  if (inline) {
    return (
      <div className="flex items-start gap-1.5">
        <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0 mt-[0.35em]" />
        <p className="text-sm text-foreground/90 leading-[1.55em] flex-1">{content()}</p>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0 mt-[0.35em]" />
      <p className="text-sm text-foreground/90 leading-[1.55em] flex-1">{content()}</p>
      <button
        onClick={onClose}
        className="h-5 w-5 shrink-0 rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
