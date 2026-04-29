import { useCallback, useRef } from "react";
import type { Paragraph } from "@workspace/api-client-react/src/generated/api.schemas";
import { sentenceIdxForCharPos, isHeadingParagraph } from "@/lib/sentences";
import type { ThemeColors } from "@/hooks/use-reader-settings";

export interface SelectedToken {
  paragraphId: number;
  charStart: number;
  word: string;
}

interface BookParagraphProps {
  paragraph: Paragraph;
  selectedToken: SelectedToken | null;
  onClick: (p: Paragraph) => void;
  onWordClick: (word: string, sentenceIdx: number, charStart: number, p: Paragraph) => void;
  onWordDoubleClick: (word: string, p: Paragraph) => void;
  colors: ThemeColors;
  bodyFontSize: string;
  headingFontSize: string;
  lineHeight: string;
}

export function BookParagraph({
  paragraph,
  selectedToken,
  onClick,
  onWordClick,
  onWordDoubleClick,
  colors,
  bodyFontSize,
  headingFontSize,
  lineHeight,
}: BookParagraphProps) {
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingWord = useRef<{ word: string; sentenceIdx: number; charStart: number } | null>(null);

  const text = paragraph.originalText;
  const isHeading = isHeadingParagraph(text);

  // Tokenize + track char positions
  const rawTokens = text.match(/[\w''-]+|[^\w\s]+|\s+/g) || [];
  let charPos = 0;
  const tokens = rawTokens.map(token => {
    const start = charPos;
    charPos += token.length;
    const isWord = /[\w''-]+/.test(token) && token.trim().length > 0;
    const sentenceIdx = isWord ? sentenceIdxForCharPos(text, start) : 0;
    return { token, isWord, sentenceIdx, charStart: start };
  });

  const handleWordInteraction = useCallback(
    (word: string, sentenceIdx: number, charStart: number) => {
      if (clickTimer.current) {
        clearTimeout(clickTimer.current);
        clickTimer.current = null;
        pendingWord.current = null;
        onWordDoubleClick(word, paragraph);
        return;
      }
      pendingWord.current = { word, sentenceIdx, charStart };
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null;
        if (pendingWord.current) {
          onWordClick(pendingWord.current.word, pendingWord.current.sentenceIdx, pendingWord.current.charStart, paragraph);
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

  // ── Chapter heading ──────────────────────────────────────────────────────
  if (isHeading) {
    return (
      <div style={{ paddingTop: 36, paddingBottom: 12 }}>
        <h2 style={{
          fontSize: headingFontSize,
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontWeight: 700,
          color: colors.heading,
          margin: 0,
          lineHeight: 1.3,
        }}>
          {text}
        </h2>
        <div style={{ marginTop: 8, height: 1, background: colors.border }} />
      </div>
    );
  }

  // ── Normal paragraph ─────────────────────────────────────────────────────
  return (
    <div onClick={handleParagraphClick} style={{ padding: "3px 0", cursor: "pointer" }}>
      <p style={{
        fontSize: bodyFontSize,
        lineHeight,
        fontFamily: "Georgia, 'Times New Roman', serif",
        color: colors.text,
        margin: 0,
        letterSpacing: "0.01em",
      }}>
        {tokens.map(({ token, isWord, sentenceIdx, charStart }, i) => {
          if (!isWord) return <span key={i}>{token}</span>;

          const clean = token.replace(/^[^\w]+|[^\w]+$/g, "");
          // Highlight ONLY the exact token that was clicked (by charStart position in this paragraph)
          const isHighlighted =
            selectedToken !== null &&
            selectedToken.paragraphId === paragraph.id &&
            selectedToken.charStart === charStart;

          return (
            <span
              key={i}
              data-word="1"
              onClick={e => { e.stopPropagation(); handleWordInteraction(clean, sentenceIdx, charStart); }}
              style={{
                borderRadius: 3,
                cursor: "pointer",
                background: isHighlighted ? "#fef08a" : "transparent",
                color: isHighlighted ? "#713f12" : "inherit",
                padding: isHighlighted ? "0 2px" : "0",
                transition: "background 0.1s",
              }}
              onMouseEnter={e => {
                if (!isHighlighted) (e.currentTarget as HTMLSpanElement).style.background = colors.hover;
              }}
              onMouseLeave={e => {
                if (!isHighlighted) (e.currentTarget as HTMLSpanElement).style.background = "transparent";
              }}
            >
              {token}
            </span>
          );
        })}
      </p>
    </div>
  );
}
