import { type AdminZohoMirrorStatus, ZOHO_MIRROR_SEPARATOR } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import { ZOHO_RECORD_ID_LABEL, presentZohoMirror } from "./zoho-mirror.vm";

const ORDER_ID = "0f0e0d0c-0b0a-4908-8706-050403020100";
const NOW = new Date("2026-11-14T15:30:00.000Z");
const FAILED_JOBS = "https://bid-admin.example.test/admin/failed-jobs";

function status(over: Partial<AdminZohoMirrorStatus>): AdminZohoMirrorStatus {
  return {
    entity: "order",
    id: ORDER_ID,
    state: "mirrored",
    consumer: "zoho_fulfilment",
    notApplicableReason: null,
    mode: "live",
    lastAttemptAt: "2026-11-14T16:02:00.000Z",
    nextRetryAt: null,
    attempts: 1,
    providerReference: null,
    error: null,
    ...over,
  };
}

/** The whole Z3 line as staff read it: the heading, then the sentence. */
function line(view: { label: string; sentence: string } | null): string {
  if (!view) throw new Error("Expected a badge");
  return `${view.label}${ZOHO_MIRROR_SEPARATOR}${view.sentence}`;
}

describe("presentZohoMirror", () => {
  it("shows Mirrored as Success with a tick, the last send and the dispatch record to copy", () => {
    const view = presentZohoMirror(status({ providerReference: "LAX-S-10482" }), { now: NOW });
    expect(view).toMatchObject({
      state: "mirrored",
      label: "Mirrored to Zoho",
      tone: "success",
      shape: "check",
      name: "Zoho: Mirrored to Zoho, details",
      copy: { value: "LAX-S-10482", label: ZOHO_RECORD_ID_LABEL },
      failedJobsHref: null,
    });
    expect(line(view)).toBe(
      "Mirrored to Zoho · Last sent Sat 14 Nov, 16:02 GMT. Dispatch record LAX-S-10482.",
    );
  });

  it("offers nothing to copy when the send named no Zoho record", () => {
    const view = presentZohoMirror(status({}), { now: NOW });
    expect(view?.copy).toBeNull();
    expect(line(view)).toBe("Mirrored to Zoho · Last sent Sat 14 Nov, 16:02 GMT.");
  });

  it("shows Pending as Info with a dot, the retry time today and the try that is waiting", () => {
    const view = presentZohoMirror(
      status({ state: "pending", nextRetryAt: "2026-11-14T16:10:00.000Z", attempts: 1 }),
      { now: NOW },
    );
    expect(view).toMatchObject({
      label: "Sending to Zoho",
      tone: "info",
      shape: "dot",
      name: "Zoho: Sending to Zoho, details",
      copy: null,
    });
    expect(line(view)).toBe(
      "Sending to Zoho · Waiting to send the latest change. Tries again at 16:10 GMT (attempt 2).",
    );
  });

  it("dates a retry that falls on another London day", () => {
    const view = presentZohoMirror(
      status({ state: "pending", nextRetryAt: "2026-11-15T09:00:00.000Z", attempts: 3 }),
      { now: NOW },
    );
    expect(view?.sentence).toBe(
      "Waiting to send the latest change. Tries again at Sun 15 Nov, 09:00 GMT (attempt 4).",
    );
  });

  it("says only that it is waiting when no retry is booked yet", () => {
    const view = presentZohoMirror(status({ state: "pending", attempts: 0 }), { now: NOW });
    expect(line(view)).toBe("Sending to Zoho · Waiting to send the latest change.");
  });

  it("shows Failed as Danger with the redacted reason and the way to Failed jobs", () => {
    const view = presentZohoMirror(
      status({ state: "failed", error: "Zoho said the SKU is unknown", attempts: 5 }),
      { now: NOW, failedJobsHref: FAILED_JOBS },
    );
    expect(view).toMatchObject({
      label: "Not in Zoho",
      tone: "danger",
      shape: "alert",
      name: "Zoho: Not in Zoho, details",
      failedJobsHref: FAILED_JOBS,
      copy: null,
    });
    expect(line(view)).toBe(
      "Not in Zoho · Zoho refused the last change: Zoho said the SKU is unknown. Staff in Failed jobs can fix and replay it.",
    );
  });

  it("leaves the Failed jobs link out for someone who cannot open Failed jobs", () => {
    const view = presentZohoMirror(status({ state: "failed" }), { now: NOW });
    expect(view?.failedJobsHref).toBeNull();
    expect(line(view)).toBe(
      "Not in Zoho · Zoho refused the last change. Staff in Failed jobs can fix and replay it.",
    );
  });

  it("never links to Failed jobs from a state that did not fail", () => {
    for (const state of ["mirrored", "pending", "dry_run"] as const) {
      expect(
        presentZohoMirror(status({ state }), { now: NOW, failedJobsHref: FAILED_JOBS })
          ?.failedJobsHref,
      ).toBeNull();
    }
  });

  it("shows a dry run as Neutral with a ring", () => {
    const view = presentZohoMirror(status({ state: "dry_run", mode: "dry_run" }), { now: NOW });
    expect(view).toMatchObject({
      label: "Zoho dry run",
      tone: "neutral",
      shape: "ring",
      name: "Zoho: Zoho dry run, details",
    });
    expect(line(view)).toBe(
      "Zoho dry run · LAX worked out what it would send and wrote nothing to Zoho.",
    );
  });

  it("draws no badge for a record that is not mirrored, or when the read failed", () => {
    expect(
      presentZohoMirror(
        status({ state: "not_applicable", notApplicableReason: "not_paid", mode: "off" }),
        { now: NOW, failedJobsHref: FAILED_JOBS },
      ),
    ).toBeNull();
    expect(presentZohoMirror(null)).toBeNull();
  });

  it("gives every badge state a different cue, so grey-scale still tells them apart", () => {
    const shapes = (["mirrored", "pending", "failed", "dry_run"] as const).map(
      (state) => presentZohoMirror(status({ state }), { now: NOW })?.shape,
    );
    expect(new Set(shapes).size).toBe(4);
  });
});
