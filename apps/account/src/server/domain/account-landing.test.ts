import { describe, expect, it, vi } from "vitest";
import {
  ACCOUNT_SIGN_IN_HREF,
  type LandingSessionStatus,
  decideAccountLanding,
} from "./account-landing";

const status = (value: LandingSessionStatus) => vi.fn(async () => value);

describe("decideAccountLanding", () => {
  it.each([
    ["unsigned", ACCOUNT_SIGN_IN_HREF],
    ["ok", "/account"],
    ["unavailable", "/account"],
  ] as const)("sends a %s visitor without an error to %s", async (session, to) => {
    await expect(decideAccountLanding(undefined, status(session))).resolves.toEqual({
      kind: "redirect",
      to,
    });
  });

  it("starts sign-in with Home as the place to come back to", () => {
    expect(ACCOUNT_SIGN_IN_HREF).toBe("/api/auth/login?returnTo=/account");
  });

  it("treats a blank error as no error", async () => {
    const read = status("unsigned");
    await expect(decideAccountLanding("  ", read)).resolves.toMatchObject({ kind: "redirect" });
    expect(read).toHaveBeenCalledOnce();
  });

  it.each(["ok", "unsigned"] as const)(
    "shows the notice for a failed sign-in to a %s visitor without reading the session",
    async (session) => {
      const read = status(session);
      const decision = await decideAccountLanding("access_denied", read);
      expect(decision).toMatchObject({ kind: "notice", notice: { title: "Sign-in cancelled" } });
      expect(read).not.toHaveBeenCalled();
    },
  );

  it("gives an unknown reason the generic notice", async () => {
    const decision = await decideAccountLanding("invalid_state", status("unsigned"));
    expect(decision).toMatchObject({ kind: "notice", notice: { tone: "error" } });
  });
});
