import { describe, expect, it, vi } from "vitest";
import { DomainEventSink } from "./domain-event-sink.js";
import { DomainEventPublisher } from "./domain-event.publisher.js";

const event = {
  aggregateType: "lot",
  aggregateId: "lot-1",
  eventType: "lot.test",
  payload: { a: 1 },
};

function insertSpyConn() {
  const values = vi.fn().mockResolvedValue(undefined);
  const insert = vi.fn().mockReturnValue({ values });
  return { conn: { insert }, insert, values };
}

describe("DomainEventSink", () => {
  it("publishes on the captured root connection", async () => {
    const { conn, values } = insertSpyConn();
    const sink = new DomainEventSink(new DomainEventPublisher(), conn);
    await sink.publish(event);
    expect(values).toHaveBeenCalledTimes(1);
    expect(values.mock.calls[0]?.[0]).toMatchObject({
      aggregateType: "lot",
      aggregateId: "lot-1",
      eventType: "lot.test",
      payload: { a: 1 },
      producer: "apps/api",
      schemaVersion: 1,
    });
  });

  it("withTx rebinds to the transaction connection without touching root", async () => {
    const root = insertSpyConn();
    const tx = insertSpyConn();
    const sink = new DomainEventSink(new DomainEventPublisher(), root.conn);
    await sink.withTx(tx.conn).publish(event);
    expect(tx.values).toHaveBeenCalledTimes(1);
    expect(root.values).not.toHaveBeenCalled();
  });
});
