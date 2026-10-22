import {
  type EditorialLinksService,
  createEditorialLinksService,
} from "../application/editorial-links.service.js";
import type { EditorialLinksRepository } from "../application/ports/editorial-links.repository.js";

/** The real service over an empty repository, so route tests still exercise its validation. */
export function createStubEditorialLinksService(
  overrides: Partial<EditorialLinksRepository> = {},
): EditorialLinksService {
  return createEditorialLinksService({
    getExhibitionLinks: async () => null,
    getStoryLinks: async () => null,
    replaceExhibitionLinks: async () => ({ status: "parent_not_found" }),
    replaceStoryLinks: async () => ({ status: "parent_not_found" }),
    searchCandidates: async () => ({ items: [], nextCursor: null }),
    ...overrides,
  });
}
