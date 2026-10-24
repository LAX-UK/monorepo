import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchAdminJson = vi.fn();

vi.mock("./load-admin-data", () => ({ fetchAdminJson }));

const { searchArtworkOptions, searchEditionOptions, searchPartyOptions } = await import(
  "./admin-lookup-actions.server"
);

beforeEach(() => {
  fetchAdminJson.mockReset();
});

describe("picker searches", () => {
  it("search people by what was typed, trimmed, and show them by name with their email", async () => {
    fetchAdminJson.mockResolvedValue({
      status: "ok",
      data: {
        items: [
          { partyId: "p1", displayName: "Ada Lovelace", kind: "person", email: "ada@example.com" },
        ],
      },
    });

    const options = await searchPartyOptions("  ada ");

    expect(fetchAdminJson).toHaveBeenCalledWith("lookups/parties?limit=15&q=ada");
    expect(options).toEqual([
      { id: "p1", label: "Ada Lovelace", description: "ada@example.com", meta: "Person" },
    ]);
  });

  it("list the most recent records when nothing is typed", async () => {
    fetchAdminJson.mockResolvedValue({ status: "ok", data: { items: [] } });
    await searchArtworkOptions("   ");
    expect(fetchAdminJson).toHaveBeenCalledWith("lookups/artworks?limit=15");
  });

  it("never send a search longer than the API accepts", async () => {
    fetchAdminJson.mockResolvedValue({ status: "ok", data: { items: [] } });
    await searchEditionOptions("x".repeat(500));
    const path = fetchAdminJson.mock.calls[0]?.[0] as string;
    expect(new URLSearchParams(path.split("?")[1]).get("q")).toHaveLength(100);
  });

  it("show editions as the work and its number, with the artist and status", async () => {
    fetchAdminJson.mockResolvedValue({
      status: "ok",
      data: {
        items: [
          {
            editionId: "e1",
            artworkId: "a1",
            artworkTitle: "Vessel Study",
            artistName: "Theo Marsh",
            editionNumber: 2,
            listingStatus: "held",
          },
        ],
      },
    });
    expect(await searchEditionOptions("vessel")).toEqual([
      { id: "e1", label: "Vessel Study, edition 2", description: "Theo Marsh", meta: "Held" },
    ]);
  });

  it.each(["unauthorized", "forbidden", "failed", "not_found"])(
    "come back empty rather than failing the form when the lookup is %s",
    async (status) => {
      fetchAdminJson.mockResolvedValue({ status });
      expect(await searchPartyOptions("ada")).toEqual([]);
      expect(await searchArtworkOptions("ada")).toEqual([]);
      expect(await searchEditionOptions("ada")).toEqual([]);
    },
  );
});
