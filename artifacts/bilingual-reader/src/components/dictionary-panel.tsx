import { useLookupWord, getLookupWordQueryKey } from "@workspace/api-client-react";
import { Loader2, X } from "lucide-react";

interface DictionaryPanelProps {
  word: string;
  context?: string;
  onClose: () => void;
}

export function DictionaryPanel({ word, context, onClose }: DictionaryPanelProps) {
  const clean = word.toLowerCase().replace(/[^\w-]/g, "");

  const { data: entry, isLoading, isError } = useLookupWord(
    { params: { word: clean, context } },
    { query: { enabled: !!clean, queryKey: getLookupWordQueryKey({ word: clean, context }) } }
  );

  return (
    <div className="flex items-start gap-3">
      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0 mt-1" />
      <div className="flex-1 min-w-0">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Looking up <em>{word}</em>...
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">Could not look up «{word}».</p>
        ) : entry ? (
          <>
            <div className="flex items-baseline gap-2 flex-wrap mb-0.5">
              <span className="font-semibold text-foreground">{word}</span>
              {entry.partOfSpeech && (
                <span className="text-xs text-muted-foreground italic">{entry.partOfSpeech}</span>
              )}
            </div>
            <p className="text-sm text-foreground/90 leading-relaxed">
              — {entry.translations.join(", ")}
            </p>
            {entry.examples && entry.examples.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1 italic border-l-2 border-primary/20 pl-2 leading-relaxed">
                {entry.examples[0]}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No translation found for «{word}».</p>
        )}
      </div>
      <button
        onClick={onClose}
        className="h-5 w-5 shrink-0 rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
