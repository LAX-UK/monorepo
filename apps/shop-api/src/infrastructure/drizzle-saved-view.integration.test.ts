import { randomUUID } from "node:crypto";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../test-support/shop-integration-setup.js";
import { createDrizzleSavedViewRepository } from "./drizzle-saved-view.repository.js";

describe.skipIf(!hasShopIntegrationDb)("saved view repository", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await shopPool.end();
    await ownerPool.end();
  });

  function setup() {
    const repo = createDrizzleSavedViewRepository(createShopDb(shopPool));
    const owner = `owner-${randomUUID()}`;
    const other = `owner-${randomUUID()}`;
    const listKey = `test.list-${randomUUID()}`;
    const add = (ownerSubjectId: string, label: string, key = listKey, maxPerList = 50) =>
      repo.create({ ownerSubjectId, listKey: key, label, query: `q=${label}`, maxPerList });
    return { repo, owner, other, listKey, add };
  }

  it("lists a person's views in the order they were added", async () => {
    const { repo, owner, listKey, add } = setup();
    await add(owner, "First");
    await add(owner, "Second");

    const views = await repo.list(owner, listKey);

    expect(views.map((view) => [view.label, view.position])).toEqual([
      ["First", 0],
      ["Second", 1],
    ]);
  });

  it("keeps each person's views, and each list's views, apart", async () => {
    const { repo, owner, other, listKey, add } = setup();
    const mine = await add(owner, "Mine");
    await add(other, "Theirs");
    await add(owner, "Elsewhere", `${listKey}-other`);
    if (mine.status !== "created") throw new Error("setup failed");

    expect((await repo.list(owner, listKey)).map((view) => view.label)).toEqual(["Mine"]);
    expect((await repo.list(other, listKey)).map((view) => view.label)).toEqual(["Theirs"]);
    // Another person's id changes nothing.
    expect(await repo.remove(other, mine.view.id)).toBe(false);
    expect((await repo.rename(other, mine.view.id, "Taken")).status).toBe("not_found");
    expect((await repo.reorder(other, listKey, [mine.view.id])).status).toBe("mismatch");
    expect((await repo.list(owner, listKey)).map((view) => view.label)).toEqual(["Mine"]);
  });

  it("refuses a repeated name in one list, but allows it for another person or list", async () => {
    const { owner, other, listKey, add } = setup();
    await add(owner, "Same");

    expect((await add(owner, "Same")).status).toBe("duplicate_label");
    expect((await add(other, "Same")).status).toBe("created");
    expect((await add(owner, "Same", `${listKey}-other`)).status).toBe("created");
  });

  it("stops at the cap for a list", async () => {
    const { owner, add } = setup();
    await add(owner, "One", undefined, 2);
    await add(owner, "Two", undefined, 2);

    expect((await add(owner, "Three", undefined, 2)).status).toBe("limit_reached");
  });

  it("does not let concurrent saves exceed the cap", async () => {
    const { repo, owner, listKey, add } = setup();
    await Promise.all(Array.from({ length: 6 }, (_, n) => add(owner, `View ${n}`, undefined, 3)));

    expect(await repo.list(owner, listKey)).toHaveLength(3);
  });

  it("renames, and refuses a name already in the list", async () => {
    const { repo, owner, add } = setup();
    const a = await add(owner, "A");
    await add(owner, "B");
    if (a.status !== "created") throw new Error("setup failed");

    expect((await repo.rename(owner, a.view.id, "Alpha")).status).toBe("renamed");
    expect((await repo.rename(owner, a.view.id, "B")).status).toBe("duplicate_label");
    expect((await repo.rename(owner, randomUUID(), "Nope")).status).toBe("not_found");
  });

  it("reorders to exactly the ids given and refuses anything else", async () => {
    const { repo, owner, listKey, add } = setup();
    const a = await add(owner, "A");
    const b = await add(owner, "B");
    const c = await add(owner, "C");
    if (a.status !== "created" || b.status !== "created" || c.status !== "created") {
      throw new Error("setup failed");
    }

    const result = await repo.reorder(owner, listKey, [c.view.id, a.view.id, b.view.id]);

    expect(result.status).toBe("reordered");
    expect((await repo.list(owner, listKey)).map((view) => view.label)).toEqual(["C", "A", "B"]);
    expect((await repo.reorder(owner, listKey, [a.view.id])).status).toBe("mismatch");
    expect((await repo.reorder(owner, listKey, [a.view.id, a.view.id, b.view.id])).status).toBe(
      "mismatch",
    );
    expect((await repo.list(owner, listKey)).map((view) => view.label)).toEqual(["C", "A", "B"]);
  });

  it("appends after the last position once a view is deleted", async () => {
    const { repo, owner, listKey, add } = setup();
    await add(owner, "A");
    const b = await add(owner, "B");
    if (b.status !== "created") throw new Error("setup failed");
    await repo.remove(owner, b.view.id);
    await add(owner, "C");

    expect((await repo.list(owner, listKey)).map((view) => view.label)).toEqual(["A", "C"]);
  });
});
