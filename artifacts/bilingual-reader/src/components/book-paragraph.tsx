import { useCallback, useRef } from "react";
import type { Paragraph } from "@workspace/api-client-react/src/generated/api.schemas";
import { cn } from "@/lib/utils";
import { splitSentences, sentenceIdxForCharPos, isHeadingParagraph } from "@/lib/sentences";

interface BookParagraphProps {
  paragraph: Paragraph;
  isSelected: boolean;
  selectedWord: string | null;
  onClick: (p: Paragraph) => void;
  onWordClick: (word: string, sentenceIdx: number, p: Paragraph) => void;
  onWordDoubleClick: (word: string, p: Paragraph) => void;
}

export function BookParagraph({
  paragraph,
  isSelected,
  selectedWord,
  onClick,
  onWordClick,
  onWordDoubleClick,
}: BookParagraphProps) {
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingWord = useRef<{ word: string; sentenceIdx: number } | null>(null);

  const text = paragraph.originalText;
  const isHeading = isHeadingParagraph(text);

  // Tokenize: [{token, isWord, charStart, sentenceIdx}]
  const rawTokens = text.match(/[\w''-]+|[^\w\s]+|\s+/g) || [];
  let charPos = 0;
  const tokens = rawTokens.map((token) => {
    const start = charPos;
    charPos += token.length;
    const isWord = /[\w''-]+/.test(token) && token.trim().length > 0;
    const sentenceIdx = isWord ? sentenceIdxForCharPos(text, start) : 0;
    return { token, isWord, sentenceIdx };
  });

  const handleWordInteraction = useCallback(
    (word: string, sentenceIdx: number) => {
      if (clickTimer.current) {
        // Second click within 280ms → double click → dictionary
        clearTimeout(clickTimer.current);
        clickTimer.current = null;
        pendingWord.current = null;
        onWordDoubleClick(word, paragraph);
        return;
      }

      pendingWord.current = { word, sentenceIdx };
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null;
        if (pendingWord.current) {
          onWordClick(pendingWord.current.word, pendingWord.current.sentenceIdx, paragraph);
          pendingWord.current = null;
        }
      }, 280);
    },
    [paragraph, onWordClick, onWordDoubleClick]
  );

  const handleParagraphClick = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).dataset.word) return;
      onClick(paragraph);
    },
    [paragraph, onClick]
  );

  // ── Heading ──────────────────────────────────────────────────────────────
  if (isHeading) {
    return (
      <div className="pt-8 pb-3 px-1">
        <h2 className="text-xl font-serif font-bold text-foreground/90 tracking-tight leading-snug">
          {text}
        </h2>
        <div className="mt-2 h-px bg-border/40" />
      </div>
    );
  }

  // ── Normal paragraph ─────────────────────────────────────────────────────
  return (
    <div
      className={cn(
        "px-1 py-2 rounded-lg cursor-pointer transition-colors select-none",
        isSelected ? "bg-amber-50" : "hover:bg-muted/40"
      )}
      onClick={handleParagraphClick}
    >
      <p className="text-[1.05rem] leading-[1.85] font-serif text-foreground tracking-[0.01em]">
        {tokens.map(({ token, isWord, sentenceIdx }, i) => {
          if (!isWord) return <span key={i}>{token}</span>;
          const clean = token.replace(/^[^\w]+|[^\w]+$/g, "");
          const isHighlighted =
            selectedWord && clean.toLowerCase() === selectedWord.toLowerCase();

          return (
            <span
              key={i}
              data-word="1"
              onClick={(e) => {
                e.stopPropagation();
                handleWordInteraction(clean, sentenceIdx);
              }}
              className={cn(
                "rounded-[3px] transition-colors",
                isHighlighted
                  ? "bg-yellow-200 text-yellow-900 px-0.5 cursor-pointer"
                  : "hover:bg-primary/10 hover:text-primary cursor-pointer"
              )}
            >
              {token}
            </span>
          );
        })}
      </p>
    </div>
  );
}
