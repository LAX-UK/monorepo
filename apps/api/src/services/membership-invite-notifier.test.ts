import { describe, expect, it, vi } from "vitest";
import type { ITransactionalMailer } from "./interfaces/transactional-mail.js";
import {
  EmailMembershipInviteNotifier,
  NoOpMembershipInviteNotifier,
} from "./membership-invite-notifier.js";

describe("NoOpMembershipInviteNotifier", () => {
  it("resolves without calling mailer", async () => {
    const n = new NoOpMembershipInviteNotifier();
    await expect(
      n.notify({
        kind: "invite_to_existing_user",
        to: "a@b.com",
        orgName: "Org",
        inviterName: "Pat",
        role: "admin",
        acceptUrl: "https://example/accept",
      }),
    ).resolves.toBeUndefined();
  });
});

describe("EmailMembershipInviteNotifier", () => {
  it("sends invite_to_existing_user with accept URL in body", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const mailer: ITransactionalMailer = { send };
    const n = new EmailMembershipInviteNotifier(mailer);
    await n.notify({
      kind: "invite_to_existing_user",
      to: "invitee@example.com",
      orgName: "Gallery",
      inviterName: "Alex",
      role: "staff",
      acceptUrl: "https://app/dashboard/invitations/accept/tok",
    });
    expect(send).toHaveBeenCalledTimes(1);
    const first = send.mock.calls.at(0);
    expect(first).toBeDefined();
    if (first === undefined) {
      throw new Error("expected one send call");
    }
    const arg = first[0] as { to: string; subject: string; text: string };
    expect(arg.to).toBe("invitee@example.com");
    expect(arg.subject).toContain("Gallery");
    expect(arg.text).toContain("Alex");
    expect(arg.text).toContain("https://app/dashboard/invitations/accept/tok");
  });
});
