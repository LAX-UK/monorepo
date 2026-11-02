import type { ITransactionRunner } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { InMemoryEnquiryRouting } from "../../testing/in-memory-marketing-enquiries.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import { EnquiryRoutingService } from "./enquiry-routing.service.js";

function setup() {
  const routing = new InMemoryEnquiryRouting();
  const publish = vi.fn().mockResolvedValue(undefined);
  const events: IDomainEventSink = { publish, withTx: () => events };
  const service = new EnquiryRoutingService({
    routing,
    assignees: { isStaff: async (id) => ["sofia", "tom", "ben"].includes(id) },
    transactionRunner: {
      runInTransaction: (fn: (tx: unknown) => Promise<unknown>) => fn({}),
    } as unknown as ITransactionRunner,
    events,
  });
  return { service, routing, publish };
}

describe("EnquiryRoutingService", () => {
  it("saves the table and audits each changed row with the person who changed it", async () => {
    const { service, publish } = setup();

    const result = await service.replace("admin-1", [
      { departmentSlug: "paintings", assignedToUserId: "sofia" },
      { departmentSlug: null, assignedToUserId: "tom" },
    ]);

    expect(result).toMatchObject({ ok: true });
    expect(await service.rules()).toHaveLength(2);
    expect(publish.mock.calls.map((call) => call[0])).toEqual([
      expect.objectContaining({
        eventType: "enquiry_routing.changed",
        actorUserId: "admin-1",
        payload: {
          departmentSlug: "paintings",
          assignedToUserId: "sofia",
          previousAssignedToUserId: null,
        },
      }),
      expect.objectContaining({
        eventType: "enquiry_routing.changed",
        payload: { assignedToUserId: "tom", previousAssignedToUserId: null },
      }),
    ]);
  });

  it("audits a reassignment and a removal, and nothing for rows left as they were", async () => {
    const { service, publish } = setup();
    await service.replace("admin-1", [
      { departmentSlug: "paintings", assignedToUserId: "sofia" },
      { departmentSlug: "prints", assignedToUserId: "ben" },
    ]);
    publish.mockClear();

    await service.replace("admin-1", [{ departmentSlug: "paintings", assignedToUserId: "tom" }]);

    expect(publish.mock.calls.map((call) => call[0].payload)).toEqual([
      { departmentSlug: "paintings", assignedToUserId: "tom", previousAssignedToUserId: "sofia" },
      { departmentSlug: "prints", assignedToUserId: null, previousAssignedToUserId: "ben" },
    ]);
    publish.mockClear();
    await service.replace("admin-1", [{ departmentSlug: "paintings", assignedToUserId: "tom" }]);
    expect(publish).not.toHaveBeenCalled();
  });

  it("refuses a specialist who is not staff and saves nothing", async () => {
    const { service, routing, publish } = setup();
    const result = await service.replace("admin-1", [
      { departmentSlug: "paintings", assignedToUserId: "stranger" },
    ]);
    expect(result).toEqual({ ok: false, error: "assignee_invalid", userId: "stranger" });
    expect(routing.rules).toEqual([]);
    expect(publish).not.toHaveBeenCalled();
  });
});
