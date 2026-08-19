import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const drizzle = resolve(import.meta.dirname, "../drizzle");

describe("migration 0152 contract", () => {
  it("moves SSF checkpoints to the identity outbox id space without source-id collisions", async () => {
    const [forward, rollback] = await Promise.all([
      readFile(resolve(drizzle, "0152_ssf_reset_outbox_checkpoint.sql"), "utf8"),
      readFile(resolve(drizzle, "0152_rollback.sql"), "utf8"),
    ]);

    expect(forward).toMatch(
      /DELETE FROM public\.ssf_delivery\s+WHERE status IN \('delivered', 'failed'\)/,
    );
    expect(forward).toMatch(
      /UPDATE public\.ssf_delivery\s+SET source_event_id = NULL\s+WHERE source_event_id IS NOT NULL/,
    );
    expect(forward).toMatch(
      /UPDATE public\.ssf_stream[\s\S]*last_mapped_event_id[\s\S]*FROM public\.identity_lifecycle_outbox/,
    );
    expect(rollback).toMatch(
      /UPDATE public\.ssf_stream[\s\S]*last_mapped_event_id[\s\S]*FROM public\.domain_events/,
    );
  });
});
