import type { ITransactionRunner } from "@auction/persistence/interfaces";
import type { EnquiryIntakeInput } from "@auction/validators";
import { enquiryIntakeSchema } from "@auction/validators";
import { describe, expect, it, vi } from "vitest";
import {
  InMemoryEnquiryRouting,
  InMemoryMarketingEnquiries,
} from "../../testing/in-memory-marketing-enquiries.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import { MarketingEnquiryService } from "./marketing-enquiry.service.js";

const parse = (body: unknown) => enquiryIntakeSchema.parse(body) as EnquiryIntakeInput;

const contact = parse({
  name: "Ada Lovelace",
  email: "ada@example.com",
  topic: "press",
  message: "A question about the next sale.",
  phone: "+44 20 7946 0000",
  sourcePage: "/contact?intent=press",
});

const seller = parse({
  intent: "private_sale_sell",
  name: "Ada Lovelace",
  email: "ada@example.com",
  departmentSlug: "paintings",
  artist: "David Hockney",
  title: "Pool study",
  locationTown: "Bath",
  locationCountry: "United Kingdom",
  priceInMindMinor: 4_800_000,
});

const buyer = parse({
  intent: "private_sale_buy",
  name: "Charlotte Hale",
  email: "charlotte@example.com",
  lookingFor: "Post-war British painting",
  budgetBand: "50000_to_250000",
  timing: "within_3_months",
});

function setup(
  options: {
    alertFails?: boolean;
    rules?: { departmentSlug: string | null; assignedToUserId: string }[];
  } = {},
) {
  const enquiries = new InMemoryMarketingEnquiries();
  const routing = new InMemoryEnquiryRouting();
  routing.rules = options.rules ?? [];
  const publish = vi.fn().mockResolvedValue(undefined);
  const events: IDomainEventSink = { publish, withTx: () => events };
  const transactionRunner = {
    runInTransaction: (fn: (tx: unknown) => Promise<unknown>) => fn({}),
  } as unknown as ITransactionRunner;
  const alert = {
    notify: vi.fn().mockImplementation(async () => {
      if (options.alertFails) throw new Error("outbox down");
    }),
  };
  const onAlertFailed = vi.fn();
  const service = new MarketingEnquiryService({
    enquiries,
    routing,
    transactionRunner,
    events,
    alert,
    onAlertFailed,
  });
  return { service, enquiries, publish, alert, onAlertFailed };
}

describe("MarketingEnquiryService.submit", () => {
  it("stores the enquiry with a reference and announces it with the intent and id only", async () => {
    const { service, enquiries, publish } = setup();

    const { id, reference } = await service.submit(contact);

    expect(reference).toBe("E-1001");
    expect(enquiries.rows).toHaveLength(1);
    expect(enquiries.rows[0]).toMatchObject({ id, status: "new", name: "Ada Lovelace" });
    expect(publish).toHaveBeenCalledTimes(1);
    const event = publish.mock.calls[0]?.[0];
    expect(event).toMatchObject({
      aggregateType: "marketing_enquiry",
      aggregateId: id,
      eventType: "marketing_enquiry.received",
      payload: { enquiryId: id, intent: "press" },
    });
    const serialised = JSON.stringify(publish.mock.calls);
    for (const secret of [contact.name, contact.email, "+44 20 7946 0000", "next sale"]) {
      expect(serialised).not.toContain(secret);
    }
  });

  it("reads the original payload's message tag to tell a private sale from a contact message", async () => {
    const { service, enquiries } = setup();
    await service.submit(
      parse({
        name: "Ada Lovelace",
        email: "ada@example.com",
        topic: "selling",
        message: "Private sale enquiry\n\nA Hockney drawing",
      }),
    );
    expect(enquiries.rows[0]).toMatchObject({ intent: "private_sale_sell", topic: "selling" });
  });

  it("stores a private sale seller's work in typed detail and names the department in the event", async () => {
    const { service, enquiries, publish } = setup();
    await service.submit(seller);

    expect(enquiries.rows[0]).toMatchObject({
      intent: "private_sale_sell",
      departmentSlug: "paintings",
      topic: "selling",
    });
    expect([...enquiries.privateSale.values()][0]).toMatchObject({
      artist: "David Hockney",
      title: "Pool study",
      priceInMindMinor: 4_800_000,
      locationTown: "Bath",
    });
    expect(publish.mock.calls[0]?.[0].payload).toEqual({
      enquiryId: enquiries.rows[0]?.id,
      intent: "private_sale_sell",
      department: "paintings",
    });
    expect(JSON.stringify(publish.mock.calls)).not.toContain("Hockney");
  });

  it("stores a buyer's wish with its budget band and timing", async () => {
    const { service, enquiries } = setup();
    await service.submit(buyer);
    expect(enquiries.rows[0]).toMatchObject({ intent: "private_sale_buy", topic: "buying" });
    expect([...enquiries.privateSale.values()][0]).toMatchObject({
      lookingFor: "Post-war British painting",
      budgetBand: "50000_to_250000",
      timing: "within_3_months",
    });
  });

  it("links the enquiry to the signed-in account and organisation it was sent as", async () => {
    const { service, enquiries } = setup();
    await service.submit(buyer, { userId: "user-1", legalEntityId: "entity-1" });
    expect(enquiries.rows[0]).toMatchObject({ userId: "user-1", legalEntityId: "entity-1" });
  });

  it("records the marketing choice, unticked by default", async () => {
    const { service, enquiries } = setup();
    await service.submit(contact);
    await service.submit(parse({ ...seller, marketingOptIn: true }));
    expect(enquiries.rows.map((r) => r.marketingOptIn)).toEqual([false, true]);
  });

  describe("routing on receipt", () => {
    const rules = [
      { departmentSlug: "paintings", assignedToUserId: "sofia" },
      { departmentSlug: null, assignedToUserId: "tom" },
    ];

    it("assigns the department's specialist and records the assignment", async () => {
      const { service, enquiries, publish } = setup({ rules });
      await service.submit(seller);
      expect(enquiries.rows[0]?.assignedToUserId).toBe("sofia");
      expect(publish.mock.calls.map((call) => call[0].eventType)).toEqual([
        "marketing_enquiry.received",
        "marketing_enquiry.assigned",
      ]);
      expect(publish.mock.calls[1]?.[0].payload).toMatchObject({
        assignedToUserId: "sofia",
        source: "routing",
      });
    });

    it("falls back when the enquiry has no department", async () => {
      const { service, enquiries } = setup({ rules });
      await service.submit(buyer);
      await service.submit(contact);
      expect(enquiries.rows.map((r) => r.assignedToUserId)).toEqual(["tom", "tom"]);
    });

    it("leaves the enquiry unassigned, with no assignment event, when nothing is configured", async () => {
      const { service, enquiries, publish } = setup();
      await service.submit(seller);
      expect(enquiries.rows[0]?.assignedToUserId).toBeNull();
      expect(publish).toHaveBeenCalledTimes(1);
    });
  });

  it("alerts the staff inbox after it is stored", async () => {
    const { service, alert } = setup();
    await service.submit(contact);
    expect(alert.notify).toHaveBeenCalledWith(expect.objectContaining({ email: contact.email }));
  });

  it("keeps the enquiry and reports success when the alert cannot be queued", async () => {
    const { service, enquiries, onAlertFailed } = setup({ alertFails: true });

    const { id } = await service.submit(contact);

    expect(enquiries.rows).toHaveLength(1);
    expect(onAlertFailed).toHaveBeenCalledWith(id, expect.any(Error));
  });
});
