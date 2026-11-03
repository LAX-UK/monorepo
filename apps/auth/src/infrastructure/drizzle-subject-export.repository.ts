import type { IdentityEventPublisher } from "@auction/auth";
import { SUBJECT_EXPORT_OPEN_STATUSES, SUBJECT_EXPORT_PRODUCTS } from "@auction/identity-contracts";
import type { IdentityDatabase } from "@auction/identity-db";
import { subjectDataExport, subjectDataExportAudit } from "@auction/identity-db/schema";
import { and, desc, eq, gt, inArray, isNotNull, isNull, lt, lte, sql } from "drizzle-orm";
import type {
  CreateSubjectExportInput,
  CreateSubjectExportOutcome,
  SubjectExportAuditEntry,
  SubjectExportMutation,
  SubjectExportPendingPurge,
  SubjectExportProgressMap,
  SubjectExportRepository,
  SubjectExportRow,
} from "../services/subject-export.ports.js";
import { decideCreate, initialProgress, isPreparing } from "../services/subject-export.state.js";

type Tx = Parameters<Parameters<IdentityDatabase["transaction"]>[0]>[0];
type Record_ = typeof subjectDataExport.$inferSelect;

const OPEN = [...SUBJECT_EXPORT_OPEN_STATUSES];

function progressOf(value: unknown): SubjectExportProgressMap {
  const stored = (value ?? {}) as Partial<SubjectExportProgressMap>;
  const progress = initialProgress();
  for (const product of SUBJECT_EXPORT_PRODUCTS) progress[product] = stored[product] ?? "waiting";
  return progress;
}

function toRow(row: Record_): SubjectExportRow {
  return {
    id: row.id,
    subjectId: row.subjectId,
    status: row.status as SubjectExportRow["status"],
    productProgress: progressOf(row.productProgress),
    requestedAt: row.requestedAt,
    dueAt: row.dueAt,
    readyAt: row.readyAt,
    expiresAt: row.expiresAt,
    deletedAt: row.deletedAt,
    objectKey: row.objectKey,
    fileName: row.fileName,
    sizeBytes: row.sizeBytes,
    sha256: row.sha256,
    downloadCount: row.downloadCount,
    lastErrorCode: row.lastErrorCode,
    deadlineAlertTier: row.deadlineAlertTier,
  };
}

async function writeAudit(
  tx: Tx,
  row: Pick<SubjectExportRow, "id" | "subjectId">,
  entries: SubjectExportAuditEntry[],
  at: Date,
): Promise<void> {
  if (entries.length === 0) return;
  await tx.insert(subjectDataExportAudit).values(
    entries.map((entry) => ({
      exportId: row.id,
      subjectId: row.subjectId,
      event: entry.event,
      sessionId: entry.sessionId ?? null,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
      detail: entry.detail ?? {},
      occurredAt: at,
    })),
  );
}

/**
 * Identity's "Download my data" requests.
 *
 * Creating a request takes a per-person transaction lock, so two tabs cannot both pass the
 * "one open request" and rate-limit checks (the partial unique index is the backstop). A change
 * to an existing request locks its row, so two reports from the worker, or a download racing a
 * deletion, are applied one after the other against the latest state.
 */
export class DrizzleSubjectExportRepository implements SubjectExportRepository {
  constructor(
    private readonly db: IdentityDatabase,
    private readonly events: IdentityEventPublisher,
  ) {}

