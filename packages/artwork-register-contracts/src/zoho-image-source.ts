import { z } from "zod";

/**
 * One picture of an artwork as the register keeps it: which file in Zoho it came from, how that
 * file looked when it was copied, and where the copy lives in LAX's own storage.
 *
 * `zohoFileId` and `fingerprint` say whether Zoho's file has changed since (no download needed to
 * find out). `sha256` and `key` identify the copy: the key is derived from the content, so the same
 * picture is stored once however many artworks or Zoho files carry it.
 */
export const zohoImageSourceSchema = z.object({
  zohoFileId: z.string().min(1),
  fingerprint: z.string().min(1),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  key: z.string().min(1),
});
export type ZohoImageSource = z.infer<typeof zohoImageSourceSchema>;

/**
 * The storage keys of a record's pictures in order, each once. The first is the cover. This is the
 * value of the register's `imageRefs`, so the two can never disagree.
 */
export function imageKeysOf(sources: readonly ZohoImageSource[]): string[] {
  return [...new Set(sources.map((source) => source.key))];
}

/** True when two lists describe the same pictures in the same order. */
export function sameImageSources(
  a: readonly ZohoImageSource[],
  b: readonly ZohoImageSource[],
): boolean {
  return (
    a.length === b.length &&
    a.every((source, i) => {
      const other = b[i];
      return (
        other !== undefined &&
        source.zohoFileId === other.zohoFileId &&
        source.fingerprint === other.fingerprint &&
        source.sha256 === other.sha256 &&
        source.key === other.key
      );
    })
  );
}
