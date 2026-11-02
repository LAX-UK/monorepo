import type { ITransactionRunner } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { InMemoryMarketingEnquiries } from "../../testing/in-memory-marketing-enquiries.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import { MarketingEnquiryService } from "./marketing-enquiry.service.js";

const input = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  topic: "press" as const,
  message: "A question about the next sale.",
  phone: "+44 20 7946 0000",
  sourcePage: "/contact?intent=press",
};

function setup(alertFails = false) {
  const enquiries = new InMemoryMarketingEnquiries();
  const publish = vi.fn().mockResolvedValue(undefined);
  const events: IDomainEventSink = { publish, withTx: () => events };
  const transactionRunner = {
    runInTransaction: (fn: (tx: unknown) => Promise<unknown>) => fn({}),
  } as unknown as ITransactionRunner;
  const alert = {
    notify: vi.fn().mockImplementation(async () => {
      if (alertFails) throw new Error("outbox down");
    }),
  };
  const onAlertFailed = vi.fn();
  const service = new MarketingEnquiryService({
    enquiries,
    transactionRunner,
    events,
    alert,
    onAlertFailed,
    now: () => new Date("2026-07-27T12:00:00.000Z"),
  });
  return { service, enquiries, publish, alert, onAlertFailed };
}

describe("MarketingEnquiryService.submit", () => {
  it("stores the enquiry and announces it with the topic and id only", async () => {
    const { service, enquiries, publish } = setup();

    const { id } = await service.submit(input);

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
    const serialised = JSON.stringify(event);
    for (const secret of [input.name, input.email, input.phone, input.message]) {
      expect(serialised).not.toContain(secret);
    }
  });

  it("alerts the staff inbox after it is stored", async () => {
    const { service, alert } = setup();
    await service.submit(input);
    expect(alert.notify).toHaveBeenCalledWith(expect.objectContaining({ email: input.email }));
  });

  it("keeps the enquiry and reports success when the alert cannot be queued", async () => {
    const { service, enquiries, onAlertFailed } = setup(true);

    const { id } = await service.submit(input);

    expect(enquiries.rows).toHaveLength(1);
    expect(onAlertFailed).toHaveBeenCalledWith(id, expect.any(Error));
  });
});

describe("MarketingEnquiryService staff desk", () => {
  it("shows an enquiry with the topic label and a reply due two business days on", async () => {
    const { service } = setup();
    const { id } = await service.submit(input);

    const view = await service.detail(id);

    expect(view).toMatchObject({ id, topicLabel: "Press", status: "new", handledAt: null });
    // Received Monday 27 July 2026 10:00; due Wednesday 29 July.
    expect(view?.replyDueAt).toBe("2026-07-29T10:00:00.000Z");
    expect(await service.detail("00000000-0000-4000-8000-000000000000")).toBeNull();
  });

  it("marks a new enquiry handled and records who did it in an audited event", async () => {
    const { service, publish } = setup();
    const { id } = await service.submit(input);
    publish.mockClear();

    const result = await service.markHandled(id, "staff-1");

    expect(result).toMatchObject({ ok: true, enquiry: { status: "handled" } });
    expect(publish).toHaveBeenCalledTimes(1);
    const event = publish.mock.calls[0]?.[0];
    expect(event).toMatchObject({
      aggregateId: id,
      eventType: "marketing_enquiry.handled",
      actorUserId: "staff-1",
      payload: { enquiryId: id, intent: "press" },
    });
    expect(JSON.stringify(event)).not.toContain(input.email);
  });

  it("refuses to handle an enquiry twice, or one that does not exist, without an event", async () => {
    const { service, publish } = setup();
    const { id } = await service.submit(input);
    await service.markHandled(id, "staff-1");
    publish.mockClear();

    expect(await service.markHandled(id, "staff-2")).toEqual({
      ok: false,
      error: "already_handled",
    });
    expect(await service.markHandled("00000000-0000-4000-8000-000000000000", "staff-2")).toEqual({
      ok: false,
      error: "enquiry_not_found",
    });
    expect(publish).not.toHaveBeenCalled();
  });
});
