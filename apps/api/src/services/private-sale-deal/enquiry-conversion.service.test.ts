import type { ArtworkRegisterEntry, LockMessage } from "@auction/artwork-register-contracts";
import { resolvePrivateSalePolicy } from "@auction/domain";
import type { DealWork, MarketingEnquiryDetailRecord } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { inlineTransactions, makeDeal, recordingSink } from "./deal-fixtures.test-util.js";
import { DealArtworkRefused, DealRegisterUnavailable } from "./deal-register-lock.js";
import { EnquiryConversionService, isWorkAlreadyInDeal } from "./enquiry-conversion.service.js";

const VIEWER = { userId: "u-specialist", readsPrivateSale: true };

function enquiry(over: Partial<MarketingEnquiryDetailRecord> = {}): MarketingEnquiryDetailRecord {
  return {
    id: "enq-1",
    reference: "E-1042",
    intent: "private_sale_sell",
    topic: "selling",
    name: "Henry Lowe",
    email: "henry@example.com",
    phone: null,
    message: "A landscape",
    sourcePage: null,
    status: "in_progress",
    closeReason: null,
    departmentSlug: "paintings",
    assignedToUserId: "u-specialist",
    userId: "u-henry",
    legalEntityId: null,
    marketingOptIn: false,
    version: 3,
    createdAt: new Date("2026-11-01T10:00:00Z"),
    handledAt: null,
    handledByUserId: null,
    privateSale: {
      artist: "J. Constable",
      title: "Harbour at dusk",
      medium: "Oil on canvas",
      size: "60 x 90 cm",
      locationTown: "Bath",
      locationCountry: "UK",
      priceInMindMinor: null,
      lookingFor: null,
      budgetBand: null,
      timing: null,
      contactPreference: "email",
    },
    attachments: [],
    ...over,
  };
}

function setup(
  record: MarketingEnquiryDetailRecord | null = enquiry(),
  options: {
    partyResolves?: { legalEntityId: string; actingUserId: string } | null;
    work?:
      | (Partial<DealWork> &
          Pick<DealWork, "id" | "reference" | "legalEntityId" | "submittedByUserId" | "title">)
      | null;
    /** What the work's owner resolves to; `undefined` means a client with a place in the account. */
    sellerResolves?: { legalEntityId: string; actingUserId: string } | null;
    openDeal?: boolean;
    /** What the work looks like once it is held, if it changed since the first look. */
    heldAs?: Partial<DealWork> | null;
    /** A deal for the work appears between the first look and the hold. */
    dealAppearsAfterHold?: boolean;
    createError?: unknown;
    moved?: boolean;
    /** What the register holds for the artwork id; `null` means it has none. */
    artwork?: { kind: string } | null;
    /** The register refuses to hold the artwork. */
    offerError?: unknown;
  } = {},
) {
  const events = recordingSink();
  const locked: string[] = [];
  const create = vi.fn(async (input: { itemSubmissionId: string }) => {
    if (options.createError) throw options.createError;
    return makeDeal({ id: "deal-new", reference: "PS-0007", stage: "proposed", ...input } as never);
  });
  const createDraft = vi.fn(async () => ({
    id: "sub-new",
    reference: "C-2000",
    legalEntityId: "le-henry",
    submittedByUserId: "u-henry",
    title: "Harbour at dusk",
    status: "draft",
    convertedLotId: null,
  }));
  const updateInTransaction = vi.fn(async () => (options.moved === false ? null : ({} as never)));
  const offer = vi.fn(async () => {
    if (options.offerError) throw options.offerError;
    return "moved" as const;
  });
  const service = new EnquiryConversionService({
    enquiries: { findByRef: async () => record, updateInTransaction },
    works: {
      createDraftInTransaction: createDraft,
      lockInTransaction: async () => {
        locked.push("locked");
        if (options.heldAs === null) return null;
        return {
          id: options.work?.id ?? "sub-9",
          status: "approved",
          convertedLotId: null,
          ...options.work,
          ...options.heldAs,
        } as DealWork;
      },
      findByReference: async () =>
        options.work ? { status: "approved", convertedLotId: null, ...options.work } : null,
    },
    openDeals: {
      findLiveDealReferenceForWork: async () => {
        if (options.openDeal) return "PS-0003";
        // The first look is before the hold; a deal that appears later is seen only after it.
        return options.dealAppearsAfterHold && locked.length > 0 ? "PS-0004" : null;
      },
    },
    dealsForTx: () => ({ create }),
    artworks: {
      findById: async () =>
        (options.artwork === undefined
          ? { kind: "original" }
          : options.artwork) as ArtworkRegisterEntry | null,
    },
    lockLinks: {
      attach: async (items: readonly { lock: LockMessage }[]) =>
        items.map(({ lock }) => ({
          ...lock,
          link: lock.link ? { ...lock.link, href: "https://admin.test/lot" } : null,
        })),
    },
    registerForTx: () => ({ offer, withdraw: vi.fn(), markSold: vi.fn() }),
    parties: {
      resolve: async (input: { userId: string; legalEntityId?: string }) => {
        if (input.userId === "u-henry") {
          return options.partyResolves === undefined
            ? { legalEntityId: "le-henry", actingUserId: "u-henry" }
            : options.partyResolves;
        }
        return options.sellerResolves === undefined
          ? { legalEntityId: input.legalEntityId ?? "le-x", actingUserId: input.userId }
          : options.sellerResolves;
      },
    } as never,
    policy: resolvePrivateSalePolicy({ commissionRateBps: 1500 }),
    transactionRunner: inlineTransactions,
    events,
  });
  return { service, create, createDraft, updateInTransaction, events, locked, offer };
}

