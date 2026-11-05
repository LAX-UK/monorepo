import type { ArtworkRegisterEntry } from "@auction/artwork-register-contracts";
import { describe, expect, it, vi } from "vitest";
import {
  type LinkableRecord,
  type LinkedListing,
  type UnlinkedListing,
  ZohoLinkRefusedError,
  type ZohoLinkWriter,
} from "../ports/zoho-link.ports.js";
import { type ZohoLinkDeps, ZohoLinkService } from "./zoho-link.service.js";

const T0 = new Date("2026-11-05T09:00:00.000Z");
const ART_1 = "a1111111-0000-4000-8000-000000000001";
const ART_2 = "a2222222-0000-4000-8000-000000000002";
const ART_3 = "a3333333-0000-4000-8000-000000000003";
const REG_1 = "b1111111-0000-4000-8000-000000000001";
const REG_2 = "b2222222-0000-4000-8000-000000000002";
const REG_3 = "b3333333-0000-4000-8000-000000000003";

const entry = (patch: Partial<ArtworkRegisterEntry> = {}): ArtworkRegisterEntry => ({
  id: REG_1,
  zohoProductId: "5001",
  stockCode: "LAX-ORI-AR-TM-26-0004",
  kind: "original",
  sourceOriginalId: null,
  title: "Tidal margin IV",
  artist: { zohoArtistId: "77", name: "Ada Rowe", code: "AR" },
  medium: "Oil on linen",
  dimensions: "90 × 120 cm",
  year: 2024,
  imageRefs: ["a.jpg"],
  catalogueStatus: "Available",
  offer: { state: "held", ref: null },
  zohoModifiedAt: T0,
  createdAt: T0,
  updatedAt: T0,
  version: 1,
  ...patch,
});

const listing = (patch: Partial<UnlinkedListing> = {}): UnlinkedListing => ({
  artworkId: ART_1,
  slug: "tidal-margin-iv",
  title: "Tidal margin IV",
  artistId: "artist-1",
  artistName: "Ada Rowe",
  artistCode: "AR",
  stockCode: null,
  medium: "Oil on linen",
  dimensions: "90 × 120 cm",
  year: 2024,
  imageKeys: ["a.jpg"],
  published: true,
  ...patch,
});

function build(
  input: {
    listings?: UnlinkedListing[];
    records?: ArtworkRegisterEntry[];
    writer?: Partial<ZohoLinkWriter>;
    block?: boolean;
    /** Record id to the title of the lax.art artwork already linked to it. */
    linkedTo?: Record<string, string>;
    linked?: LinkedListing[];
    names?: Record<string, string>;
  } = {},
) {
  const listings = input.listings ?? [listing()];
  const entries = input.records ?? [entry()];
  const records: LinkableRecord[] = entries.map((e) => ({
    entry: e,
    linkedTo: input.linkedTo?.[e.id] ?? null,
  }));
  const writer: ZohoLinkWriter = {
    link: vi.fn(async () => ({ linked: true, nowOnLaxArt: true, replaced: [] })),
    unlink: vi.fn(async () => true),
    ...input.writer,
  };
  const setBlock = vi.fn(async () => undefined);
  const deps: ZohoLinkDeps = {
    staffNames: {
      namesFor: vi.fn(
        async (ids: readonly string[]) =>
          new Map(ids.flatMap((id) => (input.names?.[id] ? [[id, input.names[id]] as const] : []))),
      ),
    },
    listings: {
      listLinked: vi.fn(async () => input.linked ?? []),
      listUnlinked: vi.fn(async () => listings),
      countUnlinked: vi.fn(async () => listings.length),
      findUnlinked: vi.fn(async (id: string) => listings.find((l) => l.artworkId === id) ?? null),
    },
    records: {
      listLinkable: vi.fn(async () => records),
      findById: vi.fn(async (id: string) => records.find((r) => r.entry.id === id) ?? null),
      search: vi.fn(async () => records),
    },
    artists: {
      findByZohoArtistCode: vi.fn(async (code: string) =>
        code === "AR" ? { artistId: "artist-1", displayName: "Ada Rowe", archived: false } : null,
      ),
    },
    writer,
    settings: {
      blockUnlinkedPublish: vi.fn(async () => input.block ?? false),
      setBlockUnlinkedPublish: setBlock,
    },
    now: () => T0,
  };
  return { service: new ZohoLinkService(deps), deps, writer, setBlock };
}

