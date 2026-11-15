import { shopAdminAudit } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createPendingPaymentOrderWithReservedEdition,
  importTestArtwork,
  integrationSuffix,
  requireDefined,
} from "../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../test-support/shop-integration-setup.js";
import { createDrizzleProductionTaskRepository } from "./drizzle-production-task.repository.js";
import { PRODUCTION_TASK_AUDIT_TARGET } from "./drizzle-production-task.repository.js";
import { ZOHO_QC_ACTOR, createDrizzleQcReadyToPack } from "./drizzle-qc-ready-to-pack.js";

/** As shop_app, the role LAX Shop runs as: the step is made with the grants it really has. */
describe.skipIf(!hasShopIntegrationDb)("Zoho quality check moves a print on", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });
  afterAll(async () => {
    await shopPool.end();
    await ownerPool.end();
  });

  const db = () => createShopDb(shopPool);
  const qc = () => createDrizzleQcReadyToPack(db(), createDrizzleProductionTaskRepository(db()));

  /** A paid-style order with one print line and its production task at `status`. */
  async function seed(label: string, status: string) {
    const marker = integrationSuffix(label).replace(/_/g, "-");
    const artwork = await importTestArtwork(db(), marker);
    const order = await createPendingPaymentOrderWithReservedEdition(db(), {
      artworkId: artwork.artworkId,
      suffix: marker,
    });
    const { rows } = await ownerPool.query<{ id: string; line: string; reference: string }>(
      `insert into shop_production_task (order_line_id, edition_id, status)
       select l.id, l.edition_id, $2::shop_production_task_status
       from shop_order_line l where l.order_id = $1
       returning id, order_line_id as line, (select reference from shop_order where id = $1) as reference`,
      [order.orderId, status],
    );
    const row = requireDefined(rows[0], "task");
    return { ...order, taskId: row.id, lineId: row.line, reference: row.reference };
  }

  const statusOf = async (taskId: string) =>
    (await ownerPool.query("select status from shop_production_task where id = $1", [taskId]))
      .rows[0]?.status;

  it("moves a task awaiting its check to quality check passed, with an audit row for the system step", async () => {
    const t = await seed("qc-pending", "qc_pending");
    expect(await qc().markPassed({ orderReference: t.reference, lineId: t.lineId })).toBe("moved");
    expect(await statusOf(t.taskId)).toBe("qc_passed");
    const audit = await db()
      .select()
      .from(shopAdminAudit)
      .where(
        and(
          eq(shopAdminAudit.targetType, PRODUCTION_TASK_AUDIT_TARGET),
          eq(shopAdminAudit.targetId, t.taskId),
        ),
      );
    expect(audit.map((row) => row.actorSubjectId)).toEqual([ZOHO_QC_ACTOR]);
  });

  it("puts the Zoho job record in the audit row, so a move can be traced back to it", async () => {
    const t = await seed("audit-record", "qc_pending");
    await qc().markPassed({
      orderReference: t.reference,
      lineId: t.lineId,
      zohoModule: "Framing_Jobs",
      zohoRecordId: "1023341000017963001",
    });
    const audit = await db()
      .select()
      .from(shopAdminAudit)
      .where(eq(shopAdminAudit.targetId, t.taskId));
    expect(JSON.parse(String(audit[0]?.afterJson))).toMatchObject({
      status: "qc_passed",
      zohoModule: "Framing_Jobs",
      zohoRecordId: "1023341000017963001",
    });
  });

  it("refuses a cancelled or refunded order's print as not ready, but leaves a dispatched one alone", async () => {
    for (const orderStatus of ["cancelled", "refunded", "expired"]) {
      const t = await seed(`dead-${orderStatus}`, "qc_pending");
      await ownerPool.query("update shop_order set status = $2 where id = $1", [
        t.orderId,
        orderStatus,
      ]);
      expect(await qc().markPassed({ orderReference: t.reference, lineId: t.lineId })).toBe(
        "not_ready",
      );
      expect(await statusOf(t.taskId)).toBe("qc_pending");
    }
    const sent = await seed("dead-dispatched", "completed");
    await ownerPool.query("update shop_order set status = 'refunded' where id = $1", [
      sent.orderId,
    ]);
    expect(await qc().markPassed({ orderReference: sent.reference, lineId: sent.lineId })).toBe(
      "already",
    );
    expect(await statusOf(sent.taskId)).toBe("completed");
  });

  it("walks a printing task through the check, and a repeat changes nothing", async () => {
    const t = await seed("printing", "printing");
    const request = { orderReference: t.reference, lineId: t.lineId };
    expect(await qc().markPassed(request)).toBe("moved");
    expect(await statusOf(t.taskId)).toBe("qc_passed");
    expect(await qc().markPassed(request)).toBe("already");
    const { rows } = await ownerPool.query(
      "select version from shop_production_task where id = $1",
      [t.taskId],
    );
    expect(rows[0]?.version).toBe(3);
  });

  it("leaves a task that is further on alone, and never moves one back", async () => {
    const t = await seed("completed", "completed");
    expect(await qc().markPassed({ orderReference: t.reference, lineId: t.lineId })).toBe(
      "already",
    );
    expect(await statusOf(t.taskId)).toBe("completed");
  });

  it("does not guess: another order's reference, an unknown line, or a task that cannot pass are not moved", async () => {
    const a = await seed("match-a", "qc_pending");
    const b = await seed("match-b", "qc_pending");
    expect(await qc().markPassed({ orderReference: b.reference, lineId: a.lineId })).toBe(
      "unmatched",
    );
    expect(
      await qc().markPassed({
        orderReference: a.reference,
        lineId: "00000000-0000-4000-8000-000000000000",
      }),
    ).toBe("unmatched");
    expect(await statusOf(a.taskId)).toBe("qc_pending");
    for (const status of ["queued", "qc_failed", "cancelled"]) {
      const t = await seed(`not-ready-${status}`, status);
      expect(await qc().markPassed({ orderReference: t.reference, lineId: t.lineId })).toBe(
        "not_ready",
      );
      expect(await statusOf(t.taskId)).toBe(status);
    }
  });

  /** A frame sold with the print: a framing line on the same order and its framing task. */
  async function addFrame(t: Awaited<ReturnType<typeof seed>>, taskStatus: string) {
    const code = `qc-${t.taskId.slice(0, 8)}`;
    const option = await ownerPool.query<{ id: string }>(
      `insert into shop_framing_option (code, name, frame, mount, glazing, hanging, lead_time_min_days, lead_time_max_days)
       values ($1, 'Oak', 'natural_oak', 'window_conservation', 'uv_acrylic', 'd_rings_cord', 5, 10)
       returning id`,
      [code],
    );
    const optionId = requireDefined(option.rows[0], "option").id;
    const frame = await ownerPool.query<{ id: string }>(
      `insert into shop_order_line (order_id, kind, framing_for_line_id, framing_option_id, framing_snapshot, unit_price_pence)
       values ($1, 'framing', $2, $3, '{"name":"Oak"}'::jsonb, 100) returning id`,
      [t.orderId, t.lineId, optionId],
    );
    const frameId = requireDefined(frame.rows[0], "frame line").id;
    await ownerPool.query(
      "insert into shop_framing_task (order_line_id, status, due_at) values ($1, $2, now())",
      [frameId, taskStatus],
    );
    return frameId;
  }

  it("takes the framing line a Zoho framing job names to its print, and holds the pass while the frame is open", async () => {
    const t = await seed("frame-open", "qc_pending");
    const frameId = await addFrame(t, "framing");
    const request = { orderReference: t.reference, lineId: frameId };
    expect(await qc().markPassed(request)).toBe("frame_open");
    expect(await statusOf(t.taskId)).toBe("qc_pending");

    await ownerPool.query(
      "update shop_framing_task set status = 'completed' where order_line_id = $1",
      [frameId],
    );
    expect(await qc().markPassed(request)).toBe("moved");
    expect(await statusOf(t.taskId)).toBe("qc_passed");
  });
});