const OWN_WORK = { notInRegister: { reason: "sellers_own_work" } } as const;

describe("EnquiryConversionService", () => {
  it("opens a draft consignment and a proposed deal with the enquirer as seller", async () => {
    const { service, create, createDraft, updateInTransaction, events } = setup();
    const result = await service.convert(VIEWER, "E-1042", OWN_WORK);
    expect(result).toEqual({ ok: true, reference: "PS-0007" });
    expect(createDraft).toHaveBeenCalledWith(expect.anything(), {
      legalEntityId: "le-henry",
      title: "Harbour at dusk",
      description: "Artist: J. Constable\nNow in Bath, UK",
      medium: "Oil on canvas",
      dimensions: "60 x 90 cm",
      submittedByUserId: "u-henry",
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        itemSubmissionId: "sub-new",
        sourceEnquiryId: "enq-1",
        ownerUserId: "u-specialist",
        seller: { legalEntityId: "le-henry", actingUserId: "u-henry" },
        sellerCommissionBps: 1500,
        buyerFeeBps: 0,
        actorUserId: "u-specialist",
      }),
    );
    expect(create.mock.calls[0]?.[0]).not.toHaveProperty("buyer");
    expect(updateInTransaction).toHaveBeenCalledWith(expect.anything(), "enq-1", 3, {
      status: "converted",
    });
    expect(events.events.map((e) => e.eventType)).toEqual([
      "private_sale_deal.created",
      "marketing_enquiry.converted",
    ]);
  });

  it("names the enquirer as buyer on a buy enquiry, and takes the seller from the work", async () => {
    const { service, create, createDraft } = setup(
      enquiry({ intent: "private_sale_buy", privateSale: null }),
      {
        work: {
          id: "sub-9",
          reference: "C-1042",
          legalEntityId: "le-owner",
          submittedByUserId: "u-owner",
          title: "A work",
        },
      },
    );
    const result = await service.convert(VIEWER, "E-1042", {
      workReference: "C-1042",
      ...OWN_WORK,
    });
    expect(result).toEqual({ ok: true, reference: "PS-0007" });
    expect(createDraft).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        itemSubmissionId: "sub-9",
        seller: { legalEntityId: "le-owner", actingUserId: "u-owner" },
        buyer: { legalEntityId: "le-henry", actingUserId: "u-henry" },
      }),
    );
  });

  it("asks for the work on a buy enquiry, and refuses one that does not exist", async () => {
    const buy = enquiry({ intent: "private_sale_buy", privateSale: null });
    expect(await setup(buy).service.convert(VIEWER, "E-1042", OWN_WORK)).toEqual({
      ok: false,
      error: "work_required",
    });
    expect(
      await setup(buy, { work: null }).service.convert(VIEWER, "E-1042", {
        workReference: "C-1",
        ...OWN_WORK,
      }),
    ).toEqual({ ok: false, error: "work_not_found" });
  });

  it("refuses a work with nobody to act for the seller, and a buyer who owns the work", async () => {
    const buy = enquiry({ intent: "private_sale_buy", privateSale: null });
    const work = { id: "s", reference: "C-1", legalEntityId: "le-owner", title: "t" };
    expect(
      await setup(buy, { work: { ...work, submittedByUserId: null } }).service.convert(
        VIEWER,
        "E-1042",
        { workReference: "C-1", ...OWN_WORK },
      ),
    ).toEqual({ ok: false, error: "work_has_no_seller_contact" });
    expect(
      await setup(buy, {
        work: { ...work, legalEntityId: "le-henry", submittedByUserId: "u" },
      }).service.convert(VIEWER, "E-1042", { workReference: "C-1", ...OWN_WORK }),
    ).toEqual({ ok: false, error: "buyer_is_seller" });
  });

  it("needs the enquirer to have an account, because the checks are recorded against one", async () => {
    const guest = setup(enquiry({ userId: null }));
    expect(await guest.service.convert(VIEWER, "E-1042", OWN_WORK)).toEqual({
      ok: false,
      error: "account_required",
    });
    expect(guest.create).not.toHaveBeenCalled();
    const unresolved = setup(enquiry(), { partyResolves: null });
    expect(await unresolved.service.convert(VIEWER, "E-1042", OWN_WORK)).toEqual({
      ok: false,
      error: "account_required",
    });
  });

  it("hides a private sale enquiry from someone who cannot read them", async () => {
    const { service, create } = setup();
    expect(
      await service.convert({ userId: "u-clerk", readsPrivateSale: false }, "E-1042", OWN_WORK),
    ).toEqual({ ok: false, error: "enquiry_not_found" });
    expect(create).not.toHaveBeenCalled();
  });

  it("only converts private sale enquiries", async () => {
    expect(
      await setup(enquiry({ intent: "general", privateSale: null })).service.convert(
        { ...VIEWER },
        "E-1042",
        {},
      ),
    ).toEqual({ ok: false, error: "not_a_private_sale_enquiry" });
  });

  it("does not convert twice, or an enquiry nobody has started on", async () => {
    expect(
      await setup(enquiry({ status: "converted" })).service.convert(VIEWER, "E-1042", OWN_WORK),
    ).toEqual({ ok: false, error: "already_converted" });
    expect(
      await setup(enquiry({ status: "new" })).service.convert(VIEWER, "E-1042", OWN_WORK),
    ).toEqual({
      ok: false,
      error: "not_ready",
    });
    expect(
      await setup(enquiry({ status: "closed" })).service.convert(VIEWER, "E-1042", OWN_WORK),
    ).toEqual({
      ok: false,
      error: "not_ready",
    });
  });

  it("reports an unknown enquiry", async () => {
    expect(await setup(null).service.convert(VIEWER, "E-9999", {})).toEqual({
      ok: false,
      error: "enquiry_not_found",
    });
  });

  it("reports a stale enquiry, and writes nothing else, when it changed while converting", async () => {
    const { service } = setup(enquiry(), { moved: false });
    expect(await service.convert(VIEWER, "E-1042", OWN_WORK)).toEqual({
      ok: false,
      error: "stale_version",
    });
  });

  describe("which works can be sold privately", () => {
    const buy = enquiry({ intent: "private_sale_buy", privateSale: null });
    const work = {
      id: "sub-9",
      reference: "C-1042",
      legalEntityId: "le-owner",
      submittedByUserId: "u-owner",
      title: "A work",
    };
    const convert = (options: Parameters<typeof setup>[1]) =>
      setup(buy, options).service.convert(VIEWER, "E-1042", {
        workReference: "C-1042",
        ...OWN_WORK,
      });

    it.each([
      "draft",
      "submitted",
      "under_review",
      "rejected",
      "withdrawn",
      "changes_requested",
      "converted",
    ])("refuses a work that is %s", async (status) => {
      expect(await convert({ work: { ...work, status } })).toEqual({
        ok: false,
        error: "work_not_available",
      });
    });

    it("refuses a work that has become a lot, live, scheduled or sold", async () => {
      expect(await convert({ work: { ...work, convertedLotId: "lot-1" } })).toEqual({
        ok: false,
        error: "work_not_available",
      });
    });

    it("accepts an approved work that is not on a lot", async () => {
      expect(await convert({ work })).toEqual({ ok: true, reference: "PS-0007" });
    });

    it("refuses a work that is already in a live deal, before anything is written", async () => {
      const { service, create } = setup(buy, { work, openDeal: true });
      expect(
        await service.convert(VIEWER, "E-1042", { workReference: "C-1042", ...OWN_WORK }),
      ).toEqual({
        ok: false,
        error: "work_in_deal",
      });
      expect(create).not.toHaveBeenCalled();
    });

    it("answers work_in_deal when two conversions race and the database refuses the second", async () => {
      const refused = Object.assign(new Error("duplicate key"), {
        code: "23505",
        constraint: "private_sale_deal_one_open_per_work_uidx",
      });
      expect(
        await convert({ work, createError: new Error("wrapped", { cause: refused }) }),
      ).toEqual({
        ok: false,
        error: "work_in_deal",
      });
    });

    it("holds the work before opening the deal, and opens it when nothing changed", async () => {
      const { service, locked } = setup(buy, { work });
      expect(
        await service.convert(VIEWER, "E-1042", { workReference: "C-1042", ...OWN_WORK }),
      ).toEqual({
        ok: true,
        reference: "PS-0007",
      });
      expect(locked).toEqual(["locked"]);
    });

    it.each([
      ["a lot was made from it", { convertedLotId: "lot-1" }],
      ["it stopped being approved", { status: "withdrawn" }],
    ])("refuses, and opens no deal, when %s after the first look", async (_why, heldAs) => {
      const { service, create, updateInTransaction } = setup(buy, { work, heldAs });
      expect(
        await service.convert(VIEWER, "E-1042", { workReference: "C-1042", ...OWN_WORK }),
      ).toEqual({
        ok: false,
        error: "work_not_available",
      });
      expect(create).not.toHaveBeenCalled();
      expect(updateInTransaction).not.toHaveBeenCalled();
    });

    it("refuses when the work is gone once held", async () => {
      const { service, create } = setup(buy, { work, heldAs: null });
      expect(
        await service.convert(VIEWER, "E-1042", { workReference: "C-1042", ...OWN_WORK }),
      ).toEqual({
        ok: false,
        error: "work_not_available",
      });
      expect(create).not.toHaveBeenCalled();
    });

    it("refuses when another deal for the work was opened before the hold was taken", async () => {
      const { service, create } = setup(buy, { work, dealAppearsAfterHold: true });
      expect(
        await service.convert(VIEWER, "E-1042", { workReference: "C-1042", ...OWN_WORK }),
      ).toEqual({
        ok: false,
        error: "work_in_deal",
      });
      expect(create).not.toHaveBeenCalled();
    });

    it("lets any other database failure through rather than hiding it", async () => {
      await expect(convert({ work, createError: new Error("connection lost") })).rejects.toThrow(
        "connection lost",
      );
    });

    it("converts the same work only once: the first wins, the second is refused", async () => {
      let taken = false;
      const run = async () => {
        const { service } = setup(buy, { work, openDeal: taken });
        const result = await service.convert(VIEWER, "E-1042", {
          workReference: "C-1042",
          ...OWN_WORK,
        });
        if (result.ok) taken = true;
        return result;
      };
      expect((await run()).ok).toBe(true);
      expect(await run()).toEqual({ ok: false, error: "work_in_deal" });
    });
  });

  describe("who acts for the seller on a buy deal", () => {
    const buy = enquiry({ intent: "private_sale_buy", privateSale: null });
    const work = {
      id: "sub-9",
      reference: "C-1042",
      legalEntityId: "le-owner",
      submittedByUserId: "u-owner",
      title: "A work",
    };

    it("refuses someone who is staff or has left the owning account", async () => {
      const { service, create } = setup(buy, { work, sellerResolves: null });
      expect(
        await service.convert(VIEWER, "E-1042", { workReference: "C-1042", ...OWN_WORK }),
      ).toEqual({
        ok: false,
        error: "work_has_no_seller_contact",
      });
      expect(create).not.toHaveBeenCalled();
    });
  });
});

