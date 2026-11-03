import { describe, expect, it, vi } from "vitest";
import type { RelayedIdentityEvent } from "../interfaces/identity-outbox-relay.repository.js";
import { runIdentityOutboxRelayJob } from "./identity-outbox-relay.job.js";
import {
  createSubjectExportRequestRelay,
  subjectExportJobsFrom,
} from "./subject-export-request-relay.js";

const EXPORT = "11111111-1111-4111-8111-111111111111";

function requested(exportId = EXPORT, subjectId = "subject-1"): RelayedIdentityEvent {
  return {
    eventType: "subject.data_export_requested",
    aggregateId: exportId,
    payload: { schemaVersion: 1, subjectId, exportId },
  };
}

describe("mapping the identity outbox event to a job", () => {
  it("turns a request into one assemble job carrying ids only", () => {
    expect(subjectExportJobsFrom([requested()])).toEqual([
      { exportId: EXPORT, subjectId: "subject-1" },
    ]);
  });

  it("maps the same event relayed twice to one job", () => {
    expect(subjectExportJobsFrom([requested(), requested()])).toHaveLength(1);
  });

  it("ignores other events, malformed payloads and an id that disagrees with its aggregate", () => {
    expect(
      subjectExportJobsFrom([
        {
          eventType: "user.registered",
          aggregateId: "u1",
          payload: { schemaVersion: 1, subjectId: "u1" },
        },
        {
          eventType: "subject.data_export_requested",
          aggregateId: EXPORT,
          payload: { exportId: EXPORT },
        },
        { ...requested(), aggregateId: "another-export" },
      ]),
    ).toEqual([]);
  });
});

describe("the relay observer", () => {
  it("queues each job under an id made from the export id, so a repeat is a no-op in the queue", async () => {
    const queue = { add: vi.fn().mockResolvedValue(undefined) };
    const observer = createSubjectExportRequestRelay(queue);
    await observer([requested(), requested()]);
    await observer([requested()]);
    expect(queue.add).toHaveBeenCalledTimes(2);
    for (const [name, data, options] of queue.add.mock.calls) {
      expect(name).toBe("assemble");
      expect(data).toEqual({ exportId: EXPORT, subjectId: "subject-1" });
      expect(options).toEqual({ jobId: `subject-data-export__${EXPORT}` });
    }
  });

  it("fails the batch if the queue is down, so the relay rolls back and tries again", async () => {
    const queue = { add: vi.fn().mockRejectedValue(new Error("redis down")) };
    await expect(createSubjectExportRequestRelay(queue)([requested()])).rejects.toThrow(
      "redis down",
    );
  });

  it("is handed to the relay repository by the relay job", async () => {
    const observer = vi.fn();
    const relayBatch = vi.fn().mockResolvedValue({ relayed: 0, cursor: 0 });
    await runIdentityOutboxRelayJob({
      identityOutboxRelayRepo: { relayBatch },
      log: { debug: vi.fn() } as never,
      observer,
    });
    expect(relayBatch).toHaveBeenCalledWith(observer);
  });
});
