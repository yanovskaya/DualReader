import { useState, useEffect } from "react";

export type Theme =
  | "white"
  | "cream"
  | "sepia"
  | "parchment"
  | "warm"
  | "sage"
  | "pearl"
  | "blush"
  | "slate"
  | "amoled";

export type FontFamily = "serif" | "sans" | "mono";
export type LineSpacing = "compact" | "normal" | "relaxed";
export type Margin = "narrow" | "normal" | "wide";

export interface ReaderSettings {
  theme: Theme;
  fontSize: number;       // 14–32 px
  fontFamily: FontFamily;
  lineSpacing: LineSpacing;
  margin: Margin;
}

export interface ThemeColors {
  bg: string;
  drawerBg: string;
  headerBg: string;
  border: string;
  text: string;
  muted: string;
  heading: string;
  hover: string;
  accent: string;
  swatch: string;
}

export const THEMES: Record<Theme, ThemeColors> = {
  // ── Crisp white ───────────────────────────────────────────────────────────
  white: {
    bg: "#ffffff",
    drawerBg: "#f5f5f5",
    headerBg: "rgba(255,255,255,0.95)",
    border: "rgba(0,0,0,0.09)",
    text: "#1a1a1a",
    muted: "#6b7280",
    heading: "#111111",
    hover: "rgba(0,0,0,0.04)",
    accent: "#059669",
    swatch: "#ffffff",
  },

  // ── Cream — Kindle Paperwhite ──────────────────────────────────────────────
  cream: {
    bg: "#f5f0e8",
    drawerBg: "#ece5d8",
    headerBg: "rgba(245,240,232,0.97)",
    border: "rgba(90,70,40,0.10)",
    text: "#2a2018",
    muted: "#7a6a55",
    heading: "#1c150d",
    hover: "rgba(90,70,40,0.05)",
    accent: "#6b8f5e",
    swatch: "#f5f0e8",
  },

  // ── Sepia — классическая желтоватая бумага ────────────────────────────────
  sepia: {
    bg: "#f9f1e3",
    drawerBg: "#ede4cf",
    headerBg: "rgba(249,241,227,0.97)",
    border: "rgba(100,75,50,0.13)",
    text: "#3b2e1e",
    muted: "#7a6555",
    heading: "#2a1f10",
    hover: "rgba(100,75,50,0.06)",
    accent: "#7c5c3a",
    swatch: "#f9f1e3",
  },

  // ── Parchment — пергамент, старинная рукопись ─────────────────────────────
  parchment: {
    bg: "#f2e5c0",
    drawerBg: "#e6d5a8",
    headerBg: "rgba(242,229,192,0.97)",
    border: "rgba(110,80,30,0.15)",
    text: "#35250c",
    muted: "#7a6035",
    heading: "#241808",
    hover: "rgba(110,80,30,0.07)",
    accent: "#9a6f2a",
    swatch: "#f2e5c0",
  },

  // ── Warm — мягкая янтарная бумага ────────────────────────────────────────
  warm: {
    bg: "#fdf6ee",
    drawerBg: "#f0e6d4",
    headerBg: "rgba(253,246,238,0.97)",
    border: "rgba(150,100,50,0.12)",
    text: "#2e2010",
    muted: "#8a6a45",
    heading: "#1e1408",
    hover: "rgba(150,100,50,0.06)",
    accent: "#b56b2a",
    swatch: "#fdf6ee",
  },

  // ── Sage — зелёная шалфей бумага ─────────────────────────────────────────
  sage: {
    bg: "#eef4ee",
    drawerBg: "#dde9dd",
    headerBg: "rgba(238,244,238,0.97)",
    border: "rgba(60,100,60,0.12)",
    text: "#1e3028",
    muted: "#5a7a62",
    heading: "#142218",
    hover: "rgba(60,100,60,0.06)",
    accent: "#2d7a4f",
    swatch: "#eef4ee",
  },

  // ── Pearl — серебристо-серая качественная бумага ──────────────────────────
  pearl: {
    bg: "#edeef2",
    drawerBg: "#e0e2e8",
    headerBg: "rgba(237,238,242,0.97)",
    border: "rgba(60,65,90,0.11)",
    text: "#1e2030",
    muted: "#606880",
    heading: "#141825",
    hover: "rgba(60,65,90,0.05)",
    accent: "#4a72c0",
    swatch: "#edeef2",
  },

  // ── Blush — лепестковая розовая бумага ───────────────────────────────────
  blush: {
    bg: "#fdf0ee",
    drawerBg: "#f5e2de",
    headerBg: "rgba(253,240,238,0.97)",
    border: "rgba(160,80,70,0.11)",
    text: "#32181a",
    muted: "#9a6060",
    heading: "#22100f",
    hover: "rgba(160,80,70,0.05)",
    accent: "#b85050",
    swatch: "#fdf0ee",
  },

  // ── Slate — тёмный (ночной) ───────────────────────────────────────────────
  slate: {
    bg: "#1e2432",
    drawerBg: "#161c28",
    headerBg: "rgba(30,36,50,0.97)",
    border: "rgba(255,255,255,0.08)",
    text: "#d0d8f0",
    muted: "#8898bb",
    heading: "#e8eef8",
    hover: "rgba(255,255,255,0.05)",
    accent: "#4ade80",
    swatch: "#1e2432",
  },

  // ── AMOLED — чёрный ───────────────────────────────────────────────────────
  amoled: {
    bg: "#000000",
    drawerBg: "#111111",
    headerBg: "rgba(0,0,0,0.98)",
    border: "rgba(255,255,255,0.07)",
    text: "#e8e8e8",
    muted: "#888888",
    heading: "#ffffff",
    hover: "rgba(255,255,255,0.06)",
    accent: "#22c55e",
    swatch: "#000000",
  },
};

