import { useRef, useCallback } from "react";
import type { Paragraph } from "@workspace/api-client-react/src/generated/api.schemas";
import { isHeadingParagraph } from "@/lib/sentences";
import type { ThemeColors } from "@/hooks/use-reader-settings";

export interface BookParagraphProps {
  paragraph: Paragraph;
  onWordDoubleClick: (word: string, p: Paragraph) => void;
  colors: ThemeColors;
  fontSize: number;
  fontFamily: string;
  headingFontFamily: string;
  lineHeight: string;
}

export function BookParagraph({
  paragraph,
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

  // Tokenize for word double-click
  const rawTokens: string[] = text.match(/[\w''\u2019-]+|[^\w\s]+|\s+/g) ?? [];
  let charPos = 0;
  const tokens: { token: string; isWord: boolean }[] = rawTokens.map((token: string) => {
    const start = charPos;
    charPos += token.length;
    void start;
    const isWord = /[\w''\u2019-]+/.test(token) && token.trim().length > 0;
    return { token, isWord };
  });

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

  const colDivider: React.CSSProperties = {
    width: 1,
    flexShrink: 0,
    background: colors.border,
    alignSelf: "stretch",
  };

  const cellBase: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    padding: "8px 10px",
  };

  // ── Chapter heading ────────────────────────────────────────────────────────
  if (isHeading) {
    return (
      <div style={{
        display: "flex",
        borderBottom: `1px solid ${colors.border}`,
        background: colors.bg,
      }}>
        <div style={{ ...cellBase, paddingTop: 24, paddingBottom: 12 }}>
          <h2 style={{
            fontSize: Math.round(fontSize * 1.2),
            fontFamily: headingFontFamily,
            fontWeight: 700,
            color: colors.heading,
            margin: 0,
            lineHeight: 1.3,
          }}>
            {text}
          </h2>
        </div>
        <div style={colDivider} />
        <div style={{ ...cellBase, paddingTop: 24, paddingBottom: 12, display: "flex", alignItems: "center" }}>
          {paragraph.translatedText ? (
            <h2 style={{
              fontSize: Math.round(fontSize * 1.2),
              fontFamily: headingFontFamily,
              fontWeight: 700,
              color: colors.heading,
              margin: 0,
              lineHeight: 1.3,
            }}>
              {paragraph.translatedText}
            </h2>
          ) : (
            <span style={{ fontSize: 12, color: colors.muted, fontStyle: "italic" }}>…</span>
          )}
        </div>
      </div>
    );
  }

  // ── Normal paragraph ────────────────────────────────────────────────────────
  return (
    <div style={{
      display: "flex",
      borderBottom: `1px solid ${colors.border}`,
    }}>
      {/* English */}
      <div style={cellBase}>
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
      </div>

      {/* Divider */}
      <div style={colDivider} />

      {/* Russian */}
      <div style={cellBase}>
        {paragraph.isTranslated && paragraph.translatedText ? (
          <p style={{
            fontSize: Math.max(12, fontSize - 1),
            lineHeight,
            fontFamily,
            color: colors.muted,
            margin: 0,
            hyphens: "auto",
            wordBreak: "break-word",
            fontStyle: "italic",
          }}>
            {paragraph.translatedText}
          </p>
        ) : (
          <p style={{ fontSize: 12, color: colors.border, margin: 0, fontStyle: "italic" }}>
            {paragraph.isTranslated === false ? "…" : ""}
          </p>
        )}
      </div>
    </div>
  );
}