describe("ZohoLinkService.report", () => {
  it("groups every unlinked original as Matched, Needs a choice or No match", async () => {
    const { service } = build({
      listings: [
        listing(),
        listing({ artworkId: ART_2, title: "Twin", slug: "twin" }),
        listing({ artworkId: ART_3, title: "Nobody knows", slug: "nobody" }),
      ],
      records: [
        entry(),
        entry({
          id: REG_2,
          zohoProductId: "5002",
          stockCode: "LAX-ORI-AR-TW-26-0001",
          title: "Twin",
        }),
        entry({
          id: REG_3,
          zohoProductId: "5003",
          stockCode: "LAX-ORI-AR-TW-26-0002",
          title: "Twin",
        }),
      ],
    });
    const report = await service.report();
    expect(report.counts).toEqual({
      unlinked: 3,
      matched: 1,
      needsChoice: 1,
      noMatch: 1,
      linked: 0,
    });
    expect(report.matched[0]).toMatchObject({
      rule: "artist_and_title",
      candidates: [{ record: { registerId: REG_1, stockCode: "LAX-ORI-AR-TM-26-0004" } }],
    });
    expect(report.needsChoice[0]?.candidates.map((c) => c.record.registerId)).toEqual([
      REG_2,
      REG_3,
    ]);
    expect(report.noMatch[0]).toMatchObject({
      candidates: [],
      reason: "no_record_for_artist_and_title",
    });
    expect(report.checkedAt).toBe(T0.toISOString());
  });

  it("never links: matching only reads", async () => {
    const { service, writer, setBlock } = build();
    await service.report();
    await service.report();
    expect(writer.link).not.toHaveBeenCalled();
    expect(writer.unlink).not.toHaveBeenCalled();
    expect(setBlock).not.toHaveBeenCalled();
  });

  it("shows where Zoho and lax.art disagree, with lax.art's old value", async () => {
    const { service } = build({
      listings: [
        listing({ title: "Tidal Margin 4", year: 2023, stockCode: "LAX-ORI-AR-TM-26-0004" }),
      ],
    });
    const [row] = (await service.report()).matched;
    expect(row?.candidates[0]?.differences).toEqual([
      {
        field: "title",
        label: "Title",
        zohoValue: "Tidal margin IV",
        laxArtValue: "Tidal Margin 4",
      },
      { field: "year", label: "Year", zohoValue: "2024", laxArtValue: "2023" },
    ]);
  });

  it("names the place that holds a record, and sorts it with the rows that need a choice", async () => {
    const { service } = build({
      records: [entry({ offer: { state: "bid_sale", ref: { kind: "bid_lot", id: "lot-1" } } })],
    });
    const report = await service.report();
    expect(report.matched).toEqual([]);
    const [row] = report.needsChoice;
    expect(row?.candidates[0]?.refusal).toBe(
      "This artwork is in a LAX Bid sale. Withdraw the lot there first.",
    );
    expect(row?.candidates[0]?.record.whereItIs).toBe("In a LAX Bid sale");
  });

  it("shows a record already linked to another listing, says which, and cannot be chosen", async () => {
    const { service } = build({
      listings: [listing()],
      records: [
        entry(),
        entry({
          id: REG_2,
          zohoProductId: "5002",
          stockCode: "LAX-ORI-AR-TM-26-0005",
          title: "Tidal margin IV",
        }),
      ],
      linkedTo: { [REG_2]: "Harbour at dusk" },
    });
    const report = await service.report();
    expect(report.matched).toEqual([]);
    const [row] = report.needsChoice;
    const byId = new Map(row?.candidates.map((c) => [c.record.registerId, c]));
    expect(byId.get(REG_1)).toMatchObject({ refusal: null, record: { linkedTo: null } });
    expect(byId.get(REG_2)).toMatchObject({
      refusal: "This record is already linked to ‘Harbour at dusk’.",
      record: { linkedTo: "Harbour at dusk" },
    });
  });

  it("does not match a listing to the only record when that record is linked elsewhere", async () => {
    const { service } = build({ linkedTo: { [REG_1]: "Harbour at dusk" } });
    const report = await service.report();
    expect(report.counts).toMatchObject({ matched: 0, needsChoice: 1, noMatch: 0 });
    expect(report.needsChoice[0]?.candidates[0]?.record.linkedTo).toBe("Harbour at dusk");
  });

  it("lists what has been linked with the name of who did it", async () => {
    const { service } = build({
      listings: [],
      linked: [
        {
          artworkId: ART_1,
          slug: "tidal-margin-iv",
          title: "Tidal margin IV",
          artistName: "Ada Rowe",
          published: true,
          registerId: REG_1,
          stockCode: "LAX-ORI-AR-TM-26-0004",
          recordTitle: "Tidal margin IV",
          linkedAt: T0,
          actor: "staff:s-1",
        },
        {
          artworkId: ART_2,
          slug: "other",
          title: "Other",
          artistName: "Ada Rowe",
          published: false,
          registerId: REG_2,
          stockCode: "LAX-ORI-AR-OT-26-0001",
          recordTitle: "Other",
          linkedAt: T0,
          actor: "system",
        },
      ],
      names: { "s-1": "Lena Hart" },
    });
    const report = await service.report();
    expect(report.counts.linked).toBe(2);
    expect(report.linked.map((row) => row.linkedBy)).toEqual(["Lena Hart", null]);
    expect(report.linked[0]).toMatchObject({
      listing: { artworkId: ART_1, published: true },
      record: { registerId: REG_1, stockCode: "LAX-ORI-AR-TM-26-0004" },
      linkedAt: T0.toISOString(),
    });
  });

  it("gives every field both sides for the before and after table", async () => {
    const { service } = build({
      listings: [
        listing({
          title: "Tidal Margin 4",
          dimensions: "80 x 100 cm",
          stockCode: "LAX-ORI-AR-TM-26-0004",
        }),
      ],
    });
    const [row] = (await service.report()).matched;
    expect(row?.candidates[0]?.comparison).toEqual([
      {
        field: "title",
        label: "Title",
        laxArtValue: "Tidal Margin 4",
        zohoValue: "Tidal margin IV",
        changes: true,
      },
      {
        field: "artist",
        label: "Artist",
        laxArtValue: "Ada Rowe",
        zohoValue: "Ada Rowe",
        changes: false,
      },
      {
        field: "medium",
        label: "Medium",
        laxArtValue: "Oil on linen",
        zohoValue: "Oil on linen",
        changes: false,
      },
      {
        field: "size",
        label: "Size",
        laxArtValue: "80 x 100 cm",
        zohoValue: "90 × 120 cm",
        changes: true,
      },
      { field: "year", label: "Year", laxArtValue: "2024", zohoValue: "2024", changes: false },
      {
        field: "images",
        label: "Images",
        laxArtValue: "1 image",
        zohoValue: "1 image",
        changes: false,
      },
    ]);
  });

  it("is never title-only: a listing whose artist has no Zoho code is No match", async () => {
    const { service } = build({ listings: [listing({ artistCode: null })] });
    const report = await service.report();
    expect(report.counts.matched).toBe(0);
    expect(report.noMatch[0]?.reason).toBe("artist_has_no_zoho_code");
  });

  it("carries the publish switch", async () => {
    expect((await build({ block: true }).service.report()).blockUnlinkedPublish).toBe(true);
  });

  it("is empty when everything is linked", async () => {
    const { service } = build({ listings: [] });
    expect((await service.report()).counts).toEqual({
      unlinked: 0,
      matched: 0,
      needsChoice: 0,
      noMatch: 0,
      linked: 0,
    });
    expect(await service.count()).toEqual({ unlinked: 0 });
  });
});

