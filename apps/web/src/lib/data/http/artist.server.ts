import "server-only";
import type { ArtistReader } from "@/lib/data/contracts";
import { createMockArtistReader } from "@/lib/data/mock/artist";

/** Composition root for artist reads (DIP). Swap implementation when a public artist API exists. */
export async function getServerArtistReader(): Promise<ArtistReader> {
  return createMockArtistReader();
}
