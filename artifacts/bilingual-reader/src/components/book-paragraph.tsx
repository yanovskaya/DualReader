import { useCallback, useRef } from "react";
import type { Paragraph } from "@workspace/api-client-react/src/generated/api.schemas";
import { sentenceIdxForCharPos, isHeadingParagraph } from "@/lib/sentences";
import type { ThemeColors } from "@/hooks/use-reader-settings";

interface BookParagraphProps {
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

  // Tokenize text, tracking char positions
  const rawTokens: string[] = text.match(/[\w''-]+|[^\w\s]+|\s+/g) ?? [];
  let charPos = 0;
  const tokens: { token: string; isWord: boolean; sentenceIdx: number; charStart: number }[] =
    rawTokens.map((token: string) => {
      const start = charPos;
      charPos += token.length;
      const isWord = /[\w''-]+/.test(token) && token.trim().length > 0;
      const sentenceIdx = isWord ? sentenceIdxForCharPos(text, start) : 0;
      return { token, isWord, sentenceIdx, charStart: start };
    });

  // Double-click detection: two clicks within 280 ms = double click; single = nothing
  const handleWordTap = useCallback(
    (word: string) => {
      clickCount.current += 1;
      if (clickCount.current === 1) {
        clickTimer.current = setTimeout(() => {
          clickCount.current = 0;
          // single click → do nothing
        }, 280);
      } else if (clickCount.current >= 2) {
        if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
        clickCount.current = 0;
        onWordDoubleClick(word, paragraph);
      }
    },
    [paragraph, onWordDoubleClick]
  );

  // ── Translate button ───────────────────────────────────────────────────────
  const translateBtn = paragraph.isTranslated ? (
    <button
      data-nontap="1"
      onClick={e => { e.stopPropagation(); onToggleTranslation(); }}
      title={showTranslation ? "Скрыть перевод" : "Показать перевод"}
      style={{
        position: "absolute",
        top: 2,
        right: 0,
        width: 22,
        height: 22,
        borderRadius: 5,
        border: `1px solid ${showTranslation ? colors.accent : colors.border}`,
        background: showTranslation ? colors.accent + "22" : "transparent",
        color: showTranslation ? colors.accent : colors.muted,
        cursor: "pointer",
        fontSize: 13,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        lineHeight: 1,
        transition: "all 0.15s",
      }}
    >
      {showTranslation ? "▴" : "≡"}
    </button>
  ) : null;

  // ── Inline translation ─────────────────────────────────────────────────────
  const translationBlock = showTranslation && paragraph.isTranslated && paragraph.translatedText ? (
    <div style={{
      marginTop: 7,
      paddingTop: 7,
      borderTop: `1px dashed ${colors.border}`,
      fontSize: Math.max(13, fontSize - 2),
      fontFamily: "Georgia, 'Times New Roman', serif",
      color: colors.muted,
      lineHeight: "1.7",
      fontStyle: "italic",
      paddingRight: 26,   // same room as main text
    }}>
      {paragraph.translatedText}
    </div>
  ) : null;

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
    <div style={{ paddingLeft: padH, paddingRight: padH, paddingTop: 3, paddingBottom: 3, breakInside: "avoid" }}>
      {/* Row: paragraph text (with right room for button) + absolutely-positioned button */}
      <div style={{ position: "relative" }}>
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
          paddingRight: paragraph.isTranslated ? "26px" : 0,
        }}>
          {tokens.map(({ token, isWord }: { token: string; isWord: boolean; sentenceIdx: number; charStart: number }, i: number) => {
            if (!isWord) return <span key={i}>{token}</span>;
            const clean = token.replace(/^[^\w]+|[^\w]+$/g, "");
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
        </p>
        {translateBtn}
      </div>
      {translationBlock}
    </div>
  );
}
