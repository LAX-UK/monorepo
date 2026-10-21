import type { EditorialSearchReader } from "../application/ports/editorial-search.reader.js";

/** Editorial search port for route tests; matches nothing unless overridden. */
export function createStubEditorialSearchReader(
  overrides: Partial<EditorialSearchReader> = {},
): EditorialSearchReader {
  return {
    searchExhibitions: async () => [],
    searchStories: async () => [],
    ...overrides,
  };
}
