import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { integrationSuffix } from "../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../test-support/shop-integration-setup.js";
import { createDrizzleAdminReadRepository } from "./drizzle-admin-read.repository.js";

/*
 * The people lists: clients counted per kind under the search and found by their profile email,
 * staff counted per status under the search, and the audit log narrowed by person, action and
 * day with the person's name. Every list pages both ways without skipping or repeating a row.
 */
describe.skipIf(!hasShopIntegrationDb)("drizzle admin people lists", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await shopPool.end();
    await ownerPool.end();
  });

  const markerOf = (label: string) => integrationSuffix(label).replace(/[^a-z0-9]/gi, "");

  async function profile(subject: string, name: string, email: string) {
    await ownerPool.query(
      `insert into shop_user_profile (identity_subject_id, name, email) values ($1, $2, $3)
       on conflict (identity_subject_id) do update set name = excluded.name, email = excluded.email`,
      [subject, name, email],
    );
  }

  async function pageThrough<T>(
    load: (cursor: string | undefined) => Promise<{ items: T[]; nextCursor: string | null }>,
  ): Promise<T[]> {
    const seen: T[] = [];
    let cursor: string | undefined;
    do {
      const page = await load(cursor);
      seen.push(...page.items);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return seen;
  }

  it("counts clients per kind under the search and finds them by email", async () => {
    const marker = markerOf("clients");
    const ids: string[] = [];
    for (const [index, kind] of (["person", "person", "gallery"] as const).entries()) {
      const subject = `${marker}-client-${index}`;
      await profile(subject, `Client ${index}`, `${marker}.${index}@example.com`);
      const { rows } = await ownerPool.query<{ id: string }>(
        `insert into shop_party (display_name, identity_subject_id, kind, created_at)
         values ($1, $2, $3, '2026-05-01T10:00:00Z') returning id`,
        [`${marker} client ${index}`, subject, kind],
      );
      ids.push(rows[0]?.id ?? "");
    }
    const repo = createDrizzleAdminReadRepository(createShopDb(shopPool));

    const all = await repo.parties.listClientParties({ q: marker });
    expect(all.counts).toEqual({ person: 2, gallery: 1 });
    expect(all.items[0]).toMatchObject({ editionCount: 0, paidOrderCount: 0 });

    const galleries = await repo.parties.listClientParties({ q: marker, kind: "gallery" });
    expect(galleries.items.map((item) => item.partyId)).toEqual([ids[2]]);
    expect(galleries.counts).toEqual({ person: 2, gallery: 1 });

    const byEmail = await repo.parties.listClientParties({ q: `${marker}.1@` });
    expect(byEmail.items.map((item) => item.email)).toEqual([`${marker}.1@example.com`]);

    const byName = await pageThrough((cursor) =>
      repo.parties.listClientParties({
        q: marker,
        sort: "name_desc",
        limit: 1,
        ...(cursor ? { cursor } : {}),
      }),
    );
    expect(byName.map((item) => item.displayName)).toEqual([
      `${marker} client 2`,
      `${marker} client 1`,
      `${marker} client 0`,
    ]);

    for (const sort of ["joined_desc", "joined_asc", "name_asc"] as const) {
      const seen = await pageThrough((cursor) =>
        repo.parties.listClientParties({
          q: marker,
          sort,
          limit: 1,
          ...(cursor ? { cursor } : {}),
        }),
      );
      expect(seen.map((item) => item.partyId).sort()).toEqual([...ids].sort());
    }
  });

  it("counts staff per status and narrows by role", async () => {
    const marker = markerOf("staff");
    const subjects = [0, 1, 2].map((index) => `${marker}-staff-${index}`);
    for (const [index, subject] of subjects.entries()) {
      await profile(subject, `${marker} staff ${index}`, `${marker}.staff${index}@lax.art`);
      await ownerPool.query(
        `insert into shop_staff_member (identity_subject_id, role, disabled_at)
         values ($1, $2, $3)`,
        [subject, index === 2 ? "finance" : "operations", index === 1 ? new Date() : null],
      );
      if (index !== 1) {
        await ownerPool.query(
          `insert into shop_staff_role_assignment (identity_subject_id, role, starts_at)
           values ($1, $2, now() - interval '1 day')`,
          [subject, index === 2 ? "finance" : "operations"],
        );
      }
    }
    // A second role counts in the role filter and is listed with its end date.
    await ownerPool.query(
      `insert into shop_staff_role_assignment (identity_subject_id, role, starts_at, ends_at)
       values ($1, 'editor', now() - interval '1 day', now() + interval '10 days')`,
      [subjects[0]],
    );
    const repo = createDrizzleAdminReadRepository(createShopDb(shopPool));

    const all = await repo.staff.listStaffMembers({ q: marker });
    expect(all.counts).toEqual({ active: 2, disabled: 1 });

    const disabled = await repo.staff.listStaffMembers({ q: marker, status: "disabled" });
    expect(disabled.items.map((item) => item.identitySubjectId)).toEqual([subjects[1]]);

    const finance = await repo.staff.listStaffMembers({ q: marker, role: "finance" });
    expect(finance.items.map((item) => item.identitySubjectId)).toEqual([subjects[2]]);
    expect(finance.counts).toEqual({ active: 1 });

    const editors = await repo.staff.listStaffMembers({ q: marker, role: "editor" });
    expect(editors.items.map((item) => item.identitySubjectId)).toEqual([subjects[0]]);
    expect(editors.items[0]?.roles.map((r) => r.role)).toEqual(["operations", "editor"]);
    expect(editors.items[0]?.roles[1]?.endsAt).toMatch(/Z$/);

    const aToZ = await pageThrough((cursor) =>
      repo.staff.listStaffMembers({ q: marker, limit: 1, ...(cursor ? { cursor } : {}) }),
    );
    expect(aToZ.map((item) => item.identitySubjectId)).toEqual(subjects);

    const seen = await pageThrough((cursor) =>
      repo.staff.listStaffMembers({
        q: marker,
        sort: "added_asc",
        limit: 1,
        ...(cursor ? { cursor } : {}),
      }),
    );
    expect(seen.map((item) => item.identitySubjectId).sort()).toEqual([...subjects].sort());
  });

  it("narrows the audit log by person, action and day, with who did it", async () => {
    const marker = markerOf("audit");
    const actor = `${marker}-actor`;
    await profile(actor, "Sam Lee", `${marker}@lax.art`);
    const events = [
      ["mark_payout_paid", "2026-06-01T09:00:00Z"],
      ["mark_payout_paid", "2026-06-02T09:00:00Z"],
      ["create_hold", "2026-06-02T09:00:00Z"],
    ] as const;
    for (const [action, at] of events) {
      await ownerPool.query(
        `insert into shop_admin_audit
           (actor_subject_id, capability, action, target_type, target_id, after_json, created_at)
         values ($1, 'payout.mark_paid', $2, 'shop_payout_ledger', $3, '{"status":"paid"}', $4)`,
        [actor, action, `${marker}-target`, at],
      );
    }
    const repo = createDrizzleAdminReadRepository(createShopDb(shopPool));

    const mine = await repo.compliance.listAuditEntries({ actor });
    expect(mine.items).toHaveLength(3);
    expect(mine.items[0]).toMatchObject({
      actorName: "Sam Lee",
      actorEmail: `${marker}@lax.art`,
      after: { status: "paid" },
    });

    const paid = await repo.compliance.listAuditEntries({ actor, action: "mark_payout_paid" });
    expect(paid.items).toHaveLength(2);

    const secondDay = await repo.compliance.listAuditEntries({
      actor,
      from: "2026-06-02",
      to: "2026-06-02",
    });
    expect(secondDay.items).toHaveLength(2);

    const oldestFirst = await pageThrough((cursor) =>
      repo.compliance.listAuditEntries({
        actor,
        sort: "at_asc",
        limit: 1,
        ...(cursor ? { cursor } : {}),
      }),
    );
    expect(oldestFirst).toHaveLength(3);
    expect(oldestFirst[0]?.createdAt).toBe("2026-06-01T09:00:00.000Z");

    const facets = await repo.compliance.readAuditFacets();
    expect(facets.actions).toEqual(expect.arrayContaining(["mark_payout_paid", "create_hold"]));
    expect(facets.targetTypes).toEqual(expect.arrayContaining(["shop_payout_ledger"]));
  });
});
