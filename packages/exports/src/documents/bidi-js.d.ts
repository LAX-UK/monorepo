/** The part of bidi-js (Unicode Bidirectional Algorithm, UAX #9) the PDF documents use. */
declare module "bidi-js" {
  export type EmbeddingLevels = {
    /** The resolved embedding level of each UTF-16 code unit; odd levels are right-to-left. */
    levels: Uint8Array;
    paragraphs: { start: number; end: number; level: number }[];
  };
  export type Bidi = {
    getEmbeddingLevels(text: string, direction?: "ltr" | "rtl" | "auto"): EmbeddingLevels;
    getReorderedIndices(
      text: string,
      levels: EmbeddingLevels,
      start?: number,
      end?: number,
    ): number[];
    getMirroredCharacter(char: string): string | null;
  };
  export default function bidiFactory(): Bidi;
}
