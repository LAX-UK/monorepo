import { ARTWORK_WRITEBACK_SKIP, ORDER_MIRROR_SKIP } from "@auction/types";
import { describe, expect, it } from "vitest";
import type { MirrorDelivery } from "../ports/zoho-mirror.ports.js";
import { deriveZohoMirrorState, namedSkipReasons } from "./derive-zoho-mirror-state.js";

let nextEvent = 1;
const at = (minutes: number) => new Date(Date.UTC(2026, 10, 14, 16, minutes));

function delivery(
  status: MirrorDelivery["status"],
  extra: Partial<MirrorDelivery> = {},
): MirrorDelivery {
  return {
    eventId: nextEvent++,
    eventType: "shop.order.paid",
    status,
    attempts: 1,
    nextRetryAt: null,
    providerReference: null,
    lastError: null,
    updatedAt: at(nextEvent),
    ...extra,
  };
}
const skipped = (reason: string, extra: Partial<MirrorDelivery> = {}) =>
  delivery("skipped", { lastError: reason, ...extra });
const DISPATCHED = { eventType: "shop.fulfilment.status_changed" };
const SWAPPED = { eventType: "shop.print.swapped" };
const STATUS = { eventType: "artwork_register.offer_changed" };
const STOCK_CODE = { eventType: "artwork_register.stock_code_assigned" };

