import { useState, useEffect } from "react";

export type Theme = "light" | "sepia" | "dark";
export type FontSize = "sm" | "md" | "lg" | "xl";

export interface ReaderSettings {
  theme: Theme;
  fontSize: FontSize;
}

export interface ThemeColors {
  bg: string;
  panelBg: string;
  headerBg: string;
  border: string;
  text: string;
  muted: string;
  heading: string;
  hover: string;
  selected: string;
}

export const THEMES: Record<Theme, ThemeColors> = {
  light: {
    bg: "#ffffff",
    panelBg: "#f8f8f8",
    headerBg: "rgba(255,255,255,0.95)",
    border: "rgba(0,0,0,0.08)",
    text: "#1a1a1a",
    muted: "#6b7280",
    heading: "#111111",
    hover: "rgba(0,0,0,0.04)",
    selected: "rgba(0,0,0,0.06)",
  },
  sepia: {
    bg: "#f8f1e3",
    panelBg: "#ede5d0",
    headerBg: "rgba(248,241,227,0.96)",
    border: "rgba(100,75,50,0.12)",
    text: "#3b2e1e",
    muted: "#7a6555",
    heading: "#2a1f10",
    hover: "rgba(100,75,50,0.06)",
    selected: "rgba(100,75,50,0.09)",
  },
  dark: {
    bg: "#1e1e2e",
    panelBg: "#181825",
    headerBg: "rgba(30,30,46,0.97)",
    border: "rgba(255,255,255,0.07)",
    text: "#cdd6f4",
    muted: "#a6adc8",
    heading: "#e6e9f4",
    hover: "rgba(255,255,255,0.04)",
    selected: "rgba(255,255,255,0.07)",
  },
};

export const FONT_SIZES: Record<FontSize, { body: string; heading: string }> = {
  sm: { body: "15px", heading: "18px" },
  md: { body: "17px", heading: "21px" },
  lg: { body: "19px", heading: "24px" },
  xl: { body: "22px", heading: "28px" },
};

const STORAGE_KEY = "lingua_reader_settings";

function load(): ReaderSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { theme: "sepia", fontSize: "md", ...JSON.parse(raw) };
  } catch {}
  return { theme: "sepia", fontSize: "md" };
}

export function useReaderSettings() {
  const [settings, setSettings] = useState<ReaderSettings>(load);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {}
  }, [settings]);

  const setTheme = (theme: Theme) => setSettings(s => ({ ...s, theme }));
  const setFontSize = (fontSize: FontSize) => setSettings(s => ({ ...s, fontSize }));

  return { settings, setTheme, setFontSize };
}
