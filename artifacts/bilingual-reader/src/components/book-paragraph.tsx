import { useCallback, useRef } from "react";
import type { Paragraph } from "@workspace/api-client-react/src/generated/api.schemas";
import { cn } from "@/lib/utils";

interface BookParagraphProps {
  paragraph: Paragraph;
  isSelected: boolean;
  selectedWord: string | null;
  onClick: (p: Paragraph) => void;
  onWordDoubleClick: (word: string, p: Paragraph) => void;
}

export function BookParagraph({
  paragraph,
  isSelected,
  selectedWord,
  onClick,
  onWordDoubleClick,
}: BookParagraphProps) {
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickCount = useRef(0);

  const tokens = paragraph.originalText.match(/[\w''-]+|[^\w\s]+|\s+/g) || [];

  const handleWordInteraction = useCallback(
    (word: string) => {
      clickCount.current += 1;

      if (clickCount.current === 1) {
        clickTimer.current = setTimeout(() => {
          clickCount.current = 0;
          // Single click → show paragraph translation
          onClick(paragraph);
        }, 280);
      } else {
        // Double click → show dictionary
        if (clickTimer.current) clearTimeout(clickTimer.current);
        clickCount.current = 0;
        const clean = word.replace(/[^\w''-]/g, "");
        if (clean.length > 1) onWordDoubleClick(clean, paragraph);
      }
    },
    [paragraph, onClick, onWordDoubleClick]
  );

  const handleParagraphClick = useCallback(
    (e: React.MouseEvent) => {
      // Only trigger if click was NOT on a word span (those handle their own interaction)
      if ((e.target as HTMLElement).dataset.word) return;
      onClick(paragraph);
    },
    [paragraph, onClick]
  );

  return (
    <div
      className={cn(
        "relative px-1 py-2 rounded-lg cursor-pointer transition-colors select-none",
        isSelected
          ? "bg-primary/10"
          : "hover:bg-muted/50"
      )}
      onClick={handleParagraphClick}
    >
      <p className="text-[1.05rem] leading-[1.85] font-serif text-foreground tracking-[0.01em]">
        {tokens.map((token, i) => {
          const isWord = /[\w''-]+/.test(token) && token.trim().length > 0;
          if (!isWord) return <span key={i}>{token}</span>;

          const clean = token.replace(/[^\w''-]/g, "");
          const isHighlighted =
            selectedWord && clean.toLowerCase() === selectedWord.toLowerCase();

          return (
            <span
              key={i}
              data-word="1"
              onClick={(e) => {
                e.stopPropagation();
                handleWordInteraction(clean);
              }}
              className={cn(
                "rounded-[3px] transition-colors",
                isHighlighted
                  ? "bg-yellow-200 text-yellow-900 px-0.5"
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
