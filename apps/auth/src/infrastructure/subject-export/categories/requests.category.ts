import type { SubjectExportStatus } from "@auction/identity-contracts";
import type { IdentityDatabase } from "@auction/identity-db";
import { identityLifecycleOutbox, subjectDataExport } from "@auction/identity-db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import {
  type ExportSource,
  SourcedExportCategory,
  inMemorySource,
} from "../../../subject-export/sourced-export-category.js";
import { iso, isoRequired } from "../../../subject-export/values.js";
import { afterKey, countWhere } from "./keyset.js";

type ExportRequestRow = {
  id: string;
  status: string;
  requestedAt: Date;
  readyAt: Date | null;
  expiresAt: Date | null;
  deletedAt: Date | null;
  updatedAt: Date;
};

/** How an earlier download ended, in the words of the contract. Metadata only: never the file. */
export function mapDataDownload(row: ExportRequestRow) {
  const status = row.status as SubjectExportStatus;
  const ended = (outcome: string, at: Date | null) => ({ outcome, completedAt: iso(at) });
  const result =
    status === "ready"
      ? ended("completed", row.readyAt)
      : status === "expired"
        ? ended("expired", row.expiresAt)
        : status === "deleted"
          ? ended("deleted_by_you", row.deletedAt)
          : status === "failed"
            ? ended("failed", row.updatedAt)
            : ended("in_progress", null);
  return {
    id: row.id,
    origin: "observed" as const,
    kind: "data_download",
    requestedAt: isoRequired(row.requestedAt),
    ...result,
  };
}

type DeletionEvent = { id: number; eventType: string; occurredAt: Date };

/** Pairs each deletion request with the cancellation that followed it, if any. */
export function mapDeletionRequests(events: readonly DeletionEvent[]) {
  const records = [];
  const ordered = [...events].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  for (const [index, event] of ordered.entries()) {
    if (event.eventType !== "user.deletion_requested") continue;
    const upTo = ordered
      .slice(index + 1)
      .find((later) => later.eventType === "user.deletion_requested");
    const cancelled = ordered
      .slice(index + 1, upTo ? ordered.indexOf(upTo) : undefined)
      .find((later) => later.eventType === "user.deletion_cancelled");
    records.push({
      key: `deletion-${event.id}`,
      record: {
        id: `deletion-${event.id}`,
        origin: "observed" as const,
        kind: "deletion",
        requestedAt: isoRequired(event.occurredAt),
        outcome: cancelled ? "cancelled" : "pending",
        completedAt: iso(cancelled?.occurredAt),
      },
    });
  }
  return records;
}

/** Earlier data downloads and deletion requests, as dates and outcomes. */
export class RequestsExportCategory extends SourcedExportCategory {
  readonly id = "requests";
  protected readonly sources: readonly ExportSource[];

  constructor(db: IdentityDatabase) {
    super();
    this.sources = [
      {
        count: (subjectId) =>
          countWhere(db, subjectDataExport, eq(subjectDataExport.subjectId, subjectId)),
        page: async (subjectId, key, limit) => {
          const rows = await db
            .select({
              id: subjectDataExport.id,
              status: subjectDataExport.status,
              requestedAt: subjectDataExport.requestedAt,
              readyAt: subjectDataExport.readyAt,
              expiresAt: subjectDataExport.expiresAt,
              deletedAt: subjectDataExport.deletedAt,
              updatedAt: subjectDataExport.updatedAt,
            })
            .from(subjectDataExport)
            .where(
              and(eq(subjectDataExport.subjectId, subjectId), afterKey(subjectDataExport.id, key)),
            )
            .orderBy(asc(subjectDataExport.id))
            .limit(limit);
          return rows.map((row) => ({ key: row.id, record: mapDataDownload(row) }));
        },
      },
      inMemorySource(async (subjectId) =>
        mapDeletionRequests(
          await db
            .select({
              id: identityLifecycleOutbox.id,
              eventType: identityLifecycleOutbox.eventType,
              occurredAt: identityLifecycleOutbox.occurredAt,
            })
            .from(identityLifecycleOutbox)
            .where(
              and(
                eq(identityLifecycleOutbox.aggregateType, "user"),
                eq(identityLifecycleOutbox.aggregateId, subjectId),
                inArray(identityLifecycleOutbox.eventType, [
                  "user.deletion_requested",
                  "user.deletion_cancelled",
                ]),
              ),
            ),
        ),
      ),
    ];
  }
}
