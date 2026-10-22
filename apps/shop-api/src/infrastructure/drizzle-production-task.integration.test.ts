import { shopAdminAudit } from "@auction/db/schema";
import { canTransitionProductionTask } from "@auction/shop-domain";
import { and, asc, eq } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { decodeCatalogueCursor } from "../application/catalogue-cursor.js";
import type {
  ProductionTaskFilters,
  UpdateProductionTaskInput,
} from "../application/ports/production-task.repository.js";
import {
  createPendingPaymentOrderWithReservedEdition,
  importTestArtwork,
  integrationSuffix,
} from "../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../test-support/shop-integration-setup.js";
import {
  PRODUCTION_TASK_AUDIT_TARGET,
  createDrizzleProductionTaskRepository,
} from "./drizzle-production-task.repository.js";

const ACTOR = "integration-production-actor";

describe.skipIf(!hasShopIntegrationDb)("drizzle production task repository", () => {
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
    const db = createShopDb(shopPool);
    const repo = createDrizzleProductionTaskRepository(db);
    /** In every artwork title of one test, so searching for it isolates that test's tasks. */
    const marker = integrationSuffix("prod").replace(/_/g, "-");
    return { db, repo, marker };
  }

  /** One task on its own paid-style order line, all for the artwork titled with `marker`. */
  async function seedTasks(
    db: ReturnType<typeof createShopDb>,
    marker: string,
    tasks: Array<{
      createdAt: string;
      status?: string;
      assignee?: string | null;
    }>,
  ): Promise<string[]> {
    const artwork = await importTestArtwork(db, marker);
    const ids: string[] = [];
    for (const [index, task] of tasks.entries()) {
      const order = await createPendingPaymentOrderWithReservedEdition(db, {
        artworkId: artwork.artworkId,
        suffix: `${marker}-${index}`,
      });
      // One edition can back only one unreleased line, and these tasks share an artwork.
      await ownerPool.query("update shop_order_line set released_at = now() where order_id = $1", [
        order.orderId,
      ]);
      const { rows } = await ownerPool.query<{ id: string }>(
        `insert into shop_production_task
           (order_line_id, edition_id, status, assigned_to_subject_id, created_at, updated_at)
         select l.id, l.edition_id, $2::shop_production_task_status, $3, $4::timestamptz, $4::timestamptz
         from shop_order_line l where l.order_id = $1
         returning id`,
        [order.orderId, task.status ?? "queued", task.assignee ?? null, task.createdAt],
      );
      ids.push(rows[0]?.id ?? "");
    }
    return ids;
  }

  async function listAll(
    repo: ReturnType<typeof createDrizzleProductionTaskRepository>,
    filters: ProductionTaskFilters,
    limit: number,
  ) {
    const pages: string[][] = [];
    let cursor = null as ReturnType<typeof decodeCatalogueCursor>;
    do {
      const page = await repo.list({ filters, cursor, limit });
      pages.push(page.items.map((item) => item.taskId));
      cursor = page.nextCursor;
    } while (cursor);
    return pages;
  }

  const move = (
    input: Pick<UpdateProductionTaskInput, "id" | "expectedVersion"> &
      Partial<UpdateProductionTaskInput>,
  ): UpdateProductionTaskInput => ({
    actorSubjectId: ACTOR,
    canMove: canTransitionProductionTask,
    ...input,
  });

  describe("list", () => {
    it("pages through tasks created in the same millisecond without repeating or skipping any", async () => {
      const { db, repo, marker } = setup();
      const same = "2026-03-01T10:00:00.123Z";
      const ids = await seedTasks(db, marker, [
        { createdAt: same },
        { createdAt: same },
        { createdAt: same },
        { createdAt: same },
        { createdAt: same },
        { createdAt: "2026-03-01T09:00:00.000Z" },
      ]);

      const pages = await listAll(repo, { q: marker }, 2);

      expect(pages.map((page) => page.length)).toEqual([2, 2, 2]);
      const flat = pages.flat();
      expect(new Set(flat).size).toBe(6);
      expect([...flat].sort()).toEqual([...ids].sort());
      // Newest first, ties broken by id descending; the older task comes last.
      expect(flat.slice(0, 5)).toEqual([...flat.slice(0, 5)].sort().reverse());
      expect(flat[5]).toBe(ids[5]);
    });

    it("keeps paging correctly when a filter is active", async () => {
      const { db, repo, marker } = setup();
      const same = "2026-03-02T10:00:00.000Z";
      await seedTasks(db, marker, [
        { createdAt: same, status: "printing" },
        { createdAt: same, status: "queued" },
        { createdAt: same, status: "printing" },
        { createdAt: same, status: "printing" },
      ]);
      const pages = await listAll(repo, { q: marker, status: "printing" }, 2);
      expect(pages.map((page) => page.length)).toEqual([2, 1]);
    });

    it("filters by status and assignee, and counts statuses ignoring the status filter", async () => {
      const { db, repo, marker } = setup();
      const createdAt = "2026-03-03T10:00:00.000Z";
      const [queuedMine, , printingMine, qcOther] = await seedTasks(db, marker, [
        { createdAt, status: "queued", assignee: ACTOR },
        { createdAt, status: "queued", assignee: null },
        { createdAt, status: "printing", assignee: ACTOR },
        { createdAt, status: "qc_pending", assignee: "someone-else" },
      ]);

      const mine = await repo.list({
        filters: { q: marker, assignee: { type: "subject", subject: ACTOR } },
        cursor: null,
        limit: 50,
      });
      expect(mine.items.map((item) => item.taskId).sort()).toEqual(
        [queuedMine, printingMine].sort(),
      );
      expect(mine.counts).toEqual({ queued: 1, printing: 1 });

      const unassigned = await repo.list({
        filters: { q: marker, assignee: { type: "unassigned" } },
        cursor: null,
        limit: 50,
      });
      expect(unassigned.items).toHaveLength(1);
      expect(unassigned.items[0]?.assignee).toBeNull();

      const printing = await repo.list({
        filters: { q: marker, status: "printing" },
        cursor: null,
        limit: 50,
      });
      expect(printing.items.map((item) => item.taskId)).toEqual([printingMine]);
      // Counts still cover every status, so the chips next to the active one stay meaningful.
      expect(printing.counts).toEqual({ queued: 2, printing: 1, qc_pending: 1 });
      expect(qcOther).toBeDefined();
    });

    it("matches search text literally, so LIKE wildcards do not widen it", async () => {
      const { db, repo, marker } = setup();
      await seedTasks(db, marker, [{ createdAt: "2026-03-04T10:00:00.000Z" }]);
      for (const wildcard of ["%", "_", `${marker}%`, "\\"]) {
        const page = await repo.list({ filters: { q: wildcard }, cursor: null, limit: 50 });
        expect(
          page.items.filter((item) => item.artworkTitle?.includes(marker)),
          wildcard,
        ).toHaveLength(0);
      }
    });

    it("finds a task by the start of its order id", async () => {
      const { db, repo, marker } = setup();
      const [taskId] = await seedTasks(db, marker, [{ createdAt: "2026-03-05T10:00:00.000Z" }]);
      const full = await repo.list({ filters: { q: marker }, cursor: null, limit: 5 });
      const orderId = full.items.find((item) => item.taskId === taskId)?.orderId ?? "";
      const byOrder = await repo.list({
        filters: { q: `#${orderId.slice(0, 8)}` },
        cursor: null,
        limit: 5,
      });
      expect(byOrder.items.map((item) => item.taskId)).toContain(taskId);
    });

    it("describes each task with its artwork and edition", async () => {
      const { db, repo, marker } = setup();
      await seedTasks(db, marker, [{ createdAt: "2026-03-06T10:00:00.000Z" }]);
      const page = await repo.list({ filters: { q: marker }, cursor: null, limit: 5 });
      expect(page.items[0]).toMatchObject({
        artworkTitle: `Integration ${marker}`,
        status: "queued",
        version: 1,
      });
      expect(page.items[0]?.editionNumber).toEqual(expect.any(Number));
    });
  });

  describe("update", () => {
    it("moves a task, bumps its version and writes one audit row with before and after", async () => {
      const { db, repo, marker } = setup();
      const [id = ""] = await seedTasks(db, marker, [
        { createdAt: "2026-03-07T10:00:00.000Z", assignee: "first-owner" },
      ]);

      const outcome = await repo.update(
        move({ id, expectedVersion: 1, status: "printing", assigneeSubject: "second-owner" }),
      );

      expect(outcome).toEqual({ status: "updated", version: 2, taskStatus: "printing" });
      const audit = await db
        .select()
        .from(shopAdminAudit)
        .where(
          and(
            eq(shopAdminAudit.targetType, PRODUCTION_TASK_AUDIT_TARGET),
            eq(shopAdminAudit.targetId, id),
          ),
        );
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({
        actorSubjectId: ACTOR,
        capability: "production.write",
        action: "production.update_task",
      });
      expect(JSON.parse(audit[0]?.beforeJson ?? "")).toEqual({
        status: "queued",
        assigneeSubject: "first-owner",
      });
      expect(JSON.parse(audit[0]?.afterJson ?? "")).toEqual({
        status: "printing",
        assigneeSubject: "second-owner",
      });
    });

    it("refuses a stale version without changing or auditing anything", async () => {
      const { db, repo, marker } = setup();
      const [id = ""] = await seedTasks(db, marker, [{ createdAt: "2026-03-08T10:00:00.000Z" }]);
      await repo.update(move({ id, expectedVersion: 1, status: "printing" }));

      const stale = await repo.update(move({ id, expectedVersion: 1, status: "qc_pending" }));

      expect(stale).toEqual({ status: "stale", currentVersion: 2 });
      const detail = await repo.getDetail(id);
      expect(detail).toMatchObject({ status: "printing", version: 2 });
      const audit = await db.select().from(shopAdminAudit).where(eq(shopAdminAudit.targetId, id));
      expect(audit).toHaveLength(1);
    });

    it("refuses a move the state machine does not allow, without auditing it", async () => {
      const { db, repo, marker } = setup();
      const [id = ""] = await seedTasks(db, marker, [{ createdAt: "2026-03-09T10:00:00.000Z" }]);

      const outcome = await repo.update(move({ id, expectedVersion: 1, status: "completed" }));

      expect(outcome).toEqual({ status: "not_allowed", currentVersion: 1, from: "queued" });
      const audit = await db.select().from(shopAdminAudit).where(eq(shopAdminAudit.targetId, id));
      expect(audit).toHaveLength(0);
      expect((await repo.getDetail(id))?.status).toBe("queued");
    });

    it("treats a request that changes nothing as a no-op: no version bump, no audit row", async () => {
      const { db, repo, marker } = setup();
      const [id = ""] = await seedTasks(db, marker, [
        { createdAt: "2026-03-10T10:00:00.000Z", assignee: "owner" },
      ]);

      const outcome = await repo.update(
        move({ id, expectedVersion: 1, status: "queued", assigneeSubject: "owner" }),
      );

      expect(outcome).toEqual({ status: "updated", version: 1, taskStatus: "queued" });
      const audit = await db.select().from(shopAdminAudit).where(eq(shopAdminAudit.targetId, id));
      expect(audit).toHaveLength(0);
    });

    it("unassigns with null and leaves the assignee alone when it is omitted", async () => {
      const { db, repo, marker } = setup();
      const [id = ""] = await seedTasks(db, marker, [
        { createdAt: "2026-03-11T10:00:00.000Z", assignee: "owner" },
      ]);

      await repo.update(move({ id, expectedVersion: 1, status: "printing" }));
      expect((await repo.getDetail(id))?.assignee?.subject).toBe("owner");

      await repo.update(move({ id, expectedVersion: 2, assigneeSubject: null }));
      const detail = await repo.getDetail(id);
      expect(detail?.assignee).toBeNull();
      expect(detail?.status).toBe("printing");
    });

    it("lets exactly one of two simultaneous updates through", async () => {
      const { db, repo, marker } = setup();
      const [id = ""] = await seedTasks(db, marker, [{ createdAt: "2026-03-12T10:00:00.000Z" }]);

      const outcomes = await Promise.all([
        repo.update(move({ id, expectedVersion: 1, status: "printing" })),
        repo.update(move({ id, expectedVersion: 1, status: "cancelled" })),
      ]);

      expect(outcomes.filter((outcome) => outcome.status === "updated")).toHaveLength(1);
      expect(outcomes.filter((outcome) => outcome.status === "stale")).toHaveLength(1);
      const audit = await db.select().from(shopAdminAudit).where(eq(shopAdminAudit.targetId, id));
      expect(audit).toHaveLength(1);
    });

    it("reports a missing task", async () => {
      const { repo } = setup();
      const outcome = await repo.update(
        move({
          id: "00000000-0000-4000-8000-000000000000",
          expectedVersion: 1,
          status: "printing",
        }),
      );
      expect(outcome).toEqual({ status: "not_found" });
    });
  });

  describe("detail history", () => {
    it("lists creation and each change in order with who made it", async () => {
      const { db, repo, marker } = setup();
      const [id = ""] = await seedTasks(db, marker, [{ createdAt: "2026-03-13T10:00:00.000Z" }]);
      await ownerPool.query(
        `insert into shop_user_profile (identity_subject_id, name, email)
         values ($1, 'Pat Printer', 'pat@example.com') on conflict do nothing`,
        [`${marker}-pat`],
      );
      await ownerPool.query(
        `insert into shop_staff_member (identity_subject_id, role) values ($1, 'operations')
         on conflict do nothing`,
        [`${marker}-pat`],
      );
      await db.insert(shopAdminAudit).values({
        actorSubjectId: ACTOR,
        capability: "production.write",
        action: "create_production_task",
        targetType: PRODUCTION_TASK_AUDIT_TARGET,
        targetId: id,
        afterJson: JSON.stringify({ orderLineId: "x" }),
        createdAt: new Date("2026-03-13T10:00:00.000Z"),
      });

      await repo.update(
        move({
          id,
          expectedVersion: 1,
          status: "printing",
          assigneeSubject: `${marker}-pat`,
          actorSubjectId: `${marker}-pat`,
        }),
      );
      await repo.update(move({ id, expectedVersion: 2, status: "qc_pending" }));

      const detail = await repo.getDetail(id);
      const history = detail?.history ?? [];
      expect(history.map((entry) => entry.kind)).toEqual(["created", "updated", "updated"]);
      expect(history[1]).toMatchObject({
        actor: { subject: `${marker}-pat`, label: "Pat Printer", role: "operations" },
        status: { from: "queued", to: "printing" },
        assignee: { from: null, to: { subject: `${marker}-pat`, label: "Pat Printer" } },
      });
      expect(history[2]).toMatchObject({
        status: { from: "printing", to: "qc_pending" },
        assignee: null,
      });
      const ordered = await db
        .select()
        .from(shopAdminAudit)
        .where(eq(shopAdminAudit.targetId, id))
        .orderBy(asc(shopAdminAudit.createdAt));
      expect(ordered).toHaveLength(3);
    });

    it("returns null for a task that does not exist", async () => {
      const { repo } = setup();
      expect(await repo.getDetail("00000000-0000-4000-8000-000000000000")).toBeNull();
    });
  });

  describe("assignees", () => {
    it("lists active staff who can work on production, not disabled or unrelated roles", async () => {
      const { repo, marker } = setup();
      for (const [suffix, role, disabled] of [
        ["ops", "operations", false],
        ["off", "operations", true],
        ["fin", "finance", false],
      ] as const) {
        await ownerPool.query(
          `insert into shop_staff_member (identity_subject_id, role, disabled_at)
           values ($1, $2::shop_staff_role, $3)`,
          [`${marker}-${suffix}`, role, disabled ? new Date() : null],
        );
      }
      const subjects = (await repo.listAssignees()).map((member) => member.subject);
      expect(subjects).toContain(`${marker}-ops`);
      expect(subjects).not.toContain(`${marker}-off`);
      expect(subjects).not.toContain(`${marker}-fin`);
    });
  });
});
