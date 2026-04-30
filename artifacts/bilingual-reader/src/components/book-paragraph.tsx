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
  fontSize: number;
  fontFamily: string;
  headingFontFamily: string;
  lineHeight: string;
  padH: string;  // horizontal margin per page
}

export function BookParagraph({
  paragraph,
  selectedToken,
  onClick,
  onWordClick,
  onWordDoubleClick,
  colors,
  fontSize,
  fontFamily,
  headingFontFamily,
  lineHeight,
  padH,
}: BookParagraphProps) {
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingWord = useRef<{ word: string; sentenceIdx: number; charStart: number } | null>(null);

  const text = paragraph.originalText;
  const isHeading = isHeadingParagraph(text);

  // Tokenize: words + punctuation + whitespace, tracking character positions
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
      <div style={{ paddingTop: 32, paddingBottom: 10, paddingLeft: padH, paddingRight: padH, breakInside: "avoid" }}>
        <h2 style={{
          fontSize: Math.round(fontSize * 1.28),
          fontFamily: headingFontFamily,
          fontWeight: 700,
          color: colors.heading,
          margin: 0,
          lineHeight: 1.3,
        }}>
          {text}
        </h2>
        <div style={{ marginTop: 10, height: 1, background: colors.border }} />
      </div>
    );
  }

  // ── Normal paragraph ─────────────────────────────────────────────────────
  return (
    <div onClick={handleParagraphClick} style={{ padding: `3px ${padH}`, cursor: "pointer", breakInside: "avoid" }}>
      <p style={{
        fontSize,
        lineHeight,
        fontFamily,
        color: colors.text,
        margin: 0,
        textAlign: "justify",
        hyphens: "auto",
        wordBreak: "break-word",
        letterSpacing: "0.005em",
      }}>
        {tokens.map(({ token, isWord, sentenceIdx, charStart }, i) => {
          if (!isWord) return <span key={i}>{token}</span>;

          const clean = token.replace(/^[^\w]+|[^\w]+$/g, "");

          // Only highlight the EXACT clicked token (by paragraph id + char position)
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