describe("ZohoLinkService.preview and search", () => {
  it("previews what one link would change", async () => {
    const { service } = build({ listings: [listing({ medium: "Oil" })] });
    const preview = await service.preview(ART_1, REG_1);
    expect(preview.candidate.differences.map((d) => d.field)).toEqual(["medium"]);
  });

  it("answers 404 for an artwork that is not waiting or a record that is gone", async () => {
    const { service } = build();
    await expect(service.preview(ART_2, REG_1)).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.preview(ART_1, REG_2)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("searches the register, saying when there are more than are listed", async () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      entry({
        id: `b${i}`,
        zohoProductId: `p${i}`,
        stockCode: `LAX-ORI-AR-TM-26-${String(i + 1).padStart(4, "0")}`,
      }),
    );
    const { service, deps } = build({ records: many });
    const result = await service.search(" tidal ");
    expect(deps.records.search).toHaveBeenCalledWith("tidal", 21);
    expect(result.items).toHaveLength(20);
    expect(result.more).toBe(true);
  });

  it("says which listing a found record is already linked to", async () => {
    const { service } = build({ linkedTo: { [REG_1]: "Harbour at dusk" } });
    const result = await service.search("tidal");
    expect(result.items[0]).toMatchObject({ registerId: REG_1, linkedTo: "Harbour at dusk" });
  });
});

