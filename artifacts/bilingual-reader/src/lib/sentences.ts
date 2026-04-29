/** Split text into sentences, preserving the original fragments */
export function splitSentences(text: string): string[] {
  // Match sentences ending with .!? including quotes/ellipsis, or the last fragment
  const parts = text.match(/[^.!?…]+(?:[.!?…]+["'»]?\s*)?/g) || [text];
  return parts.map(s => s.trim()).filter(Boolean);
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
