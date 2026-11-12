import type { Database } from "@auction/db";
import type {
  IReofferWorkflowReader,
  ITransactionRunner,
  LotReofferView,
  ReofferLockedLot,
  SellerConsentView,
} from "@auction/persistence/interfaces";
import { LotReofferConflictError } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { ReofferClockService } from "./reoffer-clock.service.js";

const tx = { tag: "tx" } as unknown as Database;
const at = (iso: string) => new Date(iso);

const lot: ReofferLockedLot = {
  id: "lot-1",
  title: "The Winter Study",
  lotNumber: 12,
  status: "ended",
  saleId: "sale-1",
  winnerId: null,
  sellerLegalEntityId: "seller-entity",
  reservePence: null,
  deleted: false,
};

const baseOffer = {
  id: "offer-1",
  lotId: "lot-1",
  buyerDefaultId: "default-1",
  sequence: 1,
  offeredUserId: "bidder-1",
  offeredLegalEntityId: "bidder-entity",
  amountPence: 90_000,
  status: "awaiting_seller",
  offerSentAt: null,
  offerEndsAt: null,
} as LotReofferView;

const baseConsent = {
  id: "consent-1",
  sellerLegalEntityId: "seller-entity",
  status: "requested",
  requestedAt: at("2026-11-02T10:00:00Z"),
  dueAt: at("2026-11-05T17:00:00Z"),
  remindedAt: null,
} as SellerConsentView;

function setup(input: {
  offer?: Partial<LotReofferView>;
  consent?: Partial<SellerConsentView> | null;
  lot?: Partial<ReofferLockedLot> | null;
  now: string;
  latestDefaultId?: string | null;
  payments?: { status: string }[];
  reminded?: boolean;
  changeStatus?: () => Promise<void>;
}) {
  const offer = { ...baseOffer, ...input.offer } as LotReofferView;
  const consent =
    input.consent === null ? null : ({ ...baseConsent, ...input.consent } as SellerConsentView);
  const lockedLot = input.lot === null ? null : { ...lot, ...input.lot };
  const order: string[] = [];
  const workflow = {
    lotIdOfOffer: vi.fn(async () => offer.lotId),
    lockLot: vi.fn(async () => {
      order.push("lot");
      return lockedLot;
    }),
    lockOffer: vi.fn(async () => {
      order.push("offer");
      return offer;
    }),
    paymentStatuses: vi.fn(async () => input.payments ?? []),
    otherOffers: vi.fn(async () => []),
  } as unknown as IReofferWorkflowReader;
  const deps = {
    transactionRunner: {
      runInTransaction: async <T>(fn: (t: never) => Promise<T>) => fn(tx as never),
    } as ITransactionRunner,
    workflow,
    offers: { changeStatus: vi.fn(input.changeStatus ?? (async () => {})) },
    consents: {
      findForReoffer: vi.fn(async () => consent),
      answer: vi.fn(async () => {}),
      markReminded: vi.fn(async () => input.reminded ?? true),
    },
    defaults: {
      latestDefaultId: vi.fn(async () =>
        input.latestDefaultId === undefined ? "default-1" : input.latestDefaultId,
      ),
    },
    events: { record: vi.fn(async () => {}) },
    notices: {
      sellerReminder: vi.fn(async () => 1),
      offerReminder: vi.fn(async () => 1),
      offerEnded: vi.fn(async () => 1),
    },
    now: () => at(input.now),
  };
  return { service: new ReofferClockService(deps), deps, order };
}

const ref = { reofferId: "offer-1", lotId: "lot-1" };

