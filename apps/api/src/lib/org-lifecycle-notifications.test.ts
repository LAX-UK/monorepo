import { type IEmailService, emailHash } from "@auction/email";
import { describe, expect, it, vi } from "vitest";
import { enqueueOrgSubmittedAdminNotice } from "./org-lifecycle-notifications.js";

describe("enqueueOrgSubmittedAdminNotice", () => {
  it("keys each admin's notice by the event and a hash of their address, never the address", async () => {
    const enqueue = vi.fn().mockResolvedValue({ outboxId: "o" });
    await enqueueOrgSubmittedAdminNotice({
      emailService: { enqueue } as unknown as IEmailService,
      legalEntityId: "le-1",
      entityDisplayName: "Acme Art",
      adminRecipients: ["ops@lax.bid", "Finance@lax.bid"],
      adminOnboardingUrl: "https://lax.bid/admin/onboarding",
      supportContactEmail: "support@lax.bid",
      eventId: 42,
    });
    const keys = enqueue.mock.calls.map(([email]) => email.idempotencyKey);
    expect(keys).toEqual([
      `legal-entity-submitted-admin:42:${emailHash("ops@lax.bid")}`,
      `legal-entity-submitted-admin:42:${emailHash("finance@lax.bid")}`,
    ]);
    for (const key of keys) expect(key).not.toContain("@");
  });
});
