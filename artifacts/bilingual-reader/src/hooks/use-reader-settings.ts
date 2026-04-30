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

  // ── Cream — очень светлый тёплый белый ────────────────────────────────────
  cream: {
    bg: "#FAF8F3",
    drawerBg: "#F3F0E8",
    headerBg: "rgba(250,248,243,0.97)",
    border: "rgba(90,70,40,0.09)",
    text: "#2a2018",
    muted: "#7a6a55",
    heading: "#1c150d",
    hover: "rgba(90,70,40,0.04)",
    accent: "#6b8f5e",
    swatch: "#FAF8F3",
  },

  // ── Sepia — мягкий молочно-жёлтый ────────────────────────────────────────
  sepia: {
    bg: "#FCF9F2",
    drawerBg: "#F2ECD8",
    headerBg: "rgba(252,249,242,0.97)",
    border: "rgba(100,75,50,0.10)",
    text: "#3b2e1e",
    muted: "#7a6555",
    heading: "#2a1f10",
    hover: "rgba(100,75,50,0.05)",
    accent: "#7c5c3a",
    swatch: "#FCF9F2",
  },

  // ── Parchment — тёплый бежевый ────────────────────────────────────────────
  parchment: {
    bg: "#F6EDD8",
    drawerBg: "#EDE0BE",
    headerBg: "rgba(246,237,216,0.97)",
    border: "rgba(110,80,30,0.13)",
    text: "#35250c",
    muted: "#7a6035",
    heading: "#241808",
    hover: "rgba(110,80,30,0.06)",
    accent: "#9a6f2a",
    swatch: "#F6EDD8",
  },

  // ── Warm — почти белый с лёгким янтарём ──────────────────────────────────
  warm: {
    bg: "#FEFAF5",
    drawerBg: "#F4EDE0",
    headerBg: "rgba(254,250,245,0.97)",
    border: "rgba(150,100,50,0.09)",
    text: "#2e2010",
    muted: "#8a6a45",
    heading: "#1e1408",
    hover: "rgba(150,100,50,0.05)",
    accent: "#b56b2a",
    swatch: "#FEFAF5",
  },

  // ── Sage — тёплый нейтральный серый (едва тёплый) ─────────────────────────
  sage: {
    bg: "#F5F3F0",
    drawerBg: "#ECEAE6",
    headerBg: "rgba(245,243,240,0.97)",
    border: "rgba(80,70,60,0.10)",
    text: "#252220",
    muted: "#706860",
    heading: "#18150f",
    hover: "rgba(80,70,60,0.04)",
    accent: "#6b8f5e",
    swatch: "#F5F3F0",
  },

  // ── Pearl — светло-серый (нейтральный холодный) ───────────────────────────
  pearl: {
    bg: "#F5F5F5",
    drawerBg: "#EBEBEB",
    headerBg: "rgba(245,245,245,0.97)",
    border: "rgba(0,0,0,0.09)",
    text: "#1e1e1e",
    muted: "#666666",
    heading: "#141414",
    hover: "rgba(0,0,0,0.04)",
    accent: "#059669",
    swatch: "#F5F5F5",
  },

  // ── Blush — едва тёплый белый (почти белый) ──────────────────────────────
  blush: {
    bg: "#FEFCF8",
    drawerBg: "#F5F2EA",
    headerBg: "rgba(254,252,248,0.97)",
    border: "rgba(100,80,50,0.08)",
    text: "#252018",
    muted: "#706858",
    heading: "#1a1510",
    hover: "rgba(100,80,50,0.04)",
    accent: "#059669",
    swatch: "#FEFCF8",
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
  blush:     "Слоновая кость",
  warm:      "Тёплый белый",
  cream:     "Светлый кремовый",
  sepia:     "Светлая сепия",
  sage:      "Тёплый серый",
  pearl:     "Холодный серый",
  parchment: "Пергамент",
  slate:     "Ночной",
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
