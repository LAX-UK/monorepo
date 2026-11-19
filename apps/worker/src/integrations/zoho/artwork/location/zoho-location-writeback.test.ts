import { listDomainEventTypesForConsumer } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { CrmGatewayError } from "../../../crm/crm-gateway-error.js";
import { EMPTY_REPORT, type ListingSyncReport } from "../listing/zoho-listing-sync.js";
import { ZohoLocationWriteback } from "./zoho-location-writeback.js";

const REGISTER_ID = "11111111-1111-4111-8111-111111111111";
const EVENT = {
  eventType: "artwork_register.location_changed",
  aggregateId: REGISTER_ID,
  payload: { registerId: REGISTER_ID },
};

function writeback(report: ListingSyncReport | Error, mode: "dry_run" | "live" = "live") {
  const sync = {
    sync: vi.fn(async () => {
      if (report instanceof Error) throw report;
      return report;
    }),
  };
  return { sync, writeback: new ZohoLocationWriteback({ sync, mode }) };
}

describe("ZohoLocationWriteback", () => {
  it("is the consumer of artwork_register.location_changed only", () => {
    expect([...listDomainEventTypesForConsumer("zoho_artwork_location")]).toEqual([
      "artwork_register.location_changed",
    ]);
  });

  it("refreshes the artwork the event names and reports the write", async () => {
    const { sync, writeback: subject } = writeback({ ...EMPTY_REPORT, checked: 1, changed: 1 });
    expect(await subject.deliver(EVENT)).toEqual({
      outcome: "success",
      providerReference: "Products:1",
    });
    expect(sync.sync).toHaveBeenCalledWith([REGISTER_ID]);
  });

  it("skips when Zoho already shows the location, in a dry run and for a non-original", async () => {
    expect(
      await writeback({ ...EMPTY_REPORT, checked: 1, unchanged: 1 }).writeback.deliver(EVENT),
    ).toEqual({ outcome: "skipped", reason: "location_already_in_sync" });
    expect(
      await writeback({ ...EMPTY_REPORT, checked: 1, changed: 1 }, "dry_run").writeback.deliver(
        EVENT,
      ),
    ).toEqual({ outcome: "skipped", reason: "dry_run" });
    expect(await writeback(EMPTY_REPORT).writeback.deliver(EVENT)).toEqual({
      outcome: "skipped",
      reason: "not_an_original",
    });
  });

  it("skips other events and events without an artwork, without reading anything", async () => {
    const { sync, writeback: subject } = writeback(EMPTY_REPORT);
    expect(await subject.deliver({ ...EVENT, eventType: "lot.created" })).toEqual({
      outcome: "skipped",
      reason: "event_type_not_handled",
    });
    expect(await subject.deliver({ eventType: EVENT.eventType, payload: {} })).toEqual({
      outcome: "skipped",
      reason: "no_register_entry",
    });
    expect(sync.sync).not.toHaveBeenCalled();
  });

  it("retries a retryable failure and fails a refused one", async () => {
    const failure = (retryable: boolean): ListingSyncReport => ({
      ...EMPTY_REPORT,
      checked: 1,
      failures: [{ registerId: REGISTER_ID, stockCode: "S", code: "X", retryable }],
    });
    expect((await writeback(failure(true)).writeback.deliver(EVENT)).outcome).toBe("retry");
    expect((await writeback(failure(false)).writeback.deliver(EVENT)).outcome).toBe("fatal");
  });

  it("classifies a thrown gateway error", async () => {
    const error = new CrmGatewayError({
      code: "CIRCUIT_OPEN",
      message: "open",
      status: 503,
      retryable: true,
    });
    expect((await writeback(error).writeback.deliver(EVENT)).outcome).toBe("retry");
  });
});
