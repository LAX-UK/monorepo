import type { MarketingEnquiryRecord } from "@auction/persistence/interfaces";
import { enquiryIntakeSchema } from "@auction/validators";
import { describe, expect, it, vi } from "vitest";
import { EmailEnquiryAcknowledgement } from "./email-enquiry-acknowledgement.js";
import { summariseForAcknowledgement } from "./enquiry-acknowledgement.js";

const person = { name: "Daniel Price", email: "daniel.price@example.com" };

describe("summariseForAcknowledgement", () => {
  it("names a seller's department and work, and counts the photos that arrived", () => {
    const input = enquiryIntakeSchema.parse({
      ...person,
      intent: "private_sale_sell",
      departmentSlug: "digital-art",
      artist: "Iris Calder",
      title: "Low tide at Maldon",
      locationTown: "London",
      locationCountry: "UK",
      priceInMindMinor: 4_500_000,
    });
    expect(summariseForAcknowledgement(input, { images: 2, documents: 1 })).toEqual({
      kind: "sell",
      departmentLabel: "Digital art",
      work: "Iris Calder, Low tide at Maldon",
      photoCount: 2,
    });
  });

  it("says nothing about a buyer beyond the path", () => {
    const input = enquiryIntakeSchema.parse({
      ...person,
      intent: "private_sale_buy",
      lookingFor: "A mid-century British landscape",
      budgetBand: "10000_to_50000",
      timing: "no_rush",
    });
    expect(summariseForAcknowledgement(input, { images: 0, documents: 0 })).toEqual({
      kind: "buy",
      photoCount: 0,
    });
  });

  it("names the topic of a contact form message", () => {
    const input = enquiryIntakeSchema.parse({
      ...person,
      topic: "press",
      message: "A question about the next sale.",
    });
    expect(summariseForAcknowledgement(input, { images: 0, documents: 0 })).toEqual({
      kind: "general",
      topicLabel: "Press",
      photoCount: 0,
    });
  });
});

describe("EmailEnquiryAcknowledgement", () => {
  const record = {
    id: "3f2a9c1e-7b4d-4e0a-9d1f-000000000001",
    reference: "E-1042",
    name: "Daniel Price",
    email: "daniel.price@example.com",
    createdAt: new Date("2026-11-02T10:30:00Z"),
  } as MarketingEnquiryRecord;

  it("queues one email keyed on the enquiry, with the reply date from the business-day calendar", async () => {
    const enqueue = vi.fn().mockResolvedValue({ outboxId: "o1" });
    const ack = new EmailEnquiryAcknowledgement({
      email: { enqueue },
      webOrigin: "https://lax.bid/",
      contactEmail: "info@lax.bid",
    });
    await ack.send(record, { kind: "sell", departmentLabel: "Paintings", photoCount: 2 });
    expect(enqueue).toHaveBeenCalledWith({
      template: "bid-enquiry-received",
      to: "daniel.price@example.com",
      category: "transactional",
      idempotencyKey: "bid-enquiry-received:3f2a9c1e-7b4d-4e0a-9d1f-000000000001",
      vars: {
        reference: "E-1042",
        recipientName: "Daniel Price",
        kind: "sell",
        departmentLabel: "Paintings",
        photoCount: 2,
        replyBy: "2026-11-04T10:30:00.000Z",
        privacyUrl: "https://lax.bid/privacy",
        contactEmail: "info@lax.bid",
      },
    });
  });

  it("does not carry a price or any address of a photo", async () => {
    const enqueue = vi.fn().mockResolvedValue({ outboxId: "o1" });
    await new EmailEnquiryAcknowledgement({
      email: { enqueue },
      webOrigin: "https://lax.bid",
      contactEmail: "info@lax.bid",
    }).send(record, { kind: "sell", work: "Iris Calder, Low tide", photoCount: 3 });
    const sent = JSON.stringify(enqueue.mock.calls);
    expect(sent).not.toMatch(/priceInMind|£|upload|\.(jpe?g|png|webp)/i);
  });
});
