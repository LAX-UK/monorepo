import type { MarketingEnquiryRecord } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { EmailEnquiryAcknowledgement } from "./email-enquiry-acknowledgement.js";

const enquiry = {
  id: "6f1c2f60-6a0a-4a53-9a2a-1c9f8f0e9a11",
  reference: "E-1042",
  name: "Sam",
  email: "sam@example.test",
  createdAt: new Date("2026-11-15T10:00:00Z"),
} as unknown as MarketingEnquiryRecord;

async function sentVars(replyAddressFor?: (id: string) => string) {
  const enqueue = vi.fn().mockResolvedValue({ outboxId: "o" });
  await new EmailEnquiryAcknowledgement({
    email: { enqueue },
    webOrigin: "https://lax.example.test",
    contactEmail: "hello@lax.example.test",
    replyAddressFor,
  }).send(enquiry, { kind: "general", photoCount: 0 });
  return enqueue.mock.calls[0]?.[0].vars as Record<string, unknown>;
}

describe("enquiry acknowledgement Reply-To", () => {
  it("carries the thread's reply address only when replies by email are on", async () => {
    expect((await sentVars((id) => `replies+${id}@inbound.example.test`)).replyTo).toBe(
      `replies+${enquiry.id}@inbound.example.test`,
    );
    expect("replyTo" in (await sentVars())).toBe(false);
  });
});