describe("ZohoLinkService.link", () => {
  const body = { artworkId: ART_1, registerId: REG_1 };

  it("links and reports that the listing is now on lax.art", async () => {
    const { service, writer } = build({
      writer: {
        link: vi.fn(async () => ({ linked: true, nowOnLaxArt: true, replaced: ["title"] })),
      },
    });
    await expect(service.link(body, "staff-1")).resolves.toEqual({
      ...body,
      status: "linked",
      message: null,
      nowOnLaxArt: true,
      replaced: ["title"],
    });
    expect(writer.link).toHaveBeenCalledWith({ ...body, actorSubjectId: "staff-1" });
  });

  it("is the same result when repeated", async () => {
    const { service } = build({
      writer: { link: vi.fn(async () => ({ linked: false, nowOnLaxArt: true, replaced: [] })) },
    });
    expect(await service.link(body, "staff-1")).toMatchObject({
      status: "already_linked",
      replaced: [],
    });
  });

  it("returns the register's words when the artwork is held elsewhere", async () => {
    const message = "This artwork is in a LAX Bid sale. Withdraw the lot there first.";
    const { service } = build({
      writer: {
        link: vi.fn(async () => {
          throw new ZohoLinkRefusedError(message);
        }),
      },
    });
    expect(await service.link(body, "staff-1")).toMatchObject({
      status: "refused",
      message,
      nowOnLaxArt: false,
    });
  });

  it("does not hide a fault that is not a refusal", async () => {
    const { service } = build({
      writer: {
        link: vi.fn(async () => {
          throw new Error("database down");
        }),
      },
    });
    await expect(service.link(body, "staff-1")).rejects.toThrow("database down");
  });
});