describe("settleSellerRequest", () => {
  it("takes the lot's lock before the offer's, as the API does", async () => {
    const { service, order } = setup({ now: "2026-11-05T17:00:00Z" });
    await service.settleSellerRequest(ref);
    expect(order).toEqual(["lot", "offer"]);
  });

  it("lapses at the deadline by the clock, with no answerer, and records it", async () => {
    const { service, deps } = setup({ now: "2026-11-05T17:00:00Z" });
    expect(await service.settleSellerRequest(ref)).toBe("lapsed");
    expect(deps.consents.answer).toHaveBeenCalledWith(tx, {
      id: "consent-1",
      from: "requested",
      to: "lapsed",
      channel: null,
      answeredByUserId: null,
      answeredAt: at("2026-11-05T17:00:00Z"),
      note: null,
      preferredNext: null,
    });
    expect(deps.offers.changeStatus).toHaveBeenCalledWith(tx, {
      id: "offer-1",
      from: "awaiting_seller",
      to: "seller_lapsed",
      closeReason: "seller_lapsed",
    });
    expect(deps.events.record).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ id: "lot-1" }),
      "lot.seller_consent_lapsed",
      expect.anything(),
    );
    expect(deps.notices.sellerReminder).not.toHaveBeenCalled();
  });

  it("reminds once, claiming the reminder in the step's transaction", async () => {
    const { service, deps } = setup({ now: "2026-11-04T18:00:00Z" });
    expect(await service.settleSellerRequest(ref)).toBe("reminded");
    expect(deps.consents.markReminded).toHaveBeenCalledWith(
      "consent-1",
      at("2026-11-04T18:00:00Z"),
      tx,
    );
    expect(deps.notices.sellerReminder).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ at: at("2026-11-05T17:00:00Z") }),
      "seller-entity",
    );
    expect(deps.consents.answer).not.toHaveBeenCalled();
  });

  it("raises no notice when the reminder was already claimed", async () => {
    const { service, deps } = setup({ now: "2026-11-04T18:00:00Z", reminded: false });
    expect(await service.settleSellerRequest(ref)).toBe("skipped");
    expect(deps.notices.sellerReminder).not.toHaveBeenCalled();
  });

  it("does nothing when the seller answered, the offer moved on, or the lot is gone", async () => {
    for (const setupInput of [
      { consent: { status: "given" as const } },
      { offer: { status: "withdrawn" as const } },
      { lot: { deleted: true } },
    ]) {
      const { service, deps } = setup({ now: "2026-12-01T00:00:00Z", ...setupInput });
      expect(["waiting", "skipped"]).toContain(await service.settleSellerRequest(ref));
      expect(deps.consents.answer).not.toHaveBeenCalled();
      expect(deps.offers.changeStatus).not.toHaveBeenCalled();
    }
  });

  it("drops its own step when someone moved the offer first", async () => {
    const { service } = setup({
      now: "2026-11-05T17:00:00Z",
      changeStatus: async () => {
        throw new LotReofferConflictError();
      },
    });
    expect(await service.settleSellerRequest(ref)).toBe("skipped");
  });

  it("lets any other failure through, so the sweep reports it", async () => {
    const { service } = setup({
      now: "2026-11-05T17:00:00Z",
      changeStatus: async () => {
        throw new Error("connection lost");
      },
    });
    await expect(service.settleSellerRequest(ref)).rejects.toThrow("connection lost");
  });
});

describe("settleOffer", () => {
  const out = {
    offer: {
      status: "offered" as const,
      offerSentAt: at("2026-11-02T10:00:00Z"),
      offerEndsAt: at("2026-11-05T17:00:00Z"),
    },
    consent: { status: "given" as const },
  };

  it("ends the offer at its end time and tells both sides", async () => {
    const { service, deps } = setup({ ...out, now: "2026-11-05T17:00:00Z" });
    expect(await service.settleOffer(ref)).toBe("ended");
    expect(deps.offers.changeStatus).toHaveBeenCalledWith(tx, {
      id: "offer-1",
      from: "offered",
      to: "expired",
      closeReason: "offer_ended",
    });
    expect(deps.events.record).toHaveBeenCalledWith(
      tx,
      expect.anything(),
      "lot.reoffer_expired",
      expect.anything(),
    );
    expect(deps.notices.offerEnded).toHaveBeenCalledWith(tx, expect.anything(), {
      legalEntityId: "seller-entity",
      agreed: true,
    });
  });

  it("never ends an offer before its end time", async () => {
    const { service, deps } = setup({ ...out, now: "2026-11-05T16:59:59Z" });
    expect(await service.settleOffer(ref)).not.toBe("ended");
    expect(deps.offers.changeStatus).not.toHaveBeenCalled();
  });

  it("reminds in the last day while the offer can still be won", async () => {
    const { service, deps } = setup({ ...out, now: "2026-11-04T18:00:00Z" });
    expect(await service.settleOffer(ref)).toBe("reminded");
    expect(deps.notices.offerReminder).toHaveBeenCalledOnce();
    expect(deps.offers.changeStatus).not.toHaveBeenCalled();
  });

  it.each([
    ["a payment is being paid", { payments: [{ status: "authorized" }] }],
    ["a payment is paid", { payments: [{ status: "captured" }] }],
    ["a later default took the lot back", { latestDefaultId: "default-2" }],
    ["the lot has a buyer again", { lot: { winnerId: "someone" } }],
    ["the lot is no longer ended", { lot: { status: "draft" as const } }],
  ])("sends no reminder when %s, because accepting would be refused", async (_name, extra) => {
    const { service, deps } = setup({ ...out, now: "2026-11-04T18:00:00Z", ...extra });
    expect(await service.settleOffer(ref)).toBe("waiting");
    expect(deps.notices.offerReminder).not.toHaveBeenCalled();
  });

  it("does not tell the seller of LAX-owned stock, who never agreed", async () => {
    const { service, deps } = setup({
      ...out,
      consent: { status: "not_needed" },
      now: "2026-11-06T00:00:00Z",
    });
    await service.settleOffer(ref);
    expect(deps.notices.offerEnded).toHaveBeenCalledWith(tx, expect.anything(), {
      legalEntityId: "seller-entity",
      agreed: false,
    });
  });

  it("leaves an accepted, declined or withdrawn offer alone", async () => {
    for (const status of ["accepted", "declined", "expired", "withdrawn"] as const) {
      const { service, deps } = setup({
        ...out,
        offer: { ...out.offer, status },
        now: "2026-12-01T00:00:00Z",
      });
      expect(await service.settleOffer(ref)).toBe("waiting");
      expect(deps.offers.changeStatus).not.toHaveBeenCalled();
      expect(deps.events.record).not.toHaveBeenCalled();
    }
  });
});
