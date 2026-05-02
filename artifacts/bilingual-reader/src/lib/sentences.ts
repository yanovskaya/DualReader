/**
 * Split text into sentences without false-splitting on abbreviations,
 * initials, or decimal numbers.
 *
 * Strategy: temporarily replace non-boundary dots with a placeholder,
 * then split on the remaining sentence-ending punctuation, then restore.
 */
export function splitSentences(text: string): string[] {
  const PLACEHOLDER = "\x01";

  let s = text;

  // Protect decimal / ordinal numbers:  3.14  →  3\x014
  s = s.replace(/(\d)\.(\d)/g, `$1${PLACEHOLDER}$2`);

  // Protect common English abbreviations (case-insensitive, word-boundary):
  // Mr. Mrs. Ms. Dr. Prof. Sr. Jr. St. vs. etc. e.g. i.e. approx. vol. fig. no. pp. ed. op. ca.
  s = s.replace(
    /\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e|approx|vol|fig|no|pp|ed|op|ca)\./gi,
    (m) => m.slice(0, -1) + PLACEHOLDER,
  );

  // Protect single uppercase initials:  "J. Smith"  "A. B. C. Title"
  s = s.replace(/\b([A-Z])\.(?=\s)/g, `$1${PLACEHOLDER}`);

  // Now split on real sentence boundaries.
  // Use a lookbehind so the punctuation stays with the sentence that ends with it,
  // and only the whitespace between sentences is consumed by split().
  const parts = s.split(/(?<=[.!?…]+["'»\])]?)\s+(?=[A-Z\u0400-\u04FF«"(])/);

  // Restore placeholder → "." and trim whitespace.
  return parts
    .map((p) => p.replace(new RegExp(PLACEHOLDER, "g"), ".").trim())
    .filter(Boolean);
}

/** Find which sentence index a character position belongs to */
export function sentenceIdxForCharPos(text: string, charPos: number): number {
  const sentences = splitSentences(text);
  let cursor = 0;
  for (let i = 0; i < sentences.length; i++) {
    const start = text.indexOf(sentences[i], cursor);
    if (start === -1) continue;
    if (charPos <= start + sentences[i].length) return i;
    cursor = start + sentences[i].length;
  }
  return sentences.length - 1;
}

/** Heuristic: is this paragraph a heading? */
export function isHeadingParagraph(text: string): boolean {
  const t = text.trim();
  if (t.length > 120) return false;
  // "1. Title", "12. Chapter name"
  if (/^\d+\.\s+\S/.test(t)) return true;
  // "Chapter 1", "Part II", "Epilogue", "Prologue", "Act I", "Scene 1"
  if (/^(chapter|part|section|prologue|epilogue|afterword|foreword|preface|act|scene|book)\b/i.test(t)) return true;
  // Roman numerals alone: "IV", "XII."
  if (/^[IVXLCDM]+\.?\s*$/.test(t)) return true;
  // ALL CAPS short line (title-like)
  if (t.length <= 60 && t === t.toUpperCase() && /^[A-Z][A-Z\s\d'"-]{2,}$/.test(t)) return true;
  return false;
}
