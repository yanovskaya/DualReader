import { useRef, useCallback } from "react";
import type { Paragraph } from "@workspace/api-client-react/src/generated/api.schemas";
import { isHeadingParagraph } from "@/lib/sentences";
import type { ThemeColors } from "@/hooks/use-reader-settings";

export interface BookParagraphProps {
  paragraph: Paragraph;
  showTranslation: boolean;
  onToggleTranslation: () => void;
  onWordDoubleClick: (word: string, p: Paragraph) => void;
  colors: ThemeColors;
  fontSize: number;
  fontFamily: string;
  headingFontFamily: string;
  lineHeight: string;
  padH: string;
}

export function BookParagraph({
  paragraph,
  showTranslation,
  onToggleTranslation,
  onWordDoubleClick,
  colors,
  fontSize,
  fontFamily,
  headingFontFamily,
  lineHeight,
  padH,
}: BookParagraphProps) {
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickCount = useRef(0);

  const text = paragraph.originalText;
  const isHeading = isHeadingParagraph(text);

  // Tokenize for word-level double-click
  const rawTokens: string[] = text.match(/[\w''\u2019-]+|[^\w\s]+|\s+/g) ?? [];
  let charPos = 0;
  const tokens: { token: string; isWord: boolean; charStart: number }[] = rawTokens.map(
    (token: string) => {
      const start = charPos;
      charPos += token.length;
      const isWord = /[\w''\u2019-]+/.test(token) && token.trim().length > 0;
      return { token, isWord, charStart: start };
    }
  );

  // Two taps within 280 ms = double-click → dictionary; single tap = nothing
  const handleWordTap = useCallback(
    (word: string) => {
      clickCount.current += 1;
      if (clickCount.current === 1) {
        clickTimer.current = setTimeout(() => {
          clickCount.current = 0;
        }, 280);
      } else {
        if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
        clickCount.current = 0;
        onWordDoubleClick(word, paragraph);
      }
    },
    [paragraph, onWordDoubleClick]
  );

  // ── Shared text style ────────────────────────────────────────────────────
  const outerStyle: React.CSSProperties = {
    paddingLeft: padH,
    paddingRight: padH,
    paddingTop: 3,
    paddingBottom: 3,
    breakInside: "avoid" as const,
  };

  // ── Chapter heading ──────────────────────────────────────────────────────
  if (isHeading) {
    return (
      <div style={{ ...outerStyle, paddingTop: 32, paddingBottom: 10 }}>
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

  // ── Translate button — inline, after the last word ────────────────────
  const translateBtn = paragraph.isTranslated ? (
    <button
      data-nontap="1"
      onClick={e => { e.stopPropagation(); onToggleTranslation(); }}
      title={showTranslation ? "Скрыть перевод" : "Показать перевод"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        marginLeft: 5,
        width: 20,
        height: 20,
        borderRadius: 4,
        border: `1px solid ${showTranslation ? colors.accent : colors.border}`,
        background: showTranslation ? colors.accent + "20" : "transparent",
        color: showTranslation ? colors.accent : colors.muted,
        cursor: "pointer",
        fontSize: 12,
        lineHeight: 1,
        verticalAlign: "middle",
        flexShrink: 0,
        transition: "all 0.15s",
      }}
    >
      {showTranslation ? "▴" : "≡"}
    </button>
  ) : null;

  // ── Translation block ──────────────────────────────────────────────────
  const translationBlock = showTranslation && paragraph.isTranslated && paragraph.translatedText ? (
    <div style={{
      marginTop: 7,
      paddingTop: 7,
      borderTop: `1px dashed ${colors.border}`,
      fontSize: Math.max(13, fontSize - 2),
      fontFamily: "Georgia, 'Times New Roman', serif",
      color: colors.muted,
      lineHeight: "1.75",
      fontStyle: "italic",
    }}>
      {paragraph.translatedText}
    </div>
  ) : null;

  // ── Normal paragraph ──────────────────────────────────────────────────
  return (
    <div style={outerStyle}>
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
        {tokens.map(({ token, isWord }: { token: string; isWord: boolean; charStart: number }, i: number) => {
          if (!isWord) return <span key={i}>{token}</span>;
          const clean = token.replace(/^[^\w\u2019]+|[^\w\u2019]+$/g, "");
          return (
            <span
              key={i}
              data-word="1"
              onClick={e => { e.stopPropagation(); handleWordTap(clean); }}
              style={{ cursor: "pointer" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = colors.hover; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              {token}
            </span>
          );
        })}
        {translateBtn}
      </p>
      {translationBlock}
    </div>
  );
}
