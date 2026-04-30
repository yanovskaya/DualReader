import type { Chapter } from "@workspace/api-client-react/src/generated/api.schemas";
import type { ThemeColors } from "@/hooks/use-reader-settings";

interface TocDrawerProps {
  chapters: Chapter[];
  colors: ThemeColors;
  fontSize: number;
  onNavigate: (chapter: Chapter) => void;
  onClose: () => void;
  readingPct: number;       // 0–1, current scroll position in the book
  totalParagraphs: number;  // total paragraph count for position math
}

export function TocDrawer({ chapters, colors, fontSize, onNavigate, onClose, readingPct, totalParagraphs }: TocDrawerProps) {
  // Determine the current chapter index based on scroll position
  const currentParaPos = Math.floor(readingPct * Math.max(1, totalParagraphs));
  let currentChapterIdx = 0;
  for (let i = 0; i < chapters.length; i++) {
    if (chapters[i].position <= currentParaPos) currentChapterIdx = i;
    else break;
  }

  // Calculate each chapter's read progress (0–1)
  function chapterReadPct(i: number): number {
    const start = chapters[i].position;
    const end = i + 1 < chapters.length ? chapters[i + 1].position : totalParagraphs;
    const chLen = Math.max(1, end - start);
    const readInChapter = Math.max(0, currentParaPos - start);
    if (i < currentChapterIdx) return 1;            // fully passed
    if (i > currentChapterIdx) return 0;            // not started
    return Math.min(1, readInChapter / chLen);       // current chapter progress
  }

  const overallPct = Math.round(readingPct * 100);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.45)" }}
      />

      {/* Drawer */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
        background: colors.bg,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        maxHeight: "75dvh",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 -4px 32px rgba(0,0,0,0.18)",
      }}>
        {/* Handle */}
        <div style={{ padding: "10px 20px 0", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: colors.border, margin: "0 auto 14px" }} />
        </div>

        {/* Header row */}
        <div style={{ padding: "0 20px 10px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: colors.heading }}>Оглавление</span>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.muted, fontSize: 20, padding: "0 4px", lineHeight: 1 }}
          >✕</button>
        </div>

        {/* Overall progress bar */}
        <div style={{ padding: "0 20px 10px", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: colors.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Прогресс чтения
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: colors.accent }}>{overallPct}%</span>
          </div>
          <div style={{ height: 5, background: colors.border, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${overallPct}%`, height: "100%", background: colors.accent, borderRadius: 3, transition: "width 0.4s" }} />
          </div>
        </div>

        <div style={{ width: "100%", height: 1, background: colors.border, flexShrink: 0 }} />

        {/* Chapter list */}
        <div style={{ overflowY: "auto", flex: 1, padding: "6px 0 24px" }}>
          {chapters.length === 0 && (
            <p style={{ textAlign: "center", color: colors.muted, fontSize: 14, padding: "32px 20px" }}>
              Главы не найдены
            </p>
          )}
          {chapters.map((ch, i) => {
            const isCurrent = i === currentChapterIdx;
            const chPct = chapterReadPct(i);
            const isDone = chPct >= 1 && i < currentChapterIdx;

            return (
              <button
                key={ch.id}
                onClick={() => { onNavigate(ch); onClose(); }}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  background: isCurrent ? `${colors.accent}12` : "transparent",
                  border: "none", cursor: "pointer",
                  padding: "10px 20px",
                  borderBottom: `1px solid ${colors.border}`,
                  borderLeft: isCurrent ? `3px solid ${colors.accent}` : "3px solid transparent",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isCurrent ? `${colors.accent}18` : colors.hover; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isCurrent ? `${colors.accent}12` : "transparent"; }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  {/* Number */}
                  <span style={{
                    flexShrink: 0, fontSize: 11, fontWeight: 700,
                    color: isCurrent ? colors.accent : colors.muted,
                    minWidth: 24, paddingTop: 2,
                  }}>
                    {i + 1}
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* EN title */}
                    <p style={{
                      margin: 0, fontSize, fontWeight: isCurrent ? 700 : 500,
                      color: isDone ? colors.muted : colors.text,
                      lineHeight: 1.3, wordBreak: "break-word",
                      textDecoration: isDone ? "none" : "none",
                      opacity: isDone ? 0.6 : 1,
                    }}>
                      {ch.originalText}
                    </p>
                    {/* RU title */}
                    {ch.translatedText && (
                      <p style={{
                        margin: "2px 0 0", fontSize: fontSize - 2,
                        color: colors.muted, fontStyle: "italic", lineHeight: 1.3,
                        wordBreak: "break-word",
                        opacity: isDone ? 0.5 : 0.85,
                      }}>
                        {ch.translatedText}
                      </p>
                    )}
                    {/* Chapter progress bar (only for current and recent) */}
                    {(isCurrent || (chPct > 0 && chPct < 1)) && (
                      <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 7 }}>
                        <div style={{ flex: 1, height: 3, background: colors.border, borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ width: `${Math.round(chPct * 100)}%`, height: "100%", background: colors.accent, borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 10, color: colors.accent, fontWeight: 600, flexShrink: 0 }}>
                          {Math.round(chPct * 100)}%
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Done check */}
                  {isDone && (
                    <span style={{ flexShrink: 0, fontSize: 13, color: colors.muted, opacity: 0.5, paddingTop: 1 }}>✓</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