export const THEME_LABELS: Record<Theme, string> = {
  white:     "Белый",
  cream:     "Кремовый",
  sepia:     "Сепия",
  parchment: "Пергамент",
  warm:      "Тёплый",
  sage:      "Шалфей",
  pearl:     "Серый",
  blush:     "Розовый",
  slate:     "Синий",
  amoled:    "Чёрный",
};

export const FONT_FAMILIES: Record<FontFamily, { label: string; css: string }> = {
  serif: { label: "Serif",  css: "Georgia, 'Times New Roman', serif" },
  sans:  { label: "Sans",   css: "-apple-system, 'Helvetica Neue', Arial, sans-serif" },
  mono:  { label: "Mono",   css: "'Courier New', Courier, monospace" },
};

export const LINE_SPACINGS: Record<LineSpacing, { label: string; value: string }> = {
  compact:  { label: "Сжатый",     value: "1.55" },
  normal:   { label: "Обычный",    value: "1.80" },
  relaxed:  { label: "Просторный", value: "2.10" },
};

export const MARGINS: Record<Margin, { label: string; value: string }> = {
  narrow: { label: "Узкий",   value: "0 10px" },
  normal: { label: "Обычный", value: "0 22px" },
  wide:   { label: "Широкий", value: "0 40px" },
};

export const FONT_SIZE_MIN = 14;
export const FONT_SIZE_MAX = 32;
export const FONT_SIZE_DEFAULT = 19;

const STORAGE_KEY = "lingua_reader_settings_v3";

function load(): ReaderSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ReaderSettings>;
      // Validate that saved theme still exists
      const theme: Theme = parsed.theme && parsed.theme in THEMES
        ? parsed.theme as Theme
        : "cream";
      return {
        theme,
        fontSize: FONT_SIZE_DEFAULT,
        fontFamily: "serif",
        lineSpacing: "normal",
        margin: "normal",
        ...parsed,
      };
    }
  } catch {}
  return { theme: "cream", fontSize: FONT_SIZE_DEFAULT, fontFamily: "serif", lineSpacing: "normal", margin: "normal" };
}

export function useReaderSettings() {
  const [settings, setSettings] = useState<ReaderSettings>(load);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {}
  }, [settings]);

  const update = <K extends keyof ReaderSettings>(key: K, val: ReaderSettings[K]) =>
    setSettings(s => ({ ...s, [key]: val }));

  return {
    settings,
    setTheme:      (v: Theme)       => update("theme", v),
    setFontSize:   (v: number)      => update("fontSize", v),
    setFontFamily: (v: FontFamily)  => update("fontFamily", v),
    setLineSpacing:(v: LineSpacing) => update("lineSpacing", v),
    setMargin:     (v: Margin)      => update("margin", v),
  };
}