  async createIfAllowed(input: CreateSubjectExportInput): Promise<CreateSubjectExportOutcome> {
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${`subject_data_export:${input.subjectId}`}))`,
      );
      const open = (
        await tx
          .select()
          .from(subjectDataExport)
          .where(
            and(
              eq(subjectDataExport.subjectId, input.subjectId),
              inArray(subjectDataExport.status, OPEN),
            ),
          )
      ).map(toRow);
      const windowRequests = (
        await tx
          .select()
          .from(subjectDataExport)
          .where(
            and(
              eq(subjectDataExport.subjectId, input.subjectId),
              gt(subjectDataExport.requestedAt, input.windowStart),
            ),
          )
          .orderBy(desc(subjectDataExport.requestedAt))
      ).map(toRow);
      const decision = decideCreate({
        open,
        windowRequests,
        max: input.maxPerWindow,
        windowDays: input.windowDays,
      });
      if (decision.kind === "already_open") {
        return { outcome: "already_open", row: decision.row } as const;
      }
      if (decision.kind === "rate_limited") {
        return { outcome: "rate_limited", retryAfter: decision.retryAfter } as const;
      }

      const [created] = await tx
        .insert(subjectDataExport)
        .values({
          subjectId: input.subjectId,
          status: "requested",
          productProgress: initialProgress(),
          requestedAt: input.requestedAt,
          dueAt: input.dueAt,
        })
        .returning();
      if (!created) throw new Error("subject_data_export insert returned no row");
      await this.events.publish(
        { type: "subject.data_export_requested", userId: input.subjectId, exportId: created.id },
        { transaction: tx },
      );
      await writeAudit(
        tx,
        created,
        [
          {
            event: "data_export.requested",
            sessionId: input.context.sessionId,
            ipAddress: input.context.ipAddress,
            userAgent: input.context.userAgent,
            detail: { dueAt: input.dueAt.toISOString() },
          },
        ],
        input.requestedAt,
      );
      return { outcome: "requested", row: toRow(created) } as const;
    });
  }

  async findLatest(subjectId: string): Promise<SubjectExportRow | null> {
    const [row] = await this.db
      .select()
      .from(subjectDataExport)
      .where(eq(subjectDataExport.subjectId, subjectId))
      .orderBy(desc(subjectDataExport.requestedAt))
      .limit(1);
    return row ? toRow(row) : null;
  }

  async findById(exportId: string): Promise<SubjectExportRow | null> {
    const [row] = await this.db
      .select()
      .from(subjectDataExport)
      .where(eq(subjectDataExport.id, exportId))
      .limit(1);
    return row ? toRow(row) : null;
  }

  async mutate(
    exportId: string,
    decide: (row: SubjectExportRow) => SubjectExportMutation | null,
  ): Promise<{ before: SubjectExportRow; after: SubjectExportRow } | null> {
    return this.db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(subjectDataExport)
        .where(eq(subjectDataExport.id, exportId))
        .for("update");
      if (!locked) return null;
      const before = toRow(locked);
      const mutation = decide(before);
      if (!mutation) return null;
      const at = new Date();
      const [updated] = await tx
        .update(subjectDataExport)
        .set({
          ...mutation.patch,
          ...(mutation.queueObjectPurge ? { objectPurgeRequestedAt: at } : {}),
          updatedAt: at,
        })
        .where(eq(subjectDataExport.id, exportId))
        .returning();
      if (!updated) return null;
      await writeAudit(tx, before, mutation.audit, at);
      return { before, after: toRow(updated) };
    });
  }

  async listPendingObjectPurges(limit: number): Promise<SubjectExportPendingPurge[]> {
    const rows = await this.db
      .select({ exportId: subjectDataExport.id, objectKey: subjectDataExport.objectKey })
      .from(subjectDataExport)
      .where(
        and(
          isNotNull(subjectDataExport.objectPurgeRequestedAt),
          isNull(subjectDataExport.objectPurgedAt),
          isNotNull(subjectDataExport.objectKey),
        ),
      )
      .orderBy(subjectDataExport.objectPurgeRequestedAt)
      .limit(limit);
    return rows.flatMap((row) =>
      row.objectKey ? [{ exportId: row.exportId, objectKey: row.objectKey }] : [],
    );
  }

  async markObjectPurged(exportId: string, at: Date): Promise<boolean> {
    const updated = await this.db
      .update(subjectDataExport)
      .set({ objectPurgedAt: at, updatedAt: at })
      .where(
        and(
          eq(subjectDataExport.id, exportId),
          isNotNull(subjectDataExport.objectPurgeRequestedAt),
          isNull(subjectDataExport.objectPurgedAt),
        ),
      )
      .returning({ id: subjectDataExport.id });
    return updated.length > 0;
  }

  async expireDue(now: Date, limit: number): Promise<SubjectExportRow[]> {
    return this.db.transaction(async (tx) => {
      const due = await tx
        .select({ id: subjectDataExport.id })
        .from(subjectDataExport)
        .where(and(eq(subjectDataExport.status, "ready"), lte(subjectDataExport.expiresAt, now)))
        .orderBy(subjectDataExport.expiresAt)
        .limit(limit)
        .for("update", { skipLocked: true });
      if (due.length === 0) return [];
      const expired = await tx
        .update(subjectDataExport)
        .set({ status: "expired", objectPurgeRequestedAt: now, updatedAt: now })
        .where(
          and(
            inArray(
              subjectDataExport.id,
              due.map((row) => row.id),
            ),
            eq(subjectDataExport.status, "ready"),
          ),
        )
        .returning();
      for (const row of expired) {
        await writeAudit(
          tx,
          row,
          [{ event: "data_export.expired", detail: { objectPurgeQueued: true } }],
          now,
        );
      }
      return expired.map(toRow);
    });
  }

  async claimDeadlineAlerts(
    now: Date,
    tierFor: (row: SubjectExportRow, now: Date) => number,
    limit: number,
  ): Promise<{ row: SubjectExportRow; tier: number }[]> {
    const candidates = (
      await this.db
        .select()
        .from(subjectDataExport)
        .where(
          and(
            inArray(subjectDataExport.status, ["requested", "collecting", "delayed"]),
            lt(subjectDataExport.deadlineAlertTier, 3),
            lte(subjectDataExport.requestedAt, now),
          ),
        )
        .orderBy(subjectDataExport.requestedAt)
        .limit(limit)
    ).map(toRow);
    const claimed: { row: SubjectExportRow; tier: number }[] = [];
    for (const row of candidates) {
      const tier = tierFor(row, now);
      if (tier <= row.deadlineAlertTier || !isPreparing(row.status)) continue;
      // The tier guard makes the claim race-free: only one process moves a request past a tier.
      const [updated] = await this.db
        .update(subjectDataExport)
        .set({ deadlineAlertTier: tier })
        .where(
          and(
            eq(subjectDataExport.id, row.id),
            lt(subjectDataExport.deadlineAlertTier, tier),
            isNull(subjectDataExport.deletedAt),
          ),
        )
        .returning();
      if (updated) claimed.push({ row: toRow(updated), tier });
    }
    return claimed;
  }
}
