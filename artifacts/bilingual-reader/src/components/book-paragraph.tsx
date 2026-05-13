import type { Paragraph } from "@workspace/api-client-react/src/generated/api.schemas";
import { isHeadingParagraph, isSceneBreak } from "@/lib/sentences";
import type { TextAlign, ThemeColors } from "@/hooks/use-reader-settings";

export interface BookParagraphProps {
  paragraph: Paragraph;
  /** "en" = only English text (clickable words), "ru" = only Russian translation */
  mode: "en" | "ru";
  onWordClick?: (word: string, p: Paragraph) => void;
  colors: ThemeColors;
  fontSize: number;
  fontFamily: string;
  headingFontFamily: string;
  lineHeight: string;
  textAlign?: TextAlign;
}

/** Regex that matches the ". * * * ." separators embedded within long paragraphs. */
const INLINE_BREAK_RE = /[ \t]*\.[ \t]+\*[ \t]*\*[ \t]*\*[ \t]+\.[ \t]*/g;

/** Split text on embedded scene-break markers; returns array of text parts (length ≥ 1). */
function splitOnInlineBreaks(text: string): string[] {
  return text.split(INLINE_BREAK_RE).map(p => p.trim()).filter(p => p.length > 0);
}

export function BookParagraph({
  paragraph,
  mode,
  onWordClick,
  colors,
  fontSize,
  fontFamily,
  headingFontFamily,
  lineHeight,
  textAlign = "left",
}: BookParagraphProps) {
  const text = paragraph.originalText;
  const isHeading = isHeadingParagraph(text);
  const sceneBreak = isSceneBreak(text);

  // ── Scene break (*** / ---) — same in both panels ──────────────────────────
  if (sceneBreak) {
    return (
      <div style={{
        padding: "28px 16px",
        borderBottom: `1px solid ${colors.border}`,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 16,
      }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            display: "inline-block", width: 5, height: 5,
            borderRadius: "50%", background: colors.muted, opacity: 0.45,
          }} />
        ))}
      </div>
    );
  }

  // ── Scene-break divider helper ─────────────────────────────────────────────
  const SceneBreakDivider = () => (
    <div style={{
      padding: "20px 0",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
    }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          display: "inline-block", width: 5, height: 5,
          borderRadius: "50%", background: colors.muted, opacity: 0.45,
        }} />
      ))}
    </div>
  );

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

    const ruParts = ruContent ? splitOnInlineBreaks(ruContent) : null;
    return (
      <div style={{ padding: "4px 12px", borderBottom: `1px solid ${colors.border}` }}>
        {ruParts ? (
          ruParts.flatMap((part, idx) => [
            idx > 0 ? <SceneBreakDivider key={`br-${idx}`} /> : null,
            <p key={idx} style={{
              margin: 0, fontSize, lineHeight, fontFamily,
              color: colors.muted,
              fontStyle: "italic",
              wordBreak: "break-word",
              overflowWrap: "break-word",
              textAlign,
            }}>
              {part}
            </p>,
          ]).filter(Boolean)
        ) : (
          <p style={{ margin: 0, fontSize, color: colors.border, fontStyle: "italic" }}>…</p>
        )}
      </div>
    );
  }

  // ── English panel ──────────────────────────────────────────────────────────
  const enParts = splitOnInlineBreaks(text);

  function renderEnTokens(partText: string, partKey: string) {
    const rawToks: string[] = partText.match(/[\w''\u2019-]+|[^\w\s]+|\s+/g) ?? [];
    return rawToks.map((token: string, i) => {
      const isWord = /[\w''\u2019-]+/.test(token) && token.trim().length > 0;
      if (!isWord) return <span key={`${partKey}-${i}`}>{token}</span>;
      const clean = token.replace(/^[^\w\u2019]+|[^\w\u2019]+$/g, "");
      return (
        <span
          key={`${partKey}-${i}`}
          onClick={e => { e.stopPropagation(); onWordClick?.(clean, paragraph); }}
          style={{ cursor: "pointer", borderRadius: 2, touchAction: "manipulation" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = colors.hover; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          {token}
        </span>
      );
    });
  }

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
          {renderEnTokens(text, "h")}
        </h2>
      </div>
    );
  }

  return (
    <div style={{ padding: "10px 16px", borderBottom: `1px solid ${colors.border}` }}>
      {enParts.flatMap((part, idx) => [
        idx > 0 ? <SceneBreakDivider key={`br-${idx}`} /> : null,
        <p key={idx} style={{
          margin: 0, fontSize, lineHeight, fontFamily,
          color: colors.text,
          wordBreak: "break-word",
          overflowWrap: "break-word",
          textAlign,
          touchAction: "manipulation",
        }}>
          {renderEnTokens(part, String(idx))}
        </p>,
      ]).filter(Boolean)}
    </div>
  );
}
