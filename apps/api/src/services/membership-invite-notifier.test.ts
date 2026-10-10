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
  function makeNotifier() {
    const send = vi.fn().mockResolvedValue(undefined);
    const enqueue = vi.fn().mockResolvedValue({ outboxId: "outbox-1" });
    const mailer: ITransactionalMailer = { send };
    return { n: new EmailMembershipInviteNotifier(mailer, { enqueue }), send, enqueue };
  }

  it("enqueues the shared access-invite template for an existing account", async () => {
    const { n, send, enqueue } = makeNotifier();
    await n.notify({
      kind: "invite_to_existing_user",
      to: "invitee@example.com",
      orgName: "Gallery",
      inviterName: "Alex",
      role: "admin",
      acceptUrl: "https://app/dashboard/invitations/accept/tok",
    });
    expect(send).not.toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalledWith({
      template: "access-invite",
      to: "invitee@example.com",
      category: "transactional",
      vars: {
        scope: "organisation",
        orgName: "Gallery",
        inviterName: "Alex",
        inviteeEmail: "invitee@example.com",
        grants: [{ platform: "Gallery", role: "Admin" }],
        existingAccount: true,
        actionUrl: "https://app/dashboard/invitations/accept/tok",
      },
    });
  });

  it("links new addresses to sign-up", async () => {
    const { n, enqueue } = makeNotifier();
    await n.notify({
      kind: "invite_to_new_user",
      to: "new@example.com",
      orgName: "Gallery",
      inviterName: "Alex",
      role: "viewer",
      signupUrl: "https://app/register?invite=tok",
    });
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        vars: expect.objectContaining({
          existingAccount: false,
          actionUrl: "https://app/register?invite=tok",
        }),
      }),
    );
  });

  it("keeps plain mail for acceptance notices", async () => {
    const { n, send, enqueue } = makeNotifier();
    await n.notify({
      kind: "invite_accepted",
      to: "owner@example.com",
      orgName: "Gallery",
      memberName: "Sam",
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(enqueue).not.toHaveBeenCalled();
  });
});
