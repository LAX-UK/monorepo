import { describe, expect, it } from "vitest";
import { buildAuditEventDetail, humanizeKey, summariseAuditEvent } from "./audit-event-detail";

const date = (iso: string) => `D(${iso})`;
const detail = (payload: unknown) => buildAuditEventDetail(payload, date);

describe("humanizeKey", () => {
  it("reads keys as sentences", () => {
    expect(humanizeKey("paymentId")).toBe("Payment ID");
    expect(humanizeKey("reason_code")).toBe("Reason code");
  });
});

describe("buildAuditEventDetail", () => {
  it("diffs before and after objects, keeping only fields that changed", () => {
    const result = detail({
      before: { status: "draft", title: "Vase", estimateCents: 10000 },
      after: { status: "scheduled", title: "Vase", estimateCents: 15000, currency: "GBP" },
    });
    expect(result.changes.map((c) => c.label)).toEqual(["Status", "Estimate", "Currency"]);
    expect(result.changes[0]?.before.text).toBe("draft");
    expect(result.changes[0]?.after.text).toBe("scheduled");
    expect(result.changes[1]?.after.text).toBe("£150.00");
    expect(result.changes[2]?.before.text).toBeNull();
    expect(result.facts).toEqual([]);
  });

  it("pairs previousX and newX fields", () => {
    const result = detail({ previousStatus: "open", newStatus: "closed", disputeId: "d-1" });
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]).toMatchObject({
      label: "Status",
      before: { text: "open" },
      after: { text: "closed" },
    });
    expect(result.facts.map((f) => f.label)).toEqual(["Dispute ID"]);
    expect(result.facts[0]?.copyValue).toBe("d-1");
  });

  it("lists everything else as facts, formatted", () => {
    const result = detail({
      reason: "Lost phone",
      verified: true,
      at: "2026-10-24T09:30:00Z",
      amountCents: 2500,
      currency: "EUR",
      tags: ["a", "b"],
      nested: { note: "x" },
    });
    const byLabel = Object.fromEntries(result.facts.map((f) => [f.label, f.value.text]));
    expect(byLabel.Reason).toBe("Lost phone");
    expect(byLabel.Verified).toBe("Yes");
    expect(byLabel.At).toBe("D(2026-10-24T09:30:00Z)");
    expect(byLabel.Amount).toBe("€25.00");
    expect(byLabel.Tags).toBe("a, b");
    expect(byLabel["Nested · Note"]).toBe("x");
  });

  it("marks redacted values as hidden instead of printing the placeholder", () => {
    const result = detail({ note: "[REDACTED]", reason: "ok" });
    expect(result.facts.find((f) => f.label === "Note")?.value).toEqual({
      text: null,
      hidden: true,
    });
  });

  it("copes with empty and non-object payloads", () => {
    expect(detail({})).toEqual({ changes: [], facts: [] });
    expect(detail(null)).toEqual({ changes: [], facts: [] });
    expect(detail("text").facts[0]?.value.text).toBe("text");
  });
});

describe("summariseAuditEvent", () => {
  it("leads with the first change and counts the rest", () => {
    const result = detail({ before: { a: 1, b: 1 }, after: { a: 2, b: 2 } });
    expect(summariseAuditEvent(result)).toBe("A: 1 → 2 and 1 more");
  });

  it("falls back to the reason, then to nothing", () => {
    expect(summariseAuditEvent(detail({ reason: "Lost phone" }))).toBe("Reason: Lost phone");
    expect(summariseAuditEvent(detail({ foo: "bar" }))).toBe("");
  });
});
