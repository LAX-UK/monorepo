import { describe, expect, it } from "vitest";
import { redactPayload, safeSerializePayload, truncatePayloadJson } from "./redaction.js";

describe("redactPayload", () => {
  it("redacts nested PII keys", () => {
    expect(redactPayload({ user: { email: "a@b.com" }, outboxId: "x" })).toEqual({
      user: { email: "[redacted]" },
      outboxId: "x",
    });
  });

  it("serializes Date values as ISO strings", () => {
    const date = new Date("2026-01-01T00:00:00.000Z");
    expect(redactPayload({ createdAt: date })).toEqual({ createdAt: "2026-01-01T00:00:00.000Z" });
  });

  it("handles Map and Set values", () => {
    expect(redactPayload({ tags: new Set(["a", "b"]) })).toEqual({ tags: ["a", "b"] });
    expect(redactPayload({ meta: new Map([["k", "v"]]) })).toEqual({ meta: { k: "v" } });
  });

  it("marks circular references without throwing", () => {
    const obj: Record<string, unknown> = { id: "1" };
    obj.self = obj;
    expect(redactPayload(obj)).toEqual({ id: "1", self: "[circular]" });
  });
});

describe("safeSerializePayload", () => {
  it("serializes BigInt values", () => {
    expect(safeSerializePayload({ n: 1n })).toBe('{"n":"1"}');
  });

  it("serializes circular payloads with a marker", () => {
    const obj: Record<string, unknown> = { id: "1" };
    obj.self = obj;
    expect(safeSerializePayload(obj)).toBe('{"id":"1","self":"[circular]"}');
  });
});

describe("truncatePayloadJson", () => {
  it("truncates by character count", () => {
    const result = truncatePayloadJson({ text: "x".repeat(20) }, 10);
    expect(result.endsWith("…[truncated]")).toBe(true);
    expect(result.length).toBeLessThan(30);
  });
});
