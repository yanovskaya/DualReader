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
const INLINE_BREAK_RE = /[ \t]*\.[ \t]+\*[ \t]*\*[ \t]*\*[ \t]+\.[ \t]*/;

/** Split text on embedded scene-break markers; returns array of text parts (length ≥ 1). */
function splitOnInlineBreaks(text: string): string[] {
  return text.split(INLINE_BREAK_RE).map(p => p.trim()).filter(p => p.length > 0);
}

/**
 * Safety split for paragraphs that are too long to render without crashing mobile browsers.
 * Splits at sentence boundaries (. ! ?) to produce chunks of at most MAX_CHUNK chars.
 */
const MAX_CHUNK = 1500;

function safeChunks(text: string): string[] {
  if (text.length <= MAX_CHUNK) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > MAX_CHUNK) {
    // Find the last sentence boundary within MAX_CHUNK characters
    const slice = remaining.slice(0, MAX_CHUNK);
    const cut = Math.max(
      slice.lastIndexOf(". "),
      slice.lastIndexOf("! "),
      slice.lastIndexOf("? "),
      slice.lastIndexOf(".\n"),
    );
    const splitAt = cut > MAX_CHUNK / 2 ? cut + 2 : MAX_CHUNK;
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

/** Three-dot scene-break divider — defined at module level so React never sees a "new" type. */
function InlineSceneBreak({ muted }: { muted: string }) {
  return (
    <div style={{
      padding: "20px 0",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
    }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          display: "inline-block", width: 5, height: 5,
          borderRadius: "50%", background: muted, opacity: 0.45,
        }} />
      ))}
    </div>
  );
}

/** Tokenise text into clickable word spans — defined at module level, no closures that change. */
function renderWordTokens(
  text: string,
  partKey: string,
  onWordClick: ((word: string, p: Paragraph) => void) | undefined,
  paragraph: Paragraph,
  colors: ThemeColors,
) {
  const rawToks: string[] = text.match(/[\w''\u2019-]+|[^\w\s]+|\s+/g) ?? [];
  return rawToks.map((token, i) => {
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

    const ruParts = ruContent ? splitOnInlineBreaks(ruContent).flatMap(safeChunks) : null;
    return (
      <div style={{ padding: "4px 12px", borderBottom: `1px solid ${colors.border}` }}>
        {ruParts ? (
          ruParts.map((part, idx) => (
            <div key={idx}>
              {idx > 0 && <InlineSceneBreak muted={colors.muted} />}
              <p style={{
                margin: 0, fontSize, lineHeight, fontFamily,
                color: colors.muted,
                fontStyle: "italic",
                wordBreak: "break-word",
                overflowWrap: "break-word",
                textAlign,
              }}>
                {part}
              </p>
            </div>
          ))
        ) : (
          <p style={{ margin: 0, fontSize, color: colors.border, fontStyle: "italic" }}>…</p>
        )}
      </div>
    );
  }

  // ── English panel ──────────────────────────────────────────────────────────
  // Split on inline scene-break markers, then further split any oversized chunk
  // to prevent mobile browsers from crashing on huge token arrays.
  const enParts = splitOnInlineBreaks(text).flatMap(safeChunks);

  if (isHeading) {
    // Headings are rarely huge but apply the same safety cap
    const headingText = text.length > MAX_CHUNK ? text.slice(0, MAX_CHUNK) + "…" : text;
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
          {renderWordTokens(headingText, "h", onWordClick, paragraph, colors)}
        </h2>
      </div>
    );
  }

  return (
    <div style={{ padding: "10px 16px", borderBottom: `1px solid ${colors.border}` }}>
      {enParts.map((part, idx) => (
        <div key={idx}>
          {idx > 0 && <InlineSceneBreak muted={colors.muted} />}
          <p style={{
            margin: 0, fontSize, lineHeight, fontFamily,
            color: colors.text,
            wordBreak: "break-word",
            overflowWrap: "break-word",
            textAlign,
            touchAction: "manipulation",
          }}>
            {renderWordTokens(part, String(idx), onWordClick, paragraph, colors)}
          </p>
        </div>
      ))}
    </div>
  );
}
