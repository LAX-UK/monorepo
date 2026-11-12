import {
  type ArtworkRegisterEntry,
  BID_NOT_CONNECTED_MESSAGE,
  InventoryPeerRefusedError,
  InventoryPeerUnavailableError,
} from "@auction/artwork-register-contracts";
import { ShopDomainError } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";
import { ShopApiError } from "../../errors/shop-api-error.js";
import type { OriginalForMove } from "../ports/original-move.js";
import { OriginalMoveService } from "./original-move.service.js";

const ARTWORK_ID = "11111111-1111-4111-8111-111111111111";
const REGISTER_ID = "22222222-2222-4222-8222-222222222222";
const SALE_ID = "33333333-3333-4333-8333-333333333333";
const LOT_ID = "44444444-4444-4444-8444-444444444444";
const NOW = new Date("2026-11-03T12:00:00Z");

const original = (over: Partial<OriginalForMove> = {}): OriginalForMove => ({
  artworkId: ARTWORK_ID,
  title: "Blue room",
  artistName: "A. Artist",
  description: "A quiet interior.",
  provenance: "The artist",
  medium: "Oil",
  dimensions: "80 x 60 cm",
  yearCreated: 2021,
  imageKeys: ["k1.jpg", "k2.jpg"],
  primaryImageUrl: "k1.jpg",
  zohoProductId: "z-1",
  salesChannel: "art",
  runKind: null,
  markedSold: false,
  onLaxArt: true,
  archived: false,
  openOriginalSale: false,
  ...over,
});

const entry = (over: Partial<ArtworkRegisterEntry> = {}): ArtworkRegisterEntry =>
  ({
    id: REGISTER_ID,
    zohoProductId: "z-1",
    kind: "original",
    stockCode: "LAX-ORI-PH-GAC-26-0001",
    title: "Tidal margin IV",
    artist: { zohoArtistId: "7", name: "Zoho Artist", code: "ZA" },
    medium: "Gouache",
    dimensions: "40 x 30 cm",
    year: 2024,
    imageRefs: ["z1.jpg", "z2.jpg", "z1.jpg"],
    catalogueStatus: "Available",
    offer: { state: "lax_art", ref: { kind: "shop_artwork", id: ARTWORK_ID } },
    ...over,
  }) as ArtworkRegisterEntry;

/** A record with no lax.art listing: held, and nothing for the register path to take down. */
const heldEntry = (over: Partial<ArtworkRegisterEntry> = {}) =>
  entry({ offer: { state: "held", ref: null }, ...over });

type Setup = {
  /** The lax.art listing; null for a record with none. */
  original?: OriginalForMove | null;
  entry?: ArtworkRegisterEntry | null;
  sales?: Array<{ id: string; title: string; startsAt: string }>;
  createDraftLot?: () => Promise<unknown>;
  listSales?: () => Promise<unknown>;
  findDraftLot?: () => Promise<unknown>;
  withdraw?: () => Promise<void>;
};

function setup(over: Setup = {}) {
  const found = over.original === undefined ? original() : over.original;
  const register = over.entry === undefined ? entry() : over.entry;
  const withdrawFromLaxArt = vi.fn(over.withdraw ?? (async () => undefined));
  const createDraftLot = vi.fn(
    over.createDraftLot ?? (async () => ({ lotId: LOT_ID, saleId: SALE_ID, created: true })),
  );
  const recordMoveConfirmed = vi.fn().mockResolvedValue({ status: "recorded" });
  const service = new OriginalMoveService({
    originals: {
      findById: vi.fn().mockResolvedValue(found),
      findByZohoProductId: vi.fn().mockResolvedValue(found),
    },
    register: {
      findById: vi.fn().mockResolvedValue(register),
      findByZohoProductId: vi.fn().mockResolvedValue(register),
    },
    history: { recordMoveConfirmed },
    auction: {
      listSales: (over.listSales ??
        vi
          .fn()
          .mockResolvedValue(
            over.sales ?? [
              { id: SALE_ID, title: "Winter sale", startsAt: "2026-12-01T10:00:00.000Z" },
            ],
          )) as never,
      createDraftLot: createDraftLot as never,
      findDraftLot: (over.findDraftLot ?? (async () => null)) as never,
      findLotCatalogue: (async () => null) as never,
      updateLotCatalogue: (async () => {
        throw new Error("not used");
      }) as never,
    },
    withdrawFromLaxArt,
    resolveImageUrl: (value) => (value ? `https://media.example/${value}` : null),
    now: () => NOW,
  });
  return { service, withdrawFromLaxArt, createDraftLot, recordMoveConfirmed };
}

