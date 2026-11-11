import { afterEach, describe, expect, it, vi } from "vitest";
import { discardReplacedSession } from "./discard-replaced-session";

afterEach(() => vi.restoreAllMocks());

describe("discardReplacedSession", () => {
  it("removes the replaced session from LAX Account's own store", async () => {
    const sessions = { delete: vi.fn(async () => undefined) };
    await discardReplacedSession({ replacedSessionId: "old", newSessionId: "new", sessions });
    expect(sessions.delete).toHaveBeenCalledWith("old");
  });

  it.each([undefined, "new"])("does nothing when there is nothing to replace (%s)", async (old) => {
    const sessions = { delete: vi.fn(async () => undefined) };
    await discardReplacedSession({ replacedSessionId: old, newSessionId: "new", sessions });
    expect(sessions.delete).not.toHaveBeenCalled();
  });

  it("never fails the sign-in when the store is down", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const sessions = {
      delete: vi.fn(async () => {
        throw new Error("redis down");
      }),
    };
    await expect(
      discardReplacedSession({ replacedSessionId: "old", newSessionId: "new", sessions }),
    ).resolves.toBeUndefined();
  });
});
