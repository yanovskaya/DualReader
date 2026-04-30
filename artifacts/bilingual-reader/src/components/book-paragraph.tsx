import { useRef, useCallback } from "react";
import type { Paragraph } from "@workspace/api-client-react/src/generated/api.schemas";
import { isHeadingParagraph } from "@/lib/sentences";
import type { ThemeColors } from "@/hooks/use-reader-settings";

export interface BookParagraphProps {
  paragraph: Paragraph;
  showTranslation: boolean;
  onWordDoubleClick: (word: string, p: Paragraph) => void;
  colors: ThemeColors;
  fontSize: number;
  fontFamily: string;
  headingFontFamily: string;
  lineHeight: string;
}

export function BookParagraph({
  paragraph,
  showTranslation,
  onWordDoubleClick,
  colors,
  fontSize,
  fontFamily,
  headingFontFamily,
  lineHeight,
}: BookParagraphProps) {
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickCount = useRef(0);

  const text = paragraph.originalText;
  const isHeading = isHeadingParagraph(text);

  const rawTokens: string[] = text.match(/[\w''\u2019-]+|[^\w\s]+|\s+/g) ?? [];
  let charPos = 0;
  const tokens: { token: string; isWord: boolean }[] = rawTokens.map((token: string) => {
    charPos += token.length;
    const isWord = /[\w''\u2019-]+/.test(token) && token.trim().length > 0;
    return { token, isWord };
  });
  void charPos;

  const handleWordTap = useCallback(
    (word: string) => {
      clickCount.current += 1;
      if (clickCount.current === 1) {
        clickTimer.current = setTimeout(() => { clickCount.current = 0; }, 280);
      } else {
        if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
        clickCount.current = 0;
        onWordDoubleClick(word, paragraph);
      }
    },
    [paragraph, onWordDoubleClick]
  );

  // ── Chapter heading ──────────────────────────────────────────────────────
  if (isHeading) {
    return (
      <div style={{ padding: "28px 16px 8px" }}>
        <h2 style={{
          fontSize: Math.round(fontSize * 1.22),
          fontFamily: headingFontFamily,
          fontWeight: 700,
          color: colors.heading,
          margin: 0,
          lineHeight: 1.3,
        }}>
          {text}
        </h2>
        {showTranslation && paragraph.translatedText && (
          <p style={{
            fontSize: Math.round(fontSize * 1.1),
            fontFamily: headingFontFamily,
            fontWeight: 600,
            color: colors.accent,
            margin: "6px 0 0",
            lineHeight: 1.3,
          }}>
            {paragraph.translatedText}
          </p>
        )}
        <div style={{ height: 1, background: colors.border, marginTop: 10 }} />
      </div>
    );
  }

  // ── Normal paragraph ─────────────────────────────────────────────────────
  return (
    <div style={{ padding: "0 16px 18px" }}>
      {/* English */}
      <p style={{
        fontSize,
        lineHeight,
        fontFamily,
        color: colors.text,
        margin: 0,
        hyphens: "auto",
        wordBreak: "break-word",
      }}>
        {tokens.map(({ token, isWord }, i) => {
          if (!isWord) return <span key={i}>{token}</span>;
          const clean = token.replace(/^[^\w\u2019]+|[^\w\u2019]+$/g, "");
          return (
            <span
              key={i}
              onClick={e => { e.stopPropagation(); handleWordTap(clean); }}
              style={{ cursor: "pointer" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = colors.hover; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              {token}
            </span>
          );
        })}
      </p>

      {/* Russian — shown only when translation is on */}
      {showTranslation && (
        <div style={{ marginTop: 8 }}>
          {paragraph.isTranslated && paragraph.translatedText ? (
            <p style={{
              fontSize: Math.max(12, fontSize - 1),
              lineHeight,
              fontFamily,
              color: colors.muted,
              margin: 0,
              fontStyle: "italic",
              hyphens: "auto",
              wordBreak: "break-word",
              paddingLeft: 10,
              borderLeft: `2px solid ${colors.border}`,
            }}>
              {paragraph.translatedText}
            </p>
          ) : (
            <p style={{
              fontSize: 11,
              color: colors.border,
              margin: 0,
              paddingLeft: 10,
              borderLeft: `2px solid ${colors.border}`,
              fontStyle: "italic",
            }}>
              перевод…
            </p>
          )}
        </div>
      )}
    </div>
  );
}