describe("deriveZohoMirrorState", () => {
  it("is not applicable, and says nothing was sent, when the ledger has no delivery", () => {
    expect(deriveZohoMirrorState("order", [])).toMatchObject({
      state: "not_applicable",
      notApplicableReason: "not_sent_yet",
      lastAttemptAt: null,
    });
  });

  it("is mirrored when the newest delivery succeeded, with its time and Zoho reference", () => {
    const sent = delivery("succeeded", { providerReference: "Order:LAX-S-10482", attempts: 2 });
    expect(deriveZohoMirrorState("order", [delivery("succeeded"), sent])).toEqual({
      state: "mirrored",
      notApplicableReason: null,
      mode: "live",
      lastAttemptAt: sent.updatedAt.toISOString(),
      nextRetryAt: null,
      attempts: 2,
      providerReference: "Order:LAX-S-10482",
      error: null,
    });
  });

  it("keeps the reference of the last send that named one when a later skip found nothing to write", () => {
    const state = deriveZohoMirrorState("order", [
      delivery("succeeded", { providerReference: "Order:LAX-S-1" }),
      skipped("order_already_in_sync"),
    ]);
    expect(state).toMatchObject({ state: "mirrored", providerReference: "Order:LAX-S-1" });
  });

  it.each(["pending", "processing", "retryable"] as const)(
    "is pending while a delivery is %s",
    (status) => {
      const waiting = delivery(status, { attempts: 2, nextRetryAt: at(10) });
      expect(deriveZohoMirrorState("order", [waiting])).toMatchObject({
        state: "pending",
        attempts: 2,
        nextRetryAt: at(10).toISOString(),
        error: null,
      });
    },
  );

  it("is failed, with the redacted reason, when a delivery dead-lettered", () => {
    const dead = delivery("dead_lettered", {
      attempts: 5,
      lastError: "Zoho refused: INVALID_DATA",
    });
    expect(deriveZohoMirrorState("order", [dead])).toMatchObject({
      state: "failed",
      attempts: 5,
      error: "Zoho refused: INVALID_DATA",
    });
  });

  it("keeps showing failed while a later delivery for the record is still unfinished", () => {
    const state = deriveZohoMirrorState("order", [
      delivery("dead_lettered", { lastError: "boom" }),
      delivery("pending"),
    ]);
    expect(state).toMatchObject({ state: "failed", error: "boom" });
  });

  it("stops showing failed once a later delivery succeeded", () => {
    expect(
      deriveZohoMirrorState("order", [delivery("dead_lettered"), delivery("succeeded")]).state,
    ).toBe("mirrored");
  });

  it("counts a later skip because Zoho already holds the data as superseding a failure", () => {
    expect(
      deriveZohoMirrorState("order", [delivery("dead_lettered"), skipped("order_already_in_sync")])
        .state,
    ).toBe("mirrored");
  });

  it("counts an order whose prints could not be mirrored as failed, with no error text", () => {
    expect(deriveZohoMirrorState("order", [skipped("order_prints_not_mirrored")])).toMatchObject({
      state: "failed",
      error: null,
    });
  });

  it("is a dry run when the newest delivery was skipped as one", () => {
    expect(
      deriveZohoMirrorState("order", [delivery("succeeded"), skipped("dry_run")]),
    ).toMatchObject({ state: "dry_run", mode: "dry_run", notApplicableReason: null });
  });

  it("is not applicable for an unpaid order", () => {
    expect(deriveZohoMirrorState("order", [skipped("order_not_paid")])).toMatchObject({
      state: "not_applicable",
      notApplicableReason: "not_paid",
    });
  });

  it("is not applicable, mirroring off, when the artwork write-back is off", () => {
    expect(deriveZohoMirrorState("artwork", [skipped("writeback_off")])).toMatchObject({
      state: "not_applicable",
      notApplicableReason: "mirroring_off",
      mode: "off",
    });
  });

  it("is not applicable, nothing to mirror, for any other skip reason", () => {
    expect(deriveZohoMirrorState("order", [skipped("no_prints_on_order")])).toMatchObject({
      state: "not_applicable",
      notApplicableReason: "nothing_to_mirror",
    });
  });

  it("reads skip reasons per consumer: an artwork already in sync is mirrored, an order reason means nothing to it", () => {
    expect(deriveZohoMirrorState("artwork", [skipped("status_already_in_sync")]).state).toBe(
      "mirrored",
    );
    expect(deriveZohoMirrorState("artwork", [skipped("order_prints_not_mirrored")]).state).toBe(
      "not_applicable",
    );
  });

  describe("a failure stands until the same part of the record is put right", () => {
    it("stays failed when a paid order dead-lettered and a later dispatch step succeeded", () => {
      const dead = delivery("dead_lettered", { lastError: "print_order_not_mirrored: LAX-S-1" });
      const state = deriveZohoMirrorState("order", [
        dead,
        delivery("succeeded", { ...DISPATCHED, providerReference: "Order:LAX-S-1" }),
      ]);
      expect(state).toMatchObject({ state: "failed", error: "print_order_not_mirrored: LAX-S-1" });
    });

    it("stays failed when a later step still finds the prints not mirrored and then succeeds", () => {
      expect(
        deriveZohoMirrorState("order", [
          skipped(ORDER_MIRROR_SKIP.printsNotMirrored, DISPATCHED),
          delivery("succeeded", DISPATCHED),
        ]).state,
      ).toBe("failed");
    });

    it("is mirrored once a later event that sets the prints succeeds", () => {
      expect(
        deriveZohoMirrorState("order", [
          delivery("dead_lettered"),
          delivery("succeeded", DISPATCHED),
          delivery("succeeded", SWAPPED),
        ]).state,
      ).toBe("mirrored");
    });

    it("lets any later good delivery of the order put right a failed dispatch step", () => {
      expect(
        deriveZohoMirrorState("order", [
          delivery("dead_lettered", DISPATCHED),
          skipped(ORDER_MIRROR_SKIP.alreadyInSync, DISPATCHED),
        ]).state,
      ).toBe("mirrored");
    });

    it("keeps an artwork's failed stock code failed after its Status was sent", () => {
      const dead = delivery("dead_lettered", { ...STOCK_CODE, lastError: "INVALID_DATA" });
      const later = [dead, delivery("succeeded", STATUS)];
      expect(deriveZohoMirrorState("artwork", later)).toMatchObject({
        state: "failed",
        error: "INVALID_DATA",
      });
      expect(
        deriveZohoMirrorState("artwork", [...later, delivery("succeeded", STOCK_CODE)]).state,
      ).toBe("mirrored");
    });
  });

  it("counts an artwork whose Zoho Status conflicts with LAX as failed", () => {
    expect(
      deriveZohoMirrorState("artwork", [
        skipped(ARTWORK_WRITEBACK_SKIP.statusConflictRaised, STATUS),
      ]),
    ).toMatchObject({ state: "failed", notApplicableReason: null, error: null });
  });

  it("is not applicable, not in the register, when the register entry is gone", () => {
    expect(
      deriveZohoMirrorState("artwork", [
        skipped(ARTWORK_WRITEBACK_SKIP.registerEntryMissing, STATUS),
      ]),
    ).toMatchObject({ state: "not_applicable", notApplicableReason: "not_in_register" });
  });

  describe("the configured mode and the order's payment", () => {
    const off = { mode: "off", paid: true } as const;

    it("says mirroring is off for an order with nothing sent while the fulfilment mirror is off", () => {
      expect(deriveZohoMirrorState("order", [], off)).toMatchObject({
        state: "not_applicable",
        notApplicableReason: "mirroring_off",
        mode: "off",
      });
    });

    it("says mirroring is off rather than sending while a delivery waits on a mirror that is off", () => {
      expect(deriveZohoMirrorState("order", [delivery("pending")], off)).toMatchObject({
        state: "not_applicable",
        notApplicableReason: "mirroring_off",
      });
    });

    it("still shows a failure, and a record already in Zoho, when the mirror is off", () => {
      expect(deriveZohoMirrorState("order", [delivery("dead_lettered")], off).state).toBe("failed");
      expect(deriveZohoMirrorState("order", [delivery("succeeded")], off).state).toBe("mirrored");
    });

    it("says only paid orders are sent for an unpaid order with nothing sent", () => {
      expect(deriveZohoMirrorState("order", [], { mode: "live", paid: false })).toMatchObject({
        state: "not_applicable",
        notApplicableReason: "not_paid",
        mode: "live",
      });
      expect(deriveZohoMirrorState("order", [], { mode: null, paid: true })).toMatchObject({
        notApplicableReason: "not_sent_yet",
      });
    });
  });

  describe("mode", () => {
    it("is unknown for a failure when shop-api is not told the mode, never assumed live", () => {
      expect(deriveZohoMirrorState("order", [delivery("dead_lettered")]).mode).toBeNull();
    });

    it("is the configured mode for a failure, so a dead letter in a dry run says dry run", () => {
      expect(
        deriveZohoMirrorState("order", [delivery("dead_lettered")], { mode: "dry_run", paid: true })
          .mode,
      ).toBe("dry_run");
    });

    it("is live for a mirrored record, which only a live run writes, whatever is configured now", () => {
      expect(
        deriveZohoMirrorState("order", [delivery("succeeded")], { mode: "dry_run", paid: true })
          .mode,
      ).toBe("live");
    });

    it("is the configured mode while a delivery is pending", () => {
      expect(
        deriveZohoMirrorState("order", [delivery("pending")], { mode: "live", paid: true }).mode,
      ).toBe("live");
      expect(deriveZohoMirrorState("order", [delivery("pending")]).mode).toBeNull();
    });
  });

  it("gives a meaning only to skip reasons the worker emits, from the shared constants", () => {
    const emitted = {
      order: Object.values(ORDER_MIRROR_SKIP) as string[],
      artwork: Object.values(ARTWORK_WRITEBACK_SKIP) as string[],
    };
    for (const entity of ["order", "artwork"] as const) {
      const named = namedSkipReasons(entity);
      expect(named.length).toBeGreaterThan(0);
      for (const reason of named) expect(emitted[entity]).toContain(reason);
    }
  });
});
