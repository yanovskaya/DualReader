const SCROLL_SPEED_KEY = (bookId: number) => `lingua_scroll_speed_${bookId}`;

export const SCROLL_SPEED_MIN = 0.8;
export const SCROLL_SPEED_MAX = 1.2;
export const SCROLL_SPEED_DEFAULT = 1.0;

export function loadScrollSpeed(bookId: number): number {
  try {
    const v = localStorage.getItem(SCROLL_SPEED_KEY(bookId));
    if (v === null) return SCROLL_SPEED_DEFAULT;
    const n = parseFloat(v);
    if (isNaN(n)) return SCROLL_SPEED_DEFAULT;
    return Math.max(SCROLL_SPEED_MIN, Math.min(SCROLL_SPEED_MAX, n));
  } catch {
    return SCROLL_SPEED_DEFAULT;
  }
}

export function saveScrollSpeed(bookId: number, speed: number): void {
  try {
    localStorage.setItem(SCROLL_SPEED_KEY(bookId), String(speed));
  } catch {}
}
