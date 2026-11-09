import { describe, expect, it } from "vitest";
import { COLLECT_COPY } from "./collect-copy";
import { collectFailure } from "./collect-errors";

describe("collectFailure", () => {
  it("keeps the person's choices when a time is taken and names the time", () => {
    const failure = collectFailure(
      409,
      { error: "slot_full", message: "Full" },
      "Thu 12 Nov, 14:00 GMT",
    );
    expect(failure).toMatchObject({ kind: "slot_taken", refresh: true });
    if (failure.kind === "slot_taken") expect(failure.message).toContain("Thu 12 Nov, 14:00 GMT");
  });

  it("tells booking and changing apart once the notice has passed", () => {
    expect(collectFailure(409, { error: "notice_passed", message: "x" }, null)).toMatchObject({
      kind: "too_late",
      message: COLLECT_COPY.tooLate.book,
    });
    expect(collectFailure(409, { error: "cutoff_passed", message: "x" }, null)).toMatchObject({
      kind: "too_late",
      message: COLLECT_COPY.tooLate.change,
    });
  });

  it("carries the lot and the reason of a lot that cannot be collected", () => {
    expect(
      collectFailure(
        409,
        { error: "lot_not_collectable", message: "Refunded", lotId: "l1", reason: "refund_open" },
        null,
      ),
    ).toMatchObject({ kind: "lot", lotId: "l1", reason: "refund_open", message: "Refunded" });
  });

  it("points collector issues at their fields", () => {
    const failure = collectFailure(
      422,
      {
        error: "collector_invalid",
        message: "x",
        issues: [{ field: "email", code: "email_invalid", message: "Bad email" }],
      },
      null,
    );
    expect(failure).toMatchObject({
      kind: "collector",
      issues: [{ fieldId: "collect-collector-email", message: "Bad email" }],
    });
  });

  it("shows the email route when online booking is off", () => {
    expect(
      collectFailure(
        409,
        { error: "online_booking_off", message: "off", bookingEmail: "a@b.co" },
        null,
      ),
    ).toMatchObject({ kind: "off", bookingEmail: "a@b.co" });
  });

  it("makes viewing an account read only", () => {
    expect(collectFailure(403, { error: "read_only", message: "no" }, null)).toMatchObject({
      kind: "forbidden",
      viewOnly: true,
    });
  });

  it("handles rate limits and unreadable answers", () => {
    expect(collectFailure(429, null, null).kind).toBe("rate_limited");
    expect(collectFailure(503, "<html>", null).kind).toBe("unavailable");
    expect(collectFailure(400, null, null).kind).toBe("other");
  });
});
