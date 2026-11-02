import { describe, expect, it, vi } from "vitest";
import type { BidUserContext } from "../services/interfaces/bid-user-context.js";
import {
  STAFF_CONTEXT_TTL_MS,
  ShortLivedStaffContextLoader,
} from "./short-lived-staff-context.loader.js";

const context = (role: BidUserContext["role"]): BidUserContext => ({
  role,
  staffRoles: role === "staff" ? ["client_services"] : [],
  suspendedAt: null,
  identityDisabledAt: null,
  mergedIntoSubjectId: null,
});

function setup(role: BidUserContext["role"]) {
  let time = 1_000;
  const loadContext = vi.fn(async () => context(role));
  const loader = new ShortLivedStaffContextLoader(
    { loadContext },
    STAFF_CONTEXT_TTL_MS,
    () => time,
  );
  return {
    loader,
    loadContext,
    advance: (ms: number) => {
      time += ms;
    },
  };
}

describe("ShortLivedStaffContextLoader", () => {
  it("serves a staff member from memory until the expiry", async () => {
    const { loader, loadContext, advance } = setup("staff");
    await loader.loadContext("s1");
    advance(STAFF_CONTEXT_TTL_MS - 1);
    await loader.loadContext("s1");
    expect(loadContext).toHaveBeenCalledTimes(1);
  });

  it("reads again once the expiry has passed", async () => {
    const { loader, loadContext, advance } = setup("staff");
    await loader.loadContext("s1");
    advance(STAFF_CONTEXT_TTL_MS);
    await loader.loadContext("s1");
    expect(loadContext).toHaveBeenCalledTimes(2);
  });

  it("never caches anyone who is not staff", async () => {
    const { loader, loadContext } = setup("client");
    await loader.loadContext("c1");
    await loader.loadContext("c1");
    expect(loadContext).toHaveBeenCalledTimes(2);
  });

  it("does not cache an unknown person", async () => {
    const loadContext = vi.fn(async () => null);
    const loader = new ShortLivedStaffContextLoader({ loadContext });
    await loader.loadContext("x");
    await loader.loadContext("x");
    expect(loadContext).toHaveBeenCalledTimes(2);
  });

  it("keeps the expiry at 30 seconds or less", () => {
    expect(STAFF_CONTEXT_TTL_MS).toBeLessThanOrEqual(30_000);
  });
});
