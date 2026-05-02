import { useRef, useCallback } from "react";
import type { Paragraph } from "@workspace/api-client-react/src/generated/api.schemas";
import { isHeadingParagraph, splitSentences } from "@/lib/sentences";
import type { TextAlign, ThemeColors } from "@/hooks/use-reader-settings";

export interface BookParagraphProps {
  paragraph: Paragraph;
  /** "en" = only English text (clickable words), "ru" = only Russian translation */
  mode: "en" | "ru";
  /** charFraction = tapped word's start offset / paragraph length (0–1).
   *  The reader uses this to find the proportionally-equivalent RU sentence,
   *  which is robust when EN and RU sentence counts differ. */
  onWordClick?: (p: Paragraph, charFraction: number) => void;
  onWordDoubleClick?: (word: string, p: Paragraph) => void;
  colors: ThemeColors;
  fontSize: number;
  fontFamily: string;
  headingFontFamily: string;
  lineHeight: string;
  textAlign?: TextAlign;
}

export function BookParagraph({
  paragraph,
  mode,
  onWordClick,
  onWordDoubleClick,
  colors,
  fontSize,
  fontFamily,
  headingFontFamily,
  lineHeight,
  textAlign = "left",
}: BookParagraphProps) {
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const text = paragraph.originalText;
  const isHeading = isHeadingParagraph(text);

  // ── Russian panel ──────────────────────────────────────────────────────────
  if (mode === "ru") {
    const ruContent = paragraph.isTranslated && paragraph.translatedText
      ? paragraph.translatedText
      : null;

    if (isHeading) {
      return (
        <div style={{ padding: "6px 12px 4px", borderBottom: `1px solid ${colors.border}` }}>
          <h2 style={{
            margin: 0,
            fontSize: Math.round(fontSize * 1.1),
            fontFamily: headingFontFamily,
            fontWeight: 700,
            lineHeight: 1.25,
            color: colors.heading,
            wordBreak: "break-word",
          }}>
            {ruContent ?? text}
          </h2>
        </div>
      );
    }

    // Split RU text into sentences, each gets a data-ru-sentence anchor
    // so handleWordClick can scroll to the exact sentence
    const ruSentences = ruContent ? splitSentences(ruContent) : [];

    return (
      <div style={{ padding: "4px 12px", borderBottom: `1px solid ${colors.border}` }}>
        {ruContent ? (
          <p style={{
            margin: 0, fontSize, lineHeight, fontFamily,
            color: colors.muted,
            fontStyle: "italic",
            wordBreak: "break-word",
            overflowWrap: "break-word",
            textAlign,
          }}>
            {ruSentences.map((sentence, i) => (
              <span key={i} data-ru-sentence={`${paragraph.id}-${i}`}>
                {sentence}
                {i < ruSentences.length - 1 ? " " : ""}
              </span>
            ))}
          </p>
        ) : (
          <p style={{ margin: 0, fontSize, color: colors.border, fontStyle: "italic" }}>…</p>
        )}
      </div>
    );
  }

  // ── English panel ──────────────────────────────────────────────────────────
  const rawTokens: string[] = text.match(/[\w''\u2019-]+|[^\w\s]+|\s+/g) ?? [];

  // Track each token's character offset in the original text
  let charOffset = 0;
  const tokens = rawTokens.map((token: string) => {
    const offset = charOffset;
    charOffset += token.length;
    return {
      token,
      charOffset: offset,
      isWord: /[\w''\u2019-]+/.test(token) && token.trim().length > 0,
    };
  });

  const handleWordTap = useCallback(
    (word: string, wordCharOffset: number) => {
      if (clickTimer.current) {
        // Second tap within 250 ms → double-tap: open dictionary.
        // Cancel the pending single-tap scroll so RU doesn't jump.
        clearTimeout(clickTimer.current);
        clickTimer.current = null;
        onWordDoubleClick?.(word, paragraph);
      } else {
        // First tap: schedule the RU scroll after 250 ms.
        // Pass the fractional position (0–1) of the tapped word within the
        // EN paragraph. The reader maps this proportionally to the RU text,
        // so mismatched EN/RU sentence counts never cause a wrong jump.
        const charFraction = wordCharOffset / Math.max(1, paragraph.originalText.length);
        clickTimer.current = setTimeout(() => {
          clickTimer.current = null;
          onWordClick?.(paragraph, charFraction);
        }, 250);
      }
    },
    [paragraph, onWordClick, onWordDoubleClick]
  );

  if (isHeading) {
    return (
      <div style={{ padding: "18px 16px 10px", borderBottom: `1px solid ${colors.border}` }}>
        <h2 style={{
          margin: 0,
          fontSize: Math.round(fontSize * 1.15),
          fontFamily: headingFontFamily,
          fontWeight: 700,
          lineHeight: 1.3,
          color: colors.heading,
          wordBreak: "break-word",
        }}>
          {tokens.map(({ token, isWord, charOffset: co }, i) => {
            if (!isWord) return <span key={i}>{token}</span>;
            const clean = token.replace(/^[^\w\u2019]+|[^\w\u2019]+$/g, "");
            return (
              <span
                key={i}
                onClick={e => { e.stopPropagation(); handleWordTap(clean, co); }}
                style={{ cursor: "pointer", borderRadius: 2, touchAction: "manipulation" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = colors.hover; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                {token}
              </span>
            );
          })}
        </h2>
      </div>
    );
  }

  return (
    <div style={{ padding: "10px 16px", borderBottom: `1px solid ${colors.border}` }}>
      <p style={{
        margin: 0, fontSize, lineHeight, fontFamily,
        color: colors.text,
        wordBreak: "break-word",
        overflowWrap: "break-word",
        textAlign,
        touchAction: "manipulation",
      }}>
        {tokens.map(({ token, isWord, charOffset: co }, i) => {
          if (!isWord) return <span key={i}>{token}</span>;
          const clean = token.replace(/^[^\w\u2019]+|[^\w\u2019]+$/g, "");
          return (
            <span
              key={i}
              onClick={e => { e.stopPropagation(); handleWordTap(clean, co); }}
              style={{ cursor: "pointer", borderRadius: 2, touchAction: "manipulation" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = colors.hover; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              {token}
            </span>
          );
        })}
      </p>
    </div>
  );
}
