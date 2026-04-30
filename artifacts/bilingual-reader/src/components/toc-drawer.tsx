import type { Chapter } from "@workspace/api-client-react/src/generated/api.schemas";
import type { ThemeColors } from "@/hooks/use-reader-settings";

interface TocDrawerProps {
  chapters: Chapter[];
  colors: ThemeColors;
  fontSize: number;
  onNavigate: (chapter: Chapter) => void;
  onClose: () => void;
}

export function TocDrawer({ chapters, colors, fontSize, onNavigate, onClose }: TocDrawerProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 40,
          background: "rgba(0,0,0,0.45)",
        }}
      />

      {/* Drawer */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
        background: colors.bg,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        maxHeight: "70dvh",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 -4px 32px rgba(0,0,0,0.18)",
      }}>
        {/* Handle + header */}
        <div style={{ padding: "10px 20px 12px", flexShrink: 0 }}>
          <div style={{
            width: 36, height: 4, borderRadius: 2,
            background: colors.border, margin: "0 auto 14px",
          }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: colors.heading }}>
              Оглавление
            </span>
            <button
              onClick={onClose}
              style={{
                background: "transparent", border: "none", cursor: "pointer",
                color: colors.muted, fontSize: 20, padding: "0 4px", lineHeight: 1,
              }}
            >✕</button>
          </div>
        </div>

        <div style={{ width: "100%", height: 1, background: colors.border, flexShrink: 0 }} />

        {/* Chapter list */}
        <div style={{ overflowY: "auto", flex: 1, padding: "8px 0 24px" }}>
          {chapters.length === 0 && (
            <p style={{ textAlign: "center", color: colors.muted, fontSize: 14, padding: "32px 20px" }}>
              Главы не найдены
            </p>
          )}
          {chapters.map((ch, i) => (
            <button
              key={ch.id}
              onClick={() => { onNavigate(ch); onClose(); }}
              style={{
                display: "block", width: "100%", textAlign: "left",
                background: "transparent", border: "none", cursor: "pointer",
                padding: "11px 20px",
                borderBottom: `1px solid ${colors.border}`,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = colors.hover; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                {/* Chapter number */}
                <span style={{
                  flexShrink: 0, fontSize: 11, fontWeight: 700,
                  color: colors.accent, minWidth: 28, paddingTop: 2,
                  opacity: 0.8,
                }}>
                  {i + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* English title */}
                  <p style={{
                    margin: 0, fontSize, fontWeight: 600,
                    color: colors.text, lineHeight: 1.3,
                    wordBreak: "break-word",
                  }}>
                    {ch.originalText}
                  </p>
                  {/* Russian title */}
                  {ch.translatedText && (
                    <p style={{
                      margin: "3px 0 0", fontSize: fontSize - 2,
                      color: colors.muted, fontStyle: "italic", lineHeight: 1.3,
                      wordBreak: "break-word",
                    }}>
                      {ch.translatedText}
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
