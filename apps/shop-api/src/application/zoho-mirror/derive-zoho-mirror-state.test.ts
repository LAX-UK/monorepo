import { describe, expect, it } from "vitest";
import type { MirrorDelivery } from "../ports/zoho-mirror.ports.js";
import { deriveZohoMirrorState } from "./derive-zoho-mirror-state.js";

let nextEvent = 1;
const at = (minutes: number) => new Date(Date.UTC(2026, 10, 14, 16, minutes));

function delivery(
  status: MirrorDelivery["status"],
  extra: Partial<MirrorDelivery> = {},
): MirrorDelivery {
  return {
    eventId: nextEvent++,
    status,
    attempts: 1,
    nextRetryAt: null,
    providerReference: null,
    lastError: null,
    updatedAt: at(nextEvent),
    ...extra,
  };
}
const skipped = (reason: string) => delivery("skipped", { lastError: reason });

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
});
