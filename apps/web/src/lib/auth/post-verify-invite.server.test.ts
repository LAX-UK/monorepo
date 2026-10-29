import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let pendingCookie: string | undefined;
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      name === "pending_entity_invite" && pendingCookie
        ? { name, value: pendingCookie }
        : undefined,
  })),
}));

const { pendingInvitationAfterVerify } = await import("./post-verify-invite.server");

describe("pendingInvitationAfterVerify", () => {
  beforeEach(() => {
    pendingCookie = undefined;
  });

  it("sends an invited person to the invitation page, accepting nothing", async () => {
    await expect(pendingInvitationAfterVerify("invite-token-from-link")).resolves.toBe(
      "/organisations/invitations/accept/invite-token-from-link",
    );
  });

  it("falls back to the invitation remembered at signup", async () => {
    pendingCookie = "invite-token-from-signup";
    await expect(pendingInvitationAfterVerify(null)).resolves.toBe(
      "/organisations/invitations/accept/invite-token-from-signup",
    );
  });

  it("goes nowhere special without an invitation", async () => {
    await expect(pendingInvitationAfterVerify("short")).resolves.toBeNull();
  });
});
