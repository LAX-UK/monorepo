import { createIdentityDb } from "@auction/identity-db";
import {
  subjectDataExport,
  subjectDataExportAudit,
  subjectDataRequest,
  subjectDataRequestAudit,
  user,
} from "@auction/identity-db/schema";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { planClose, planCreate, planExtend } from "../services/data-request.rules.js";
import { DataRequestService } from "../services/data-request.service.js";
import { deadlineTierFor } from "../services/subject-export.state.js";
import { DrizzleDataRequestReader } from "./drizzle-data-request.reader.js";
import { DrizzleDataRequestWriter } from "./drizzle-data-request.writer.js";
import { DrizzleSubjectExportRepository } from "./drizzle-subject-export.repository.js";

const DATABASE_URL = process.env.DATABASE_URL;
const STAFF = "dr-it-staff";
const LENA = "dr-it-lena";
const MAX = "dr-it-max";
const USERS = [STAFF, LENA, MAX];
const NOW = new Date("2026-11-02T12:00:00.000Z");
const TODAY = "2026-11-02";

describe.skipIf(!DATABASE_URL)("drizzle data requests", () => {
  const db = DATABASE_URL ? createIdentityDb(DATABASE_URL) : undefined;
  const writer = db ? new DrizzleDataRequestWriter(db) : undefined;
  const reader = db ? new DrizzleDataRequestReader(db) : undefined;
  const createdExports: string[] = [];

  beforeAll(async () => {
    if (!db) return;
    await db
      .insert(user)
      .values(
        USERS.map((id) => ({
          id,
          name: id,
          email: `${id}@example.test`,
          createdAt: NOW,
          updatedAt: NOW,
        })),
      )
      .onConflictDoNothing();
  });

  afterAll(async () => {
    if (!db) return;
    await db.delete(subjectDataRequest).where(inArray(subjectDataRequest.createdBy, [STAFF]));
    if (createdExports.length > 0) {
      await db.delete(subjectDataExport).where(inArray(subjectDataExport.id, createdExports));
    }
    await db.delete(user).where(inArray(user.id, USERS));
  });

  async function log(subjectId: string, receivedOn = TODAY) {
    if (!writer) throw new Error("no database");
    const plan = planCreate(
      {
        actorSubjectId: STAFF,
        person: { kind: "account", subjectId },
        reason: "full_copy",
        channel: "email",
        receivedOn,
        identity: "confirmed",
        products: ["account", "bid", "shop"],
      },
      { today: TODAY, now: NOW, accountExists: true },
    );
    if (!plan.ok) throw new Error(plan.error);
    return writer.create(plan.request, plan.audit);
  }

  it("numbers requests from their own sequence and audits the logging in the same transaction", async () => {
    if (!db) return;
    const row = await log(LENA);
    expect(row.reference).toMatch(/^DR-\d{4,}$/);
    expect(row).toMatchObject({ dueOn: "2026-12-02", version: 1, status: "in_progress" });
    const audit = await db
      .select()
      .from(subjectDataRequestAudit)
      .where(eq(subjectDataRequestAudit.requestId, row.id));
    expect(audit.map((entry) => entry.event)).toEqual(["data_request.logged"]);
    expect(audit[0]?.actorSubjectId).toBe(STAFF);
    expect(JSON.stringify(audit[0]?.detail)).not.toContain("example.test");
  });

  it("extends once, within two months, and the database holds the same line", async () => {
    if (!db || !writer) return;
    const row = await log(MAX, "2026-10-31");
    const extend = {
      actorSubjectId: STAFF,
      version: row.version,
      months: 2 as const,
      reason: "complex" as const,
      note: "Archive",
      personToldOn: "2026-11-02",
      personToldVia: "email" as const,
    };
    const first = await writer.mutate(row.reference, STAFF, (current) =>
      planExtend(current, extend, { today: TODAY, now: NOW }),
    );
    expect(first).toMatchObject({ ok: true, row: { extendedDueOn: "2027-01-30", version: 2 } });
    const second = await writer.mutate(row.reference, STAFF, (current) =>
      planExtend(current, { ...extend, version: 2 }, { today: TODAY, now: NOW }),
    );
    expect(second).toEqual({ ok: false, error: "already_extended" });
    await expect(
      db
        .update(subjectDataRequest)
        .set({ extendedDueOn: "2027-03-01" })
        .where(eq(subjectDataRequest.id, row.id)),
    ).rejects.toThrow();
  });

  it("closes with an outcome, and clears contact details after the retention period but keeps the record", async () => {
    if (!db || !writer) return;
    const plan = planCreate(
      {
        actorSubjectId: STAFF,
        person: { kind: "contact", name: "Pat Example", detail: "pat@example.test" },
        reason: "after_deletion",
        channel: "post",
        receivedOn: TODAY,
        identity: "confirmed",
        products: ["account"],
      },
      { today: TODAY, now: NOW, accountExists: true },
    );
    if (!plan.ok) throw new Error(plan.error);
    const row = await writer.create(plan.request, plan.audit);
    const closed = await writer.mutate(row.reference, STAFF, (current) =>
      planClose(
        current,
        { actorSubjectId: STAFF, version: current.version, outcome: "sent" },
        { today: TODAY, now: NOW },
      ),
    );
    expect(closed).toMatchObject({
      ok: true,
      row: { status: "closed", outcome: "sent", closedOn: TODAY },
    });

    expect(await writer.clearContacts("2026-11-01", NOW, 50)).not.toContain(row.reference);
    expect(await writer.clearContacts(TODAY, NOW, 50)).toContain(row.reference);
    const [after] = await db
      .select()
      .from(subjectDataRequest)
      .where(eq(subjectDataRequest.id, row.id));
    expect(after).toMatchObject({
      contactName: null,
      contactDetail: null,
      outcome: "sent",
      dueOn: row.dueOn,
    });
    expect(after?.contactClearedAt).not.toBeNull();
    const events = await db
      .select({ event: subjectDataRequestAudit.event })
      .from(subjectDataRequestAudit)
      .where(eq(subjectDataRequestAudit.requestId, row.id));
    expect(events.map((entry) => entry.event)).toContain("data_request.contact_cleared");
  });

  it("continues a delayed download once, with its dates, and records it on the download's timeline", async () => {
    if (!db || !writer || !reader) return;
    const [created] = await db
      .insert(subjectDataExport)
      .values({
        subjectId: LENA,
        status: "delayed",
        productProgress: { account: "done", bid: "retrying", shop: "waiting" },
        requestedAt: new Date("2026-10-20T14:02:00.000Z"),
        dueAt: new Date("2026-11-20T14:02:00.000Z"),
      })
      .onConflictDoNothing()
      .returning();
    if (!created) return; // LENA already has an open download from another run
    createdExports.push(created.id);
    const reference = `DL-${created.id.replaceAll("-", "").slice(0, 6).toUpperCase()}`;
    const service = new DataRequestService({ reader, writer }, () => NOW);

    const first = await service.continueDownload(reference, STAFF);
    expect(first.ok).toBe(true);
    expect(await service.continueDownload(reference, STAFF)).toEqual({
      ok: false,
      error: "already_continued",
    });

    const audit = await db
      .select({ event: subjectDataExportAudit.event })
      .from(subjectDataExportAudit)
      .where(eq(subjectDataExportAudit.exportId, created.id));
    expect(audit.map((entry) => entry.event)).toContain("data_export.continued_manually");

    const open = await service.list({ view: "open", sort: "due", q: reference });
    expect(open.items).toEqual([]);
    const all = await service.list({ view: "all", sort: "due", q: reference });
    expect(all.items[0]).toMatchObject({
      kind: "download",
      continuedAs: expect.stringMatching(/^DR-/),
    });
  });

  it("lists, searches by a full email only, pages by keyset and counts for the badge", async () => {
    if (!reader || !writer) return;
    const service = new DataRequestService({ reader, writer }, () => NOW);
    const byEmail = await service.list({
      view: "all",
      sort: "requested",
      q: `${LENA}@example.test`,
    });
    expect(byEmail.items.length).toBeGreaterThan(0);
    expect(JSON.stringify(byEmail.items)).not.toContain("@example.test");
    const partial = await service.list({ view: "all", sort: "requested", q: "example.test" });
    expect(partial.items).toEqual([]);

    const everything = await reader.list({ view: "all", sort: "due", today: TODAY, limit: 1000 });
    const firstPage = await reader.list({ view: "all", sort: "due", today: TODAY, limit: 2 });
    const last = firstPage[1];
    if (last) {
      const next = await reader.list({
        view: "all",
        sort: "due",
        today: TODAY,
        limit: 1000,
        after: { key: last.dueOn ?? "9999-12-31", reference: last.reference },
      });
      expect([...firstPage, ...next].map((row) => row.reference)).toEqual(
        everything.map((row) => row.reference),
      );
    }
    const summary = await service.summary();
    expect(summary.open).toBeGreaterThanOrEqual(summary.overdue + 0);
  });

  it("writes a deadline alert row when the schedule claims a tier", async () => {
    if (!db) return;
    const repository = new DrizzleSubjectExportRepository(db, {
      publish: async () => undefined,
    } as never);
    const [created] = await db
      .insert(subjectDataExport)
      .values({
        subjectId: MAX,
        status: "collecting",
        productProgress: { account: "done", bid: "collecting", shop: "waiting" },
        requestedAt: new Date(NOW.getTime() - 8 * 86_400_000),
        dueAt: new Date(NOW.getTime() + 22 * 86_400_000),
      })
      .onConflictDoNothing()
      .returning();
    if (!created) return;
    createdExports.push(created.id);
    const claimed = await repository.claimDeadlineAlerts(NOW, deadlineTierFor, 100);
    expect(claimed.map((entry) => entry.row.id)).toContain(created.id);
    const audit = await db
      .select()
      .from(subjectDataExportAudit)
      .where(eq(subjectDataExportAudit.exportId, created.id));
    const alert = audit.find((entry) => entry.event === "data_export.deadline_alert");
    expect(alert?.detail).toMatchObject({ tier: 2, audience: "data_protection_contact" });
  });
});
