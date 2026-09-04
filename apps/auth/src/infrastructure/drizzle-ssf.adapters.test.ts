import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import { DrizzleSsfStreamRepository } from "./drizzle-ssf.adapters.js";

function createRepository() {
  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
  const insert = vi.fn().mockReturnValue({ values });
  return {
    repository: new DrizzleSsfStreamRepository({ insert } as never),
    values,
    onConflictDoUpdate,
  };
}

const baseInput = {
  id: "ssf-lax-bid",
  clientId: "lax-bid",
  audience: "lax-bid-api",
  endpoint: "https://api.test/ssf/events",
  enabled: true,
  events: ["account-disabled"],
  checkpoint: 91,
  now: new Date("2026-08-28T20:00:00.000Z"),
};

describe("DrizzleSsfStreamRepository.provision", () => {
  it("seeds an initial registered stream at the current outbox checkpoint", async () => {
    const { repository, values } = createRepository();

    await repository.provision(baseInput);

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        id: baseInput.id,
        status: "enabled",
        lastMappedEventId: 91,
      }),
    );
  });

  it("preserves an enabled stream checkpoint across restart", async () => {
    const { repository, onConflictDoUpdate } = createRepository();

    await repository.provision(baseInput);

    const conflict = onConflictDoUpdate.mock.calls[0]?.[0];
    const query = new PgDialect().sqlToQuery(conflict.set.lastMappedEventId as SQL);
    expect(query.sql).toContain("when");
    expect(query.sql).toContain(`"ssf_stream"."status" = 'disabled'`);
    expect(query.sql).toContain('else "ssf_stream"."last_mapped_event_id"');
    expect(query.params).toEqual([91]);
  });

  it("leaves an existing stream status and checkpoint untouched when provisioning is disabled", async () => {
    const { repository, onConflictDoUpdate } = createRepository();

    await repository.provision({ ...baseInput, enabled: false });

    const conflict = onConflictDoUpdate.mock.calls[0]?.[0];
    expect(conflict.set).not.toHaveProperty("status");
    expect(conflict.set).not.toHaveProperty("lastMappedEventId");
  });
});
