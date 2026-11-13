import { readFileSync } from "node:fs";

/**
 * Noto Sans (SIL Open Font License), embedded in the PDFs we issue. It prints names in Latin,
 * Latin Extended, Greek and Cyrillic scripts, and the true minus sign (U+2212) the money
 * formatter uses; the PDF base fonts cover only Western European text and have no minus sign.
 * Scripts outside those (for example Arabic or CJK) are not in the font.
 */
const FONT_FILES = {
  regular: "NotoSans_400Regular.ttf",
  bold: "NotoSans_700Bold.ttf",
} as const;

let fontBuffers: { regular: Buffer; bold: Buffer } | null = null;

/** The embedded font files, read once. */
export function documentFonts(): { regular: Buffer; bold: Buffer } {
  fontBuffers ??= {
    regular: readFileSync(new URL(`../../fonts/${FONT_FILES.regular}`, import.meta.url)),
    bold: readFileSync(new URL(`../../fonts/${FONT_FILES.bold}`, import.meta.url)),
  };
  return fontBuffers;
}
