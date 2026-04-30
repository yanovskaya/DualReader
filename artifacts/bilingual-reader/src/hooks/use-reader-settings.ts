import { useState, useEffect } from "react";

export type Theme = "white" | "sepia" | "sage" | "warm" | "slate" | "amoled";
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
  accent: string;          // green dot / highlight
  swatch: string;          // color shown in theme picker
}

export const THEMES: Record<Theme, ThemeColors> = {
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
  sepia: {
    bg: "#f9f1e3",
    drawerBg: "#ede4cf",
    headerBg: "rgba(249,241,227,0.96)",
    border: "rgba(100,75,50,0.13)",
    text: "#3b2e1e",
    muted: "#7a6555",
    heading: "#2a1f10",
    hover: "rgba(100,75,50,0.06)",
    accent: "#7c5c3a",
    swatch: "#f9f1e3",
  },
  sage: {
    bg: "#eef4ee",
    drawerBg: "#dde9dd",
    headerBg: "rgba(238,244,238,0.96)",
    border: "rgba(60,100,60,0.12)",
    text: "#1e3028",
    muted: "#5a7a62",
    heading: "#142218",
    hover: "rgba(60,100,60,0.06)",
    accent: "#2d7a4f",
    swatch: "#eef4ee",
  },
  warm: {
    bg: "#fdf6ee",
    drawerBg: "#f0e6d4",
    headerBg: "rgba(253,246,238,0.96)",
    border: "rgba(150,100,50,0.12)",
    text: "#2e2010",
    muted: "#8a6a45",
    heading: "#1e1408",
    hover: "rgba(150,100,50,0.06)",
    accent: "#b56b2a",
    swatch: "#fdf6ee",
  },
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
  white: "Белый",
  sepia: "Сепия",
  sage: "Зелёный",
  warm: "Тёплый",
  slate: "Синий",
  amoled: "Чёрный",
};

export const FONT_FAMILIES: Record<FontFamily, { label: string; css: string }> = {
  serif: { label: "Serif",  css: "Georgia, 'Times New Roman', serif" },
  sans:  { label: "Sans",   css: "-apple-system, 'Helvetica Neue', Arial, sans-serif" },
  mono:  { label: "Mono",   css: "'Courier New', Courier, monospace" },
};

export const LINE_SPACINGS: Record<LineSpacing, { label: string; value: string }> = {
  compact:  { label: "Сжатый",   value: "1.55" },
  normal:   { label: "Обычный",  value: "1.80" },
  relaxed:  { label: "Просторный", value: "2.10" },
};

export const MARGINS: Record<Margin, { label: string; value: string }> = {
  narrow: { label: "Узкий",    value: "0 10px" },
  normal: { label: "Обычный",  value: "0 22px" },
  wide:   { label: "Широкий",  value: "0 40px" },
};

export const FONT_SIZE_MIN = 14;
export const FONT_SIZE_MAX = 32;
export const FONT_SIZE_DEFAULT = 19;

const STORAGE_KEY = "lingua_reader_settings_v2";

function load(): ReaderSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        theme: "sepia",
        fontSize: FONT_SIZE_DEFAULT,
        fontFamily: "serif",
        lineSpacing: "normal",
        margin: "normal",
        ...parsed,
      };
    }
  } catch {}
  return { theme: "sepia", fontSize: FONT_SIZE_DEFAULT, fontFamily: "serif", lineSpacing: "normal", margin: "normal" };
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
