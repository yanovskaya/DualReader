import { type CSSProperties } from "react";

// ── Deterministic palette from title ─────────────────────────────────────────

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const PALETTES = [
  { top: "#1a1a2e", mid: "#16213e", bot: "#0f3460", text: "#e8d5b7", accent: "#e8b86d" },
  { top: "#3d1a24", mid: "#6b2d3e", bot: "#8b3a52", text: "#fde8d0", accent: "#e8a87c" },
  { top: "#0f2027", mid: "#203a43", bot: "#2c5364", text: "#d8f3f0", accent: "#7fd0c8" },
  { top: "#1a0a2e", mid: "#3d1a6e", bot: "#5c2a9b", text: "#efe0ff", accent: "#c89aff" },
  { top: "#0d3b2e", mid: "#1a5c40", bot: "#2d7a52", text: "#d8f5e8", accent: "#7ecfa0" },
  { top: "#2a1500", mid: "#4a2800", bot: "#6b3800", text: "#fdf0d5", accent: "#e8c060" },
  { top: "#1a0a0a", mid: "#3d1515", bot: "#6b1a1a", text: "#ffe8e8", accent: "#ff9898" },
  { top: "#0a1628", mid: "#1a2a4a", bot: "#2c4a8a", text: "#d8e8ff", accent: "#80b0f8" },
  { top: "#1a1200", mid: "#3b2900", bot: "#6b4800", text: "#fdf5d8", accent: "#e0c050" },
  { top: "#0a1a0a", mid: "#1a3d1a", bot: "#2a5c2a", text: "#e8fce8", accent: "#88d888" },
  { top: "#0d0d1a", mid: "#1a1a3d", bot: "#2a2a6b", text: "#e8e8ff", accent: "#a8a8ff" },
  { top: "#1a0d15", mid: "#3d1a30", bot: "#6b2a52", text: "#ffe8f5", accent: "#f080c0" },
] as const;

function getPalette(title: string) {
  return PALETTES[hashStr(title) % PALETTES.length];
}

// ── Decorative ornament SVGs ──────────────────────────────────────────────────

function Ornament({ color, size = 40 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" style={{ opacity: 0.7 }}>
      <circle cx="20" cy="20" r="1.5" fill={color} />
      <circle cx="20" cy="20" r="5" stroke={color} strokeWidth="0.7" fill="none" />
      <circle cx="20" cy="20" r="9.5" stroke={color} strokeWidth="0.5" fill="none" strokeDasharray="2 2" />
      <line x1="20" y1="8" x2="20" y2="4" stroke={color} strokeWidth="0.7" />
      <line x1="20" y1="32" x2="20" y2="36" stroke={color} strokeWidth="0.7" />
      <line x1="8" y1="20" x2="4" y2="20" stroke={color} strokeWidth="0.7" />
      <line x1="32" y1="20" x2="36" y2="20" stroke={color} strokeWidth="0.7" />
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface BookCoverArtProps {
  title: string;
  author?: string | null;
  size?: "sm" | "md" | "lg";
  style?: CSSProperties;
}

export function BookCoverArt({ title, author, size = "md", style }: BookCoverArtProps) {
  const p = getPalette(title);

  const fontSize = size === "sm" ? { title: 11, author: 9, rule: 24 }
    : size === "md" ? { title: 14, author: 10.5, rule: 30 }
    : { title: 17, author: 12, rule: 36 };

  const ornSize = size === "sm" ? 24 : size === "md" ? 30 : 38;

  return (
    <div style={{
      width: "100%",
      height: "100%",
      background: `linear-gradient(165deg, ${p.top} 0%, ${p.mid} 50%, ${p.bot} 100%)`,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "12% 10%",
      boxSizing: "border-box",
      position: "relative",
      overflow: "hidden",
      ...style,
    }}>

      {/* Subtle edge highlight — mimics real book cover gloss */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "linear-gradient(120deg, rgba(255,255,255,0.06) 0%, transparent 50%)",
      }} />

      {/* Top rule */}
      <div style={{ width: `${fontSize.rule}%`, height: 1, background: p.accent, opacity: 0.6, marginBottom: 10 }} />

      {/* Ornament */}
      <div style={{ marginBottom: 8 }}>
        <Ornament color={p.accent} size={ornSize} />
      </div>

      {/* Bottom rule */}
      <div style={{ width: `${fontSize.rule}%`, height: 1, background: p.accent, opacity: 0.6, marginBottom: 12 }} />

      {/* Title */}
      <p style={{
        margin: 0,
        fontSize: fontSize.title,
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontWeight: 700,
        color: p.text,
        textAlign: "center",
        lineHeight: 1.35,
        letterSpacing: "0.03em",
        wordBreak: "break-word",
        maxWidth: "90%",
      }}>
        {title}
      </p>

      {/* Author */}
      {author && (
        <p style={{
          margin: "8px 0 0",
          fontSize: fontSize.author,
          fontFamily: "'Helvetica Neue', Arial, sans-serif",
          fontWeight: 400,
          color: p.accent,
          textAlign: "center",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          opacity: 0.9,
          maxWidth: "90%",
        }}>
          {author}
        </p>
      )}
    </div>
  );
}
