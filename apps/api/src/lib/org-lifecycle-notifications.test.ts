import type { IEmailService } from "@auction/email";
import { describe, expect, it, vi } from "vitest";
import { enqueueOrgSubmittedAdminNotice } from "./org-lifecycle-notifications.js";

function send() {
  const enqueue = vi.fn().mockResolvedValue({ outboxId: "o" });
  const run = () =>
    enqueueOrgSubmittedAdminNotice({
      emailService: { enqueue } as unknown as IEmailService,
      legalEntityId: "le-1",
      entityDisplayName: "Acme Art",
      adminRecipients: [
        { userId: "u-ops", email: "ops@lax.bid" },
        { userId: "u-fin", email: "finance@lax.bid" },
      ],
      adminOnboardingUrl: "https://lax.bid/admin/onboarding",
      supportContactEmail: "support@lax.bid",
      submissionId: "le-1:2026-11-10T09:00:00.000Z",
    });
  return { enqueue, run };
}

describe("enqueueOrgSubmittedAdminNotice", () => {
  it("sends to each person's account, so the address is read when the email is sent", async () => {
    const s = send();
    await s.run();
    expect(s.enqueue.mock.calls.map(([email]) => [email.userId, email.to])).toEqual([
      ["u-ops", "ops@lax.bid"],
      ["u-fin", "finance@lax.bid"],
    ]);
  });

  it("keys each notice by the submission and the account id, never the address", async () => {
    const s = send();
    await s.run();
    const keys = s.enqueue.mock.calls.map(([email]) => email.idempotencyKey);
    expect(keys).toEqual([
      "legal-entity-submitted-admin:le-1:2026-11-10T09:00:00.000Z:u-ops",
      "legal-entity-submitted-admin:le-1:2026-11-10T09:00:00.000Z:u-fin",
    ]);
  });

  it("gives the same keys when the same submission is sent again", async () => {
    const s = send();
    await s.run();
    await s.run();
    const keys = s.enqueue.mock.calls.map(([email]) => email.idempotencyKey);
    expect(new Set(keys).size).toBe(2);
  });
});
