import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const fetchMock = vi.fn();

vi.mock("@/lib/data/http/authed-server-fetch", () => ({
  authedServerFetch: (...args: unknown[]) => fetchMock(...args),
}));

import { getAdminAmlScreeningsPage, screeningFromJson } from "./compliance-aml.server";

describe("screeningFromJson", () => {
  it("returns null when id or userId is missing", () => {
    expect(screeningFromJson({ userId: "u1" })).toBeNull();
    expect(screeningFromJson({ id: "s1" })).toBeNull();
  });

  it("parses AML screening payload including hits", () => {
    const row = screeningFromJson({
      id: "scr-1",
      userId: "user-1",
      providerSessionId: "prov-1",
      matchStatus: "possible_match",
      monitorStatus: "active",
      totalHits: 1,
      categories: ["sanctions"],
      hits: [
        {
          matchedName: "Jane Doe",
          countries: ["GB"],
          matchTypes: ["name"],
          categories: ["pep"],
          listings: {},
        },
      ],
      decisionOutcome: "pending",
      reviewStatus: "open",
      screenedAt: "2026-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    expect(row).toMatchObject({
      id: "scr-1",
      userId: "user-1",
      totalHits: 1,
      categories: ["sanctions"],
      hits: [
        expect.objectContaining({
          matchedName: "Jane Doe",
          countries: ["GB"],
        }),
      ],
    });
  });
});

describe("getAdminAmlScreeningsPage", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("fetches paginated AML screenings and parses rows", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ id: "scr-1", userId: "user-1", totalHits: 0, categories: [] }],
        meta: {
          total: 1,
          limit: 10,
          offset: 0,
          summary: {
            total: 1,
            awaitingTriage: 1,
            triaged: 0,
            escalated: 0,
          },
        },
      }),
    });

    const page = await getAdminAmlScreeningsPage({ limit: 10, offset: 0 });

    expect(fetchMock).toHaveBeenCalledWith("/admin/compliance/aml/screenings?limit=10&offset=0");
    expect(page.total).toBe(1);
    expect(page.rows).toHaveLength(1);
    expect(page.rows[0]?.id).toBe("scr-1");
  });
});
