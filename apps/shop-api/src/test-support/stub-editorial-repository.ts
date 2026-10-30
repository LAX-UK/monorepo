import type { EditorialRepository } from "../application/ports/editorial.repository.js";

const notImplemented = () => {
  throw new Error("stub_editorial_not_implemented");
};

/** Minimal editorial port for route tests; override methods as needed. */
export function createStubEditorialRepository(
  overrides: Partial<EditorialRepository> = {},
): EditorialRepository {
  return {
    listAdminVenues: async () => [],
    listAdminExhibitions: async () => [],
    listAdminStories: async () => [],
    listAdminPages: async () => [],
    getHomePlacements: async () => [],
    listVenues: async () => [],
    getVenueBySlug: async () => null,
    listExhibitions: async () => [],
    getExhibitionBySlug: async () => null,
    listStories: async () => [],
    getStoryBySlug: async () => null,
    getArtistRelations: async () => null,
    listPages: async () => [],
    getPageBySlug: async () => null,
    insertGeneralEnquiry: async () => ({
      enquiryId: "11111111-1111-4111-8111-111111111111",
      reference: "E-2041",
    }),
    listGeneralEnquiriesForSubject: async () => [],
    getDraftEntityById: async () => null,
    getAdminPageById: async () => null,
    createPage: notImplemented,
    updatePage: notImplemented,
    setPagePublication: notImplemented,
    getAdminVenueById: async () => null,
    createVenue: notImplemented,
    updateVenue: notImplemented,
    setVenuePublication: notImplemented,
    getAdminStoryById: async () => null,
    createStory: notImplemented,
    updateStory: notImplemented,
    setStoryPublication: notImplemented,
    getAdminExhibitionById: async () => null,
    createExhibition: notImplemented,
    updateExhibition: notImplemented,
    setExhibitionPublication: notImplemented,
    listAdminPlacements: async () => [],
    replacePlacementSlot: notImplemented,
    recordPreviewTokenIssued: async () => {},
    ...overrides,
  };
}
