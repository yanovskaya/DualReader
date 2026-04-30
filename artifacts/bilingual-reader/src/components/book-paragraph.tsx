import { useRef, useCallback } from "react";
import type { Paragraph } from "@workspace/api-client-react/src/generated/api.schemas";
import { isHeadingParagraph } from "@/lib/sentences";
import type { TextAlign, ThemeColors } from "@/hooks/use-reader-settings";

export interface BookParagraphProps {
  paragraph: Paragraph;
  /** "en" = only English text (clickable words), "ru" = only Russian translation */
  mode: "en" | "ru";
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
  onWordDoubleClick,
  colors,
  fontSize,
  fontFamily,
  headingFontFamily,
  lineHeight,
  textAlign = "left",
}: BookParagraphProps) {
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickCount = useRef(0);

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
            {ruContent}
          </p>
        ) : (
          <p style={{ margin: 0, fontSize, color: colors.border, fontStyle: "italic" }}>…</p>
        )}
      </div>
    );
  }

  // ── English panel ──────────────────────────────────────────────────────────
  const rawTokens: string[] = text.match(/[\w''\u2019-]+|[^\w\s]+|\s+/g) ?? [];
  const tokens = rawTokens.map((token: string) => ({
    token,
    isWord: /[\w''\u2019-]+/.test(token) && token.trim().length > 0,
  }));

  const handleWordTap = useCallback(
    (word: string) => {
      clickCount.current += 1;
      if (clickCount.current === 1) {
        clickTimer.current = setTimeout(() => { clickCount.current = 0; }, 280);
      } else {
        if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
        clickCount.current = 0;
        onWordDoubleClick?.(word, paragraph);
      }
    },
    [paragraph, onWordDoubleClick]
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
          {tokens.map(({ token, isWord }, i) => {
            if (!isWord) return <span key={i}>{token}</span>;
            const clean = token.replace(/^[^\w\u2019]+|[^\w\u2019]+$/g, "");
            return (
              <span
                key={i}
                onClick={e => { e.stopPropagation(); handleWordTap(clean); }}
                style={{ cursor: "pointer", borderRadius: 2 }}
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
      }}>
        {tokens.map(({ token, isWord }, i) => {
          if (!isWord) return <span key={i}>{token}</span>;
          const clean = token.replace(/^[^\w\u2019]+|[^\w\u2019]+$/g, "");
          return (
            <span
              key={i}
              onClick={e => { e.stopPropagation(); handleWordTap(clean); }}
              style={{ cursor: "pointer", borderRadius: 2 }}
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
