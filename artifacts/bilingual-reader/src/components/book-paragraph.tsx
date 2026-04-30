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
  const tokens: { token: string; isWord: boolean }[] = rawTokens.map((token: string) => ({
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
        onWordDoubleClick(word, paragraph);
      }
    },
    [paragraph, onWordDoubleClick]
  );

  // Shared cell style — critical: min-width:0 prevents flex overflow
  const cellStyle = (side: "en" | "ru"): React.CSSProperties => ({
    flexShrink: 0,
    flexGrow: 0,
    width: showTranslation ? "50%" : (side === "en" ? "100%" : "0%"),
    minWidth: 0,
    overflow: "hidden",
    boxSizing: "border-box",
    padding: isHeading ? "22px 10px 8px" : "8px 10px",
    display: showTranslation || side === "en" ? "block" : "none",
    transition: "width 0.2s ease",
  });

  const enText = (
    <p style={{
      margin: 0,
      fontSize,
      lineHeight,
      fontFamily,
      color: colors.text,
      wordBreak: "break-word",
      overflowWrap: "break-word",
      hyphens: "auto",
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
  );

  const ruText = paragraph.isTranslated && paragraph.translatedText ? (
    <p style={{
      margin: 0,
      fontSize: Math.max(12, fontSize - 1),
      lineHeight,
      fontFamily,
      color: colors.muted,
      wordBreak: "break-word",
      overflowWrap: "break-word",
      hyphens: "auto",
      fontStyle: "italic",
    }}>
      {paragraph.translatedText}
    </p>
  ) : (
    <span style={{ fontSize: 12, color: colors.border, fontStyle: "italic" }}>…</span>
  );

  // ── Chapter heading ────────────────────────────────────────────────────────
  if (isHeading) {
    const headStyle: React.CSSProperties = {
      margin: 0,
      fontSize: Math.round(fontSize * 1.2),
      fontFamily: headingFontFamily,
      fontWeight: 700,
      lineHeight: 1.3,
      wordBreak: "break-word",
      overflowWrap: "break-word",
    };
    return (
      <div style={{ display: "flex", width: "100%", borderBottom: `2px solid ${colors.border}` }}>
        <div style={cellStyle("en")}>
          <h2 style={{ ...headStyle, color: colors.heading }}>{text}</h2>
        </div>
        {showTranslation && (
          <>
            <div style={{ width: 1, flexShrink: 0, background: colors.border }} />
            <div style={cellStyle("ru")}>
              <h2 style={{ ...headStyle, color: colors.accent }}>
                {paragraph.translatedText || "…"}
              </h2>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Normal paragraph ───────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", width: "100%", borderBottom: `1px solid ${colors.border}` }}>
      <div style={cellStyle("en")}>{enText}</div>
      {showTranslation && (
        <>
          <div style={{ width: 1, flexShrink: 0, background: colors.border }} />
          <div style={cellStyle("ru")}>{ruText}</div>
        </>
      )}
    </div>
  );
}