describe("ZohoLinkService.linkBulk", () => {
  it("links Matched rows and nothing else", async () => {
    const { service, writer } = build({
      listings: [listing(), listing({ artworkId: ART_2, title: "Twin", slug: "twin" })],
      records: [
        entry(),
        entry({
          id: REG_2,
          zohoProductId: "5002",
          stockCode: "LAX-ORI-AR-TW-26-0001",
          title: "Twin",
        }),
        entry({
          id: REG_3,
          zohoProductId: "5003",
          stockCode: "LAX-ORI-AR-TW-26-0002",
          title: "Twin",
        }),
      ],
    });
    const result = await service.linkBulk(
      [
        { artworkId: ART_1, registerId: REG_1 },
        { artworkId: ART_2, registerId: REG_2 },
      ],
      "staff-1",
    );
    expect(result.outcomes.map((o) => [o.artworkId, o.status])).toEqual([
      [ART_1, "linked"],
      [ART_2, "not_a_match"],
    ]);
    expect(writer.link).toHaveBeenCalledTimes(1);
  });

  it("does not link a pair that is not the match for that artwork", async () => {
    const { service, writer } = build({
      records: [
        entry(),
        entry({
          id: REG_2,
          zohoProductId: "5002",
          stockCode: "LAX-ORI-AR-XX-26-0001",
          title: "Other",
        }),
      ],
    });
    const result = await service.linkBulk([{ artworkId: ART_1, registerId: REG_2 }], "staff-1");
    expect(result.outcomes[0]?.status).toBe("not_a_match");
    expect(writer.link).not.toHaveBeenCalled();
  });

  it("does not link a record that another listing already holds", async () => {
    const { service, writer } = build({ linkedTo: { [REG_1]: "Harbour at dusk" } });
    const result = await service.linkBulk([{ artworkId: ART_1, registerId: REG_1 }], "staff-1");
    expect(result.outcomes[0]?.status).toBe("not_a_match");
    expect(writer.link).not.toHaveBeenCalled();
  });

  it("carries on after one refusal and reports each outcome", async () => {
    const link = vi
      .fn()
      .mockRejectedValueOnce(new ZohoLinkRefusedError("Sold in the gallery."))
      .mockResolvedValueOnce({ linked: true, nowOnLaxArt: false, replaced: [] });
    const { service } = build({
      listings: [listing(), listing({ artworkId: ART_2, title: "Solo", slug: "solo" })],
      records: [
        entry(),
        entry({
          id: REG_2,
          zohoProductId: "5002",
          stockCode: "LAX-ORI-AR-SO-26-0001",
          title: "Solo",
        }),
      ],
      writer: { link },
    });
    const result = await service.linkBulk(
      [
        { artworkId: ART_1, registerId: REG_1 },
        { artworkId: ART_2, registerId: REG_2 },
      ],
      "staff-1",
    );
    expect(result.outcomes.map((o) => o.status)).toEqual(["refused", "linked"]);
  });

  it("answers a repeated confirmation with the writer's already_linked, changing nothing", async () => {
    const { service } = build({
      listings: [],
      records: [],
      writer: { link: vi.fn(async () => ({ linked: false, nowOnLaxArt: true, replaced: [] })) },
    });
    const result = await service.linkBulk([{ artworkId: ART_1, registerId: REG_1 }], "staff-1");
    expect(result.outcomes[0]?.status).toBe("already_linked");
  });
});

describe("ZohoLinkService.unlink", () => {
  it("needs a reason", async () => {
    const { service, writer } = build();
    await expect(
      service.unlink({ artworkId: ART_1, reason: "   " }, "admin-1"),
    ).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(writer.unlink).not.toHaveBeenCalled();
  });

  it("passes the trimmed reason and who asked", async () => {
    const { service, writer } = build();
    await expect(
      service.unlink({ artworkId: ART_1, reason: " Linked to the wrong record " }, "admin-1"),
    ).resolves.toEqual({ artworkId: ART_1, unlinked: true });
    expect(writer.unlink).toHaveBeenCalledWith({
      artworkId: ART_1,
      reason: "Linked to the wrong record",
      actorSubjectId: "admin-1",
    });
  });

  it("is refused with a 409 and the register's words while the artwork is in a Bid sale", async () => {
    const { service } = build({
      writer: {
        unlink: vi.fn(async () => {
          throw new ZohoLinkRefusedError("This artwork is in a LAX Bid sale.");
        }),
      },
    });
    await expect(
      service.unlink({ artworkId: ART_1, reason: "Mistake" }, "admin-1"),
    ).rejects.toMatchObject({ statusCode: 409, message: "This artwork is in a LAX Bid sale." });
  });

  it("does nothing the second time", async () => {
    const { service } = build({ writer: { unlink: vi.fn(async () => false) } });
    expect(await service.unlink({ artworkId: ART_1, reason: "Mistake" }, "admin-1")).toEqual({
      artworkId: ART_1,
      unlinked: false,
    });
  });
});

describe("ZohoLinkService settings", () => {
  it("reads and changes the publish switch", async () => {
    const { service, setBlock } = build();
    expect(await service.settings()).toEqual({ blockUnlinkedPublish: false });
    await service.updateSettings({ blockUnlinkedPublish: true }, "admin-1");
    expect(setBlock).toHaveBeenCalledWith(true, "admin-1");
  });
});
