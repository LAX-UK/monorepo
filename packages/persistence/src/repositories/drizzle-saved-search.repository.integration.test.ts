import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { user } from "@auction/db/schema";
import { describe, expect, it } from "vitest";
import { DrizzleSavedSearchRepository } from "./drizzle-saved-search.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

async function setup() {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const repo = new DrizzleSavedSearchRepository(db);
  const person = async () => {
    const id = randomUUID();
    const now = new Date();
    await db.insert(user).values({
      id,
      name: id,
      email: `${id}@integration.test`,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  };
  return { repo, owner: await person(), other: await person() };
}

describe.skipIf(!HAS_DB)("DrizzleSavedSearchRepository.setNotifyEmail (integration)", () => {
  it("changes the owner's own search", async () => {
    const { repo, owner } = await setup();
    const row = await repo.create(owner, {
      label: "Search: oil",
      query: { q: "oil" },
      notifyEmail: true,
    });

    const changed = await repo.setNotifyEmail(owner, row.id, false);

    expect(changed?.notifyEmail).toBe(false);
    expect((await repo.list(owner)).find((r) => r.id === row.id)?.notifyEmail).toBe(false);
  });

  it("changes nothing for another person's id", async () => {
    const { repo, owner, other } = await setup();
    const row = await repo.create(owner, {
      label: "Search: oil",
      query: { q: "oil" },
      notifyEmail: true,
    });

    expect(await repo.setNotifyEmail(other, row.id, false)).toBeNull();

    expect((await repo.list(owner)).find((r) => r.id === row.id)?.notifyEmail).toBe(true);
  });

  it("answers null for an id that does not exist", async () => {
    const { repo, owner } = await setup();
    expect(await repo.setNotifyEmail(owner, randomUUID(), true)).toBeNull();
  });
});