const terms = { saleId: SALE_ID, startingPrice: "250.00", actorSubjectId: "user-1" };
const command = { artworkId: ARTWORK_ID, ...terms };
const registerCommand = { registerId: REGISTER_ID, ...terms };

const messages = (assessment: { blockers: Array<{ message: string }> }) =>
  assessment.blockers.map((blocker) => blocker.message).join(" ");

describe("OriginalMoveService.assess", () => {
  it("says an original on lax.art can move, with its stock code", async () => {
    expect(await setup().service.assess(ARTWORK_ID)).toEqual({
      registerId: REGISTER_ID,
      artworkId: ARTWORK_ID,
      title: "Blue room",
      stockCode: "LAX-ORI-PH-GAC-26-0001",
      onLaxArt: true,
      laxArtDraft: false,
      draftLot: null,
      holdingLotId: null,
      eligible: true,
      zohoPrice: null,
      blockers: [],
    });
  });

  it("shows Zoho's price for the dialog to put beside the starting price", async () => {
    const result = await setup({ entry: entry({ zohoPrice: "4800.00" }) }).service.assess(
      ARTWORK_ID,
    );
    expect(result.zohoPrice).toBe("4800.00");
  });

  it("gives every reason in words for staff, each with the link that goes with it", async () => {
    const result = await setup({
      original: original({ openOriginalSale: true }),
      entry: entry({ offer: { state: "bid_sale", ref: { kind: "bid_lot", id: LOT_ID } } }),
    }).service.assess(ARTWORK_ID);
    expect(result.eligible).toBe(false);
    expect(result.blockers).toHaveLength(2);
    expect(messages(result)).toMatch(/reserved/);
    expect(messages(result)).toMatch(/in a LAX Bid sale/);
    expect(result.blockers[1]?.link).toEqual({
      label: "Open lot in LAX Bid",
      target: "bid_lot",
    });
    expect(result.holdingLotId).toBe(LOT_ID);
  });

  it("refuses an artwork with no register record, and an edition run", async () => {
    const unlinked = await setup({ entry: null }).service.assess(ARTWORK_ID);
    expect(unlinked.eligible).toBe(false);
    expect(messages(unlinked)).toMatch(/not in the artwork register/);
    expect(unlinked.registerId).toBeNull();
    const run = await setup({ original: original({ runKind: "limited" }) }).service.assess(
      ARTWORK_ID,
    );
    expect(messages(run)).toMatch(/Prints are sold in runs/);
  });

  it("is a 404 for an artwork that does not exist", async () => {
    await expect(setup({ original: null }).service.assess(ARTWORK_ID)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("OriginalMoveService.assessRegister", () => {
  it("says a record with no lax.art listing can go straight to a draft lot", async () => {
    const result = await setup({ original: null, entry: heldEntry() }).service.assessRegister(
      REGISTER_ID,
    );
    expect(result).toMatchObject({
      registerId: REGISTER_ID,
      artworkId: null,
      title: "Tidal margin IV",
      onLaxArt: false,
      laxArtDraft: false,
      eligible: true,
      blockers: [],
    });
  });

  it("notes a lax.art draft, which stays a draft and does not block", async () => {
    const result = await setup({
      original: original({ onLaxArt: false }),
      entry: heldEntry(),
    }).service.assessRegister(REGISTER_ID);
    expect(result).toMatchObject({ eligible: true, laxArtDraft: true, onLaxArt: false });
  });

  it("names the reason for each place or state that refuses it", async () => {
    const cases: Array<[Partial<ArtworkRegisterEntry>, RegExp]> = [
      [{ kind: "print" }, /Prints are sold in runs/],
      [{ catalogueStatus: "Reserved" }, /reserved/],
      [{ catalogueStatus: "Sold" }, /sold in the gallery/],
      [{ offer: { state: "sold", ref: { kind: "bid_lot", id: LOT_ID } } }, /has been sold/],
      [{ offer: { state: "bid_sale", ref: { kind: "bid_lot", id: LOT_ID } } }, /LAX Bid sale/],
      [
        { offer: { state: "private_sale", ref: { kind: "private_sale", id: "p1" } } },
        /private sale/,
      ],
    ];
    for (const [over, expected] of cases) {
      const result = await setup({ original: null, entry: heldEntry(over) }).service.assessRegister(
        REGISTER_ID,
      );
      expect(result.eligible).toBe(false);
      expect(messages(result)).toMatch(expected);
    }
  });

  it("shows the draft lot LAX Bid already holds, and carries on when LAX Bid cannot answer", async () => {
    const lot = { lotId: LOT_ID, saleId: SALE_ID, saleTitle: "Winter sale" };
    const withLot = await setup({
      original: null,
      entry: heldEntry(),
      findDraftLot: async () => lot,
    }).service.assessRegister(REGISTER_ID);
    expect(withLot.draftLot).toEqual({ lotId: LOT_ID, saleTitle: "Winter sale" });

    const unreachable = await setup({
      original: null,
      entry: heldEntry(),
      findDraftLot: async () => {
        throw new InventoryPeerUnavailableError("network");
      },
    }).service.assessRegister(REGISTER_ID);
    expect(unreachable).toMatchObject({ draftLot: null, eligible: true });
  });

  it("is a 404 for a record that does not exist", async () => {
    await expect(
      setup({ original: null, entry: null }).service.assessRegister(REGISTER_ID),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("OriginalMoveService.listSales", () => {
  it("lists the sales that can take a lot", async () => {
    expect(await setup().service.listSales()).toEqual({
      connected: true,
      sales: [{ id: SALE_ID, title: "Winter sale", startsAt: "2026-12-01T10:00:00.000Z" }],
    });
  });

  it("says so when LAX Bid is not set up here, instead of failing", async () => {
    const { service } = setup({
      listSales: async () => {
        throw new InventoryPeerRefusedError(
          { error: "not_configured", message: BID_NOT_CONNECTED_MESSAGE },
          503,
        );
      },
    });
    expect(await service.listSales()).toEqual({ connected: false, sales: [] });
  });
});

describe("OriginalMoveService.offerAtAuction", () => {
  it("makes the draft lot first, then takes the listing down, then records who confirmed", async () => {
    const { service, createDraftLot, withdrawFromLaxArt, recordMoveConfirmed } = setup();
    const order: string[] = [];
    createDraftLot.mockImplementation(async () => {
      order.push("lot");
      return { lotId: LOT_ID, saleId: SALE_ID, created: true };
    });
    withdrawFromLaxArt.mockImplementation(async () => {
      order.push("withdraw");
    });
    recordMoveConfirmed.mockImplementation(async () => {
      order.push("record");
      return { status: "recorded" };
    });
    expect(await service.offerAtAuction(command)).toEqual({
      lotId: LOT_ID,
      saleId: SALE_ID,
      saleTitle: "Winter sale",
      withdrawnFromLaxArt: true,
      created: true,
    });
    expect(order).toEqual(["lot", "withdraw", "record"]);
    expect(createDraftLot).toHaveBeenCalledWith(
      expect.objectContaining({
        registerId: REGISTER_ID,
        saleId: SALE_ID,
        startingPrice: "250.00",
        actor: "staff:user-1",
        content: expect.objectContaining({
          title: "Blue room",
          artistName: "A. Artist",
          year: 2021,
          description: "A quiet interior.",
          imageUrls: ["https://media.example/k1.jpg", "https://media.example/k2.jpg"],
        }),
      }),
    );
    expect(withdrawFromLaxArt).toHaveBeenCalledWith({
      artworkId: ARTWORK_ID,
      actorSubjectId: "user-1",
    });
    expect(recordMoveConfirmed).toHaveBeenCalledWith({
      registerId: REGISTER_ID,
      actor: "staff:user-1",
      record: {
        direction: "to_auction",
        saleId: SALE_ID,
        saleTitle: "Winter sale",
        lotId: LOT_ID,
        withdrawnFromLaxArt: true,
        consignorAgreed: true,
        confirmedBy: "staff:user-1",
      },
      now: NOW,
    });
  });

  it("leaves an original that is not on lax.art alone", async () => {
    const { service, withdrawFromLaxArt } = setup({
      original: original({ onLaxArt: false }),
      entry: heldEntry(),
    });
    expect(await service.offerAtAuction(command)).toMatchObject({ withdrawnFromLaxArt: false });
    expect(withdrawFromLaxArt).not.toHaveBeenCalled();
  });

  it("changes nothing when the original cannot move", async () => {
    const { service, createDraftLot, withdrawFromLaxArt } = setup({
      original: original({ markedSold: true }),
    });
    await expect(service.offerAtAuction(command)).rejects.toBeInstanceOf(ShopDomainError);
    expect(createDraftLot).not.toHaveBeenCalled();
    expect(withdrawFromLaxArt).not.toHaveBeenCalled();
  });

  it("refuses an artwork with no register record", async () => {
    const { service, createDraftLot } = setup({ entry: null });
    await expect(service.offerAtAuction(command)).rejects.toThrow(/not in the artwork register/);
    expect(createDraftLot).not.toHaveBeenCalled();
  });

  it("refuses a sale that is no longer offered", async () => {
    const { service, createDraftLot } = setup({ sales: [] });
    await expect(service.offerAtAuction(command)).rejects.toThrow(/no longer open/);
    expect(createDraftLot).not.toHaveBeenCalled();
  });

  it("keeps the listing up when LAX Bid cannot be reached, so staff just try again", async () => {
    const { service, withdrawFromLaxArt } = setup({
      createDraftLot: async () => {
        throw new InventoryPeerUnavailableError("network");
      },
    });
    const error = await service.offerAtAuction(command).catch((e) => e);
    expect(error).toBeInstanceOf(ShopApiError);
    expect(error.statusCode).toBe(502);
    expect(error.message).toMatch(/Try again/);
    expect(withdrawFromLaxArt).not.toHaveBeenCalled();
  });

  it("passes on LAX Bid's reason when it refuses, and keeps the listing up", async () => {
    const { service, withdrawFromLaxArt } = setup({
      createDraftLot: async () => {
        throw new InventoryPeerRefusedError(
          { error: "already_drafted", message: "This artwork already has a lot in another sale." },
          409,
        );
      },
    });
    await expect(service.offerAtAuction(command)).rejects.toThrow(/another sale/);
    expect(withdrawFromLaxArt).not.toHaveBeenCalled();
  });

  it("says the lot is ready when taking the listing down fails, and reuses the lot on retry", async () => {
    let fail = true;
    const { service, createDraftLot, withdrawFromLaxArt } = setup({
      withdraw: async () => {
        if (fail) throw new Error("db down");
      },
    });
    const first = await service.offerAtAuction(command).catch((e) => e);
    expect(first).toBeInstanceOf(ShopApiError);
    expect(first.message).toMatch(/draft lot is ready in Winter sale/);
    fail = false;
    createDraftLot.mockResolvedValueOnce({ lotId: LOT_ID, saleId: SALE_ID, created: false });
    expect(await service.offerAtAuction(command)).toMatchObject({ lotId: LOT_ID, created: false });
    expect(withdrawFromLaxArt).toHaveBeenCalledTimes(2);
  });
});

describe("OriginalMoveService.offerRegisterAtAuction", () => {
  const fromZoho = () => setup({ original: null, entry: heldEntry() });

  it("makes a draft lot from Zoho's details, with nothing on lax.art to take down", async () => {
    const { service, createDraftLot, withdrawFromLaxArt, recordMoveConfirmed } = fromZoho();
    expect(await service.offerRegisterAtAuction(registerCommand)).toEqual({
      lotId: LOT_ID,
      saleId: SALE_ID,
      saleTitle: "Winter sale",
      withdrawnFromLaxArt: false,
      created: true,
    });
    expect(createDraftLot).toHaveBeenCalledWith({
      registerId: REGISTER_ID,
      saleId: SALE_ID,
      startingPrice: "250.00",
      actor: "staff:user-1",
      content: {
        title: "Tidal margin IV",
        artistName: "Zoho Artist",
        medium: "Gouache",
        dimensions: "40 x 30 cm",
        year: 2024,
        description: null,
        provenance: null,
        imageUrls: ["https://media.example/z1.jpg", "https://media.example/z2.jpg"],
      },
    });
    expect(withdrawFromLaxArt).not.toHaveBeenCalled();
    expect(recordMoveConfirmed).toHaveBeenCalledWith(
      expect.objectContaining({
        registerId: REGISTER_ID,
        actor: "staff:user-1",
        record: expect.objectContaining({
          direction: "to_auction",
          lotId: LOT_ID,
          consignorAgreed: true,
          confirmedBy: "staff:user-1",
        }),
      }),
    );
  });

  it("takes a lax.art draft's description and provenance, and leaves the draft a draft", async () => {
    const { service, createDraftLot, withdrawFromLaxArt } = setup({
      original: original({ onLaxArt: false }),
      entry: heldEntry(),
    });
    await service.offerRegisterAtAuction(registerCommand);
    expect(createDraftLot).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          description: "A quiet interior.",
          provenance: "The artist",
        }),
      }),
    );
    expect(withdrawFromLaxArt).not.toHaveBeenCalled();
  });

  it("takes a live linked listing down, the same as from the artwork page", async () => {
    const { service, withdrawFromLaxArt } = setup({ entry: entry() });
    expect(await service.offerRegisterAtAuction(registerCommand)).toMatchObject({
      withdrawnFromLaxArt: true,
    });
    expect(withdrawFromLaxArt).toHaveBeenCalledWith({
      artworkId: ARTWORK_ID,
      actorSubjectId: "user-1",
    });
  });

  it("is safe to repeat: a second click or a retry gets the same lot and records it again", async () => {
    const { service, createDraftLot, recordMoveConfirmed } = fromZoho();
    const first = await service.offerRegisterAtAuction(registerCommand);
    createDraftLot.mockResolvedValueOnce({ lotId: LOT_ID, saleId: SALE_ID, created: false });
    recordMoveConfirmed.mockResolvedValueOnce({ status: "already_recorded" });
    const second = await service.offerRegisterAtAuction(registerCommand);
    expect(second).toEqual({ ...first, created: false });
    expect(createDraftLot).toHaveBeenCalledTimes(2);
  });

  it("changes nothing when the artwork cannot be offered, and says why", async () => {
    const cases: Array<[Partial<ArtworkRegisterEntry>, RegExp]> = [
      [{ kind: "print" }, /Prints are sold in runs/],
      [{ catalogueStatus: "Reserved" }, /reserved/],
      [{ offer: { state: "sold", ref: { kind: "bid_lot", id: LOT_ID } } }, /has been sold/],
      [{ offer: { state: "bid_sale", ref: { kind: "bid_lot", id: LOT_ID } } }, /LAX Bid sale/],
    ];
    for (const [over, expected] of cases) {
      const { service, createDraftLot, recordMoveConfirmed } = setup({
        original: null,
        entry: heldEntry(over),
      });
      await expect(service.offerRegisterAtAuction(registerCommand)).rejects.toThrow(expected);
      expect(createDraftLot).not.toHaveBeenCalled();
      expect(recordMoveConfirmed).not.toHaveBeenCalled();
    }
  });

  it("refuses when someone else moved the artwork after the dialog was checked", async () => {
    const stale = setup({
      original: null,
      entry: heldEntry({
        offer: { state: "private_sale", ref: { kind: "private_sale", id: "p" } },
      }),
    });
    await expect(stale.service.offerRegisterAtAuction(registerCommand)).rejects.toThrow(
      /private sale/,
    );
    expect(stale.createDraftLot).not.toHaveBeenCalled();
  });

  it("is a 404 for a record that does not exist", async () => {
    const { service } = setup({ original: null, entry: null });
    await expect(service.offerRegisterAtAuction(registerCommand)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("refuses a sale that is no longer offered, and LAX Bid being down keeps nothing half-done", async () => {
    const closed = setup({ original: null, entry: heldEntry(), sales: [] });
    await expect(closed.service.offerRegisterAtAuction(registerCommand)).rejects.toThrow(
      /no longer open/,
    );
    const down = setup({
      original: null,
      entry: heldEntry(),
      createDraftLot: async () => {
        throw new InventoryPeerUnavailableError("network");
      },
    });
    await expect(down.service.offerRegisterAtAuction(registerCommand)).rejects.toMatchObject({
      statusCode: 502,
    });
    expect(down.recordMoveConfirmed).not.toHaveBeenCalled();
  });
});
