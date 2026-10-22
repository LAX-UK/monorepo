import type { EnquiryInboxRepository } from "../application/ports/enquiry-inbox.repository.js";

/** An empty inbox for route tests; override methods as needed. */
export function createStubEnquiryInboxRepository(
  overrides: Partial<EnquiryInboxRepository> = {},
): EnquiryInboxRepository {
  return {
    list: async () => ({
      items: [],
      nextCursor: null,
      counts: { new: 0, in_progress: 0, closed: 0 },
    }),
    summary: async () => ({ newCount: 0, needsAttentionCount: 0 }),
    getDetail: async () => null,
    update: async () => ({ status: "not_found" }),
    addNote: async () => null,
    listAssignees: async () => [],
    ...overrides,
  };
}
