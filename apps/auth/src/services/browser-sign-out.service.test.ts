import { describe, expect, it, vi } from "vitest";
import { type BrowserSession, BrowserSignOutService } from "./browser-sign-out.service.js";

const current: BrowserSession = { subjectId: "ann", sessionId: "rec" };

function setup(earlier: string[] = ["old-1", "old-2"]) {
  const calls: string[] = [];
  const store = {
    earlierNames: vi.fn(async () => earlier),
    deleteTokensIssuedUnder: vi.fn(async () => {
      calls.push("tokens");
      return 1;
    }),
  };
  const logout = {
    revokeIdentitySessions: vi.fn(async () => {
      calls.push("revoke");
      return 1;
    }),
  };
  const announce = vi.fn(async () => {
    calls.push("announce");
  });
  return {
    service: new BrowserSignOutService(store, logout, announce),
    store,
    logout,
    announce,
    calls,
  };
}

describe("BrowserSignOutService", () => {
  it("names the record first, then its earlier ids", async () => {
    await expect(setup().service.namesOf(current)).resolves.toEqual(["rec", "old-1", "old-2"]);
  });

  it("asks for lineage of this person's record only", async () => {
    const { service, store } = setup();
    await service.namesOf(current);
    expect(store.earlierNames).toHaveBeenCalledWith("rec", "ann");
  });

  it("accepts the record's id and its earlier ids, nothing else", async () => {
    const { service } = setup();
    await expect(service.isSignInOf(current, "rec")).resolves.toBe(true);
    await expect(service.isSignInOf(current, "old-2")).resolves.toBe(true);
    await expect(service.isSignInOf(current, "someone-elses")).resolves.toBe(false);
  });

  it("tells the products, ends the record, then deletes only the tokens issued under its ids", async () => {
    const { service, store, logout, announce, calls } = setup();
    const response = new Response("{}", { status: 200 });
    const endRecord = vi.fn(async () => {
      calls.push("record");
      return response;
    });

    await expect(service.end(current, endRecord)).resolves.toBe(response);

    expect(logout.revokeIdentitySessions).toHaveBeenCalledWith(["rec", "old-1", "old-2"]);
    expect(store.deleteTokensIssuedUnder).toHaveBeenCalledWith("ann", ["rec", "old-1", "old-2"]);
    expect(announce.mock.calls).toEqual([
      ["ann", "old-1"],
      ["ann", "old-2"],
    ]);
    // Products first; tokens only once the record is gone.
    expect(calls.slice(0, 3)).toEqual(["revoke", "record", "tokens"]);
  });

  it("deletes no token when the record could not be ended", async () => {
    const { service, store, announce } = setup();
    const failure = new Response("{}", { status: 500 });

    await expect(service.end(current, async () => failure)).resolves.toBe(failure);

    expect(store.deleteTokensIssuedUnder).not.toHaveBeenCalled();
    expect(announce).not.toHaveBeenCalled();
  });

  it("works for a record that nothing took over", async () => {
    const { service, logout, announce } = setup([]);
    await service.end(current, async () => new Response("{}"));
    expect(logout.revokeIdentitySessions).toHaveBeenCalledWith(["rec"]);
    expect(announce).not.toHaveBeenCalled();
  });
});