describe("EnquiryConversionService and the artwork register", () => {
  const ARTWORK = "5b1c1b9e-3a2f-4f6e-9c1d-2f7a8e9d0c11";

  it("holds the artwork for the deal it opens, in the same transaction", async () => {
    const { service, create, offer } = setup();
    const result = await service.convert(VIEWER, "E-1042", { artworkRegisterId: ARTWORK });
    expect(result).toEqual({ ok: true, reference: "PS-0007" });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ artworkRegisterId: ARTWORK }));
    expect(offer).toHaveBeenCalledWith(ARTWORK, "deal-new", "staff:u-specialist");
  });

  it.each(["sellers_own_work", "in_zoho_not_linked"] as const)(
    "records %s on the deal without touching the register",
    async (reason) => {
      const { service, create, offer } = setup();
      const result = await service.convert(VIEWER, "E-1042", { notInRegister: { reason } });
      expect(result).toEqual({ ok: true, reference: "PS-0007" });
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ artworkUnlinkedReason: reason }),
      );
      expect(create.mock.calls[0]?.[0]).not.toHaveProperty("artworkRegisterId");
      expect(offer).not.toHaveBeenCalled();
    },
  );

  it("does not record a reason when the artwork is linked", async () => {
    const { service, create } = setup();
    await service.convert(VIEWER, "E-1042", { artworkRegisterId: ARTWORK });
    expect(create.mock.calls[0]?.[0]).not.toHaveProperty("artworkUnlinkedReason");
  });

  it.each([
    ["neither", {}],
    ["both", { artworkRegisterId: ARTWORK, ...OWN_WORK }],
  ] as const)("needs the artwork or the reason it is missing, not %s", async (_label, input) => {
    const { service, create, offer } = setup();
    expect(await service.convert(VIEWER, "E-1042", input)).toEqual({
      ok: false,
      error: "artwork_choice_required",
    });
    expect(create).not.toHaveBeenCalled();
    expect(offer).not.toHaveBeenCalled();
  });

  it("refuses with the register's own words when the artwork is offered elsewhere", async () => {
    const lock = {
      reason: "live_on_lax_art",
      message: "This artwork is live on lax.art. Withdraw it there first.",
      link: { label: "Open on lax.art", target: "lax_art_listing" },
    } as const;
    const refused = new DealArtworkRefused(lock);
    const { service, updateInTransaction } = setup(enquiry(), { offerError: refused });
    const result = await service.convert(VIEWER, "E-1042", { artworkRegisterId: ARTWORK });
    expect(result).toEqual({
      ok: false,
      error: "artwork_unavailable",
      message: "This artwork is live on lax.art. Withdraw it there first.",
      // The link carries the address the product is configured with, so staff can open it.
      lock: { ...lock, link: { ...lock.link, href: "https://admin.test/lot" } },
    });
    // The hold is the last write of the transaction, so the enquiry was not left converted by a
    // refusal: the thrown error undoes the whole conversion.
    expect(updateInTransaction).toHaveBeenCalledTimes(1);
  });

  it("asks for a retry when the register was busy", async () => {
    const { service } = setup(enquiry(), {
      offerError: new DealRegisterUnavailable("The artwork register could not record this change."),
    });
    expect(await service.convert(VIEWER, "E-1042", { artworkRegisterId: ARTWORK })).toMatchObject({
      ok: false,
      error: "artwork_register_busy",
    });
  });

  it("reports an artwork the register does not know, and one that is not an original", async () => {
    const missing = setup(enquiry(), { artwork: null });
    expect(await missing.service.convert(VIEWER, "E-1042", { artworkRegisterId: ARTWORK })).toEqual(
      {
        ok: false,
        error: "artwork_not_found",
      },
    );
    const print = setup(enquiry(), { artwork: { kind: "print" } });
    expect(await print.service.convert(VIEWER, "E-1042", { artworkRegisterId: ARTWORK })).toEqual({
      ok: false,
      error: "artwork_not_original",
    });
    expect(missing.create).not.toHaveBeenCalled();
    expect(print.create).not.toHaveBeenCalled();
  });
});

describe("isWorkAlreadyInDeal", () => {
  it("recognises the unique index violation, however deep it is wrapped", () => {
    const error = { code: "23505", constraint: "private_sale_deal_one_open_per_work_uidx" };
    expect(isWorkAlreadyInDeal(error)).toBe(true);
    expect(isWorkAlreadyInDeal({ cause: { cause: error } })).toBe(true);
  });

  it("does not take another unique violation, or another error, for it", () => {
    expect(isWorkAlreadyInDeal({ code: "23505", constraint: "something_else" })).toBe(false);
    expect(isWorkAlreadyInDeal(new Error("boom"))).toBe(false);
    expect(isWorkAlreadyInDeal(null)).toBe(false);
  });
});
