import type { Mock } from "vitest";
import { vi } from "vitest";
import type { IDomainEventSink } from "../services/domain-event-sink.js";

/** Minimal IDomainEventSink stub for unit tests (withTx delegates to publish). */
export function mockDomainEventSink(
  publish: Mock = vi.fn().mockResolvedValue(undefined),
): IDomainEventSink {
  return {
    publish,
    withTx: vi.fn().mockReturnValue({ publish }),
  };
}
