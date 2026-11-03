import type { IdentityDatabase } from "@auction/identity-db";
import {
  subjectDataExport,
  subjectDataRequest,
  subjectDataRequestAudit,
} from "@auction/identity-db/schema";
import { eq, sql } from "drizzle-orm";
import type {
  ContinuationDecision,
  DataRequestAuditEntry,
  DataRequestWriter,
  ManualDecision,
  ManualRequestRow,
  MutateOutcome,
  NewManualRequest,
} from "../services/data-request.ports.js";
import type { SubjectExportRow } from "../services/subject-export.ports.js";
import { toManualRequestRow } from "./drizzle-data-request.mapper.js";
import {
  type Tx,
  toSubjectExportRow,
  writeSubjectExportAudit,
} from "./drizzle-subject-export.repository.js";

async function writeAudit(
  tx: Tx,
  requestId: string,
  actorSubjectId: string | null,
  entries: DataRequestAuditEntry[],
  at: Date,
): Promise<void> {
  if (entries.length === 0) return;
  await tx.insert(subjectDataRequestAudit).values(
    entries.map((entry) => ({
      requestId,
      actorSubjectId,
      event: entry.event,
      detail: entry.detail ?? {},
      occurredAt: at,
    })),
  );
}

async function insertRequest(tx: Tx, request: NewManualRequest): Promise<ManualRequestRow> {
  const [created] = await tx.insert(subjectDataRequest).values(request).returning();
  if (!created) throw new Error("subject_data_request insert returned no row");
  return toManualRequestRow(created);
}

/**
 * Staff's manual data requests. Every change locks the request row, lets a rule look at the
 * state it finds, and applies the rule's change with its audit rows in the same transaction, so
 * two staff acting at once are applied one after the other against the latest state.
 */
export class DrizzleDataRequestWriter implements DataRequestWriter {
  constructor(private readonly db: IdentityDatabase) {}

  async create(
    request: NewManualRequest,
    audit: DataRequestAuditEntry[],
  ): Promise<ManualRequestRow> {
    return this.db.transaction(async (tx) => {
      const created = await insertRequest(tx, request);
      await writeAudit(tx, created.id, request.createdBy, audit, created.createdAt);
      return created;
    });
  }

  async mutate(
    reference: string,
    actorSubjectId: string,
    decide: (row: ManualRequestRow) => ManualDecision,
  ): Promise<MutateOutcome | null> {
    return this.db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(subjectDataRequest)
        .where(eq(subjectDataRequest.reference, reference))
        .for("update");
      if (!locked) return null;
      const decision = decide(toManualRequestRow(locked));
      if (!decision.ok) return decision;
      const at = new Date();
      const [updated] = await tx
        .update(subjectDataRequest)
        .set({ ...decision.change, updatedAt: at, version: sql`${subjectDataRequest.version} + 1` })
        .where(eq(subjectDataRequest.id, locked.id))
        .returning();
      if (!updated) return null;
      await writeAudit(tx, locked.id, actorSubjectId, decision.audit, at);
      return { ok: true, row: toManualRequestRow(updated) } as const;
    });
  }

  async continueDownload(
    downloadReference: string,
    actorSubjectId: string,
    decide: (download: SubjectExportRow, alreadyContinued: boolean) => ContinuationDecision,
  ): Promise<MutateOutcome | null> {
    // "DL-7F3C1A" is the first six characters of the request id, which are also the first six of its text form.
    const prefix = downloadReference.slice(3).toLowerCase();
    return this.db.transaction(async (tx) => {
      const matches = await tx
        .select()
        .from(subjectDataExport)
        .where(sql`${subjectDataExport.id}::text LIKE ${`${prefix}%`}`)
        .limit(2)
        .for("update");
      const [found] = matches;
      if (!found) return null;
      if (matches.length > 1) return { ok: false, error: "ambiguous_reference" } as const;
      const [link] = await tx
        .select({ id: subjectDataRequest.id })
        .from(subjectDataRequest)
        .where(eq(subjectDataRequest.linkedExportId, found.id))
        .limit(1);
      const download = toSubjectExportRow(found);
      const decision = decide(download, link !== undefined);
      if (!decision.ok) return decision;
      const created = await insertRequest(tx, decision.plan.request);
      await writeAudit(tx, created.id, actorSubjectId, decision.plan.audit, created.createdAt);
      await writeSubjectExportAudit(
        tx,
        download,
        [
          {
            event: decision.plan.exportAudit.event,
            detail: { ...decision.plan.exportAudit.detail, request: created.reference },
          },
        ],
        created.createdAt,
      );
      return { ok: true, row: created } as const;
    });
  }

  async clearContacts(closedOnOrBefore: string, now: Date, limit: number): Promise<string[]> {
    const result = await this.db.execute(sql`
      WITH due AS (
        SELECT "id" FROM "subject_data_request"
        WHERE "status" = 'closed'
          AND "contact_cleared_at" IS NULL
          AND "closed_on" <= ${closedOnOrBefore}::date
        ORDER BY "closed_on", "id"
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      ),
      cleared AS (
        UPDATE "subject_data_request" AS r
        SET "contact_name" = NULL,
            "contact_detail" = NULL,
            "contact_cleared_at" = ${now}::timestamptz,
            "updated_at" = ${now}::timestamptz,
            "version" = r."version" + 1
        FROM due
        WHERE r."id" = due."id"
        RETURNING r."id", r."reference"
      ),
      audited AS (
        INSERT INTO "subject_data_request_audit" ("request_id", "actor_subject_id", "event", "detail", "occurred_at")
        SELECT "id", NULL, 'data_request.contact_cleared', '{}'::jsonb, ${now}::timestamptz FROM cleared
      )
      SELECT "reference" FROM cleared
    `);
    return result.rows.map((row) => String((row as { reference: unknown }).reference));
  }
}
