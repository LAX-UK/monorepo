import { describe, expect, it } from "vitest";
import { printThenFrame } from "./order-line-order.js";

const at = new Date("2026-11-09T09:00:00.000Z");
const row = (id: string, framingForLineId: string | null = null, createdAt = at) => ({
  id,
  framingForLineId,
  createdAt,
});

describe("printThenFrame", () => {
  it("puts each frame after its print even when it was read first", () => {
    const lines = [row("f2", "p2"), row("f1", "p1"), row("p2"), row("p1")];
    expect(printThenFrame(lines, (line) => line).map((line) => line.id)).toEqual([
      "p1",
      "f1",
      "p2",
      "f2",
    ]);
  });

  it("keeps lines in the order they were made", () => {
    const later = new Date("2026-11-09T09:00:01.000Z");
    const lines = [row("b", null, later), row("a")];
    expect(printThenFrame(lines, (line) => line).map((line) => line.id)).toEqual(["a", "b"]);
  });
});
