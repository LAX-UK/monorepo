import { describe, expect, it, vi } from "vitest";
import type { StaffToolsAnswer } from "../ports/staff-tools-access";
import { createCachedStaffToolsAccess } from "./cached-staff-tools-access";

const A = { subjectId: "11111111-aaaa-4bbb-8ccc-222222222222", idToken: "id-a" };
const B = { subjectId: "33333333-dddd-4eee-8fff-444444444444", idToken: "id-b" };

function setup(answers: StaffToolsAnswer[]) {
  const clock = { now: 1_000 };
  const inner = {
    toolsFor: vi.fn(async () => answers.shift() ?? { status: "unavailable" as const }),
  };
  const cached = createCachedStaffToolsAccess(inner, {
    clock: { nowMs: () => clock.now },
    ttlMs: 60_000,
    failureTtlMs: 15_000,
    maxEntries: 2,
  });
  return { clock, inner, cached };
}

describe("createCachedStaffToolsAccess", () => {
  it("reuses a good answer until its TTL passes, then asks again", async () => {
    const { clock, inner, cached } = setup([
      { status: "ok", tools: ["bid-admin"] },
      { status: "ok", tools: [] },
    ]);

    expect(await cached.toolsFor(A)).toEqual({ status: "ok", tools: ["bid-admin"] });
    clock.now += 59_000;
    expect(await cached.toolsFor(A)).toEqual({ status: "ok", tools: ["bid-admin"] });
    expect(inner.toolsFor).toHaveBeenCalledTimes(1);

    clock.now += 2_000;
    expect(await cached.toolsFor(A)).toEqual({ status: "ok", tools: [] });
    expect(inner.toolsFor).toHaveBeenCalledTimes(2);
  });

  it("keeps people apart", async () => {
    const { inner, cached } = setup([
      { status: "ok", tools: ["bid-admin"] },
      { status: "ok", tools: [] },
    ]);

    await cached.toolsFor(A);
    expect(await cached.toolsFor(B)).toEqual({ status: "ok", tools: [] });
    expect(inner.toolsFor).toHaveBeenCalledTimes(2);
  });

  it("remembers a failure briefly so an outage is not retried on every page", async () => {
    const { clock, inner, cached } = setup([
      { status: "unavailable" },
      { status: "ok", tools: ["bid-admin"] },
    ]);

    expect(await cached.toolsFor(A)).toEqual({ status: "unavailable" });
    clock.now += 14_000;
    expect(await cached.toolsFor(A)).toEqual({ status: "unavailable" });
    expect(inner.toolsFor).toHaveBeenCalledTimes(1);

    clock.now += 2_000;
    expect(await cached.toolsFor(A)).toEqual({ status: "ok", tools: ["bid-admin"] });
  });

  it("drops the oldest entry when full", async () => {
    const C = { subjectId: "55555555-1111-4222-8333-666666666666", idToken: "id-c" };
    const { inner, cached } = setup([
      { status: "ok", tools: [] },
      { status: "ok", tools: [] },
      { status: "ok", tools: [] },
      { status: "ok", tools: [] },
    ]);

    await cached.toolsFor(A);
    await cached.toolsFor(B);
    await cached.toolsFor(C);
    await cached.toolsFor(A);

    expect(inner.toolsFor).toHaveBeenCalledTimes(4);
  });
});
