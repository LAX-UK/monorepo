import type {
  CreateSubjectExportInput,
  CreateSubjectExportOutcome,
  SubjectExportAuditEntry,
  SubjectExportMutation,
  SubjectExportPendingPurge,
  SubjectExportReadSigner,
  SubjectExportRepository,
  SubjectExportRow,
} from "./subject-export.ports.js";
import { decideCreate, initialProgress, isPreparing } from "./subject-export.state.js";

/** An in-memory repository with the same rules as the database one: one lock-step mutation at a time. */
export class InMemorySubjectExportRepository implements SubjectExportRepository {
  readonly rows: SubjectExportRow[] = [];
  readonly audit: (SubjectExportAuditEntry & { exportId: string })[] = [];
  readonly outbox: { type: string; userId: string; exportId: string }[] = [];
  readonly purgeQueued = new Set<string>();
  readonly purged = new Set<string>();
  private sequence = 0;

  constructor(private readonly now: () => Date = () => new Date()) {}

  seed(row: Partial<SubjectExportRow> & Pick<SubjectExportRow, "subjectId">): SubjectExportRow {
    this.sequence += 1;
    const requestedAt = row.requestedAt ?? this.now();
    const created: SubjectExportRow = {
      id: `00000000-0000-4000-8000-${String(this.sequence).padStart(12, "0")}`,
      status: "requested",
      productProgress: initialProgress(),
      requestedAt,
      dueAt: new Date(requestedAt.getTime() + 30 * 86_400_000),
      readyAt: null,
      expiresAt: null,
      deletedAt: null,
      objectKey: null,
      fileName: null,
      sizeBytes: null,
      sha256: null,
      downloadCount: 0,
      lastErrorCode: null,
      deadlineAlertTier: 0,
      ...row,
    };
    this.rows.push(created);
    return created;
  }

  async createIfAllowed(input: CreateSubjectExportInput): Promise<CreateSubjectExportOutcome> {
    const mine = this.rows
      .filter((row) => row.subjectId === input.subjectId)
      .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
    const decision = decideCreate({
      open: mine.filter((row) =>
        ["requested", "collecting", "delayed", "ready"].includes(row.status),
      ),
      windowRequests: mine.filter((row) => row.requestedAt > input.windowStart),
      max: input.maxPerWindow,
      windowDays: input.windowDays,
    });
    if (decision.kind === "already_open") return { outcome: "already_open", row: decision.row };
    if (decision.kind === "rate_limited") {
      return { outcome: "rate_limited", retryAfter: decision.retryAfter };
    }
    const row = this.seed({
      subjectId: input.subjectId,
      requestedAt: input.requestedAt,
      dueAt: input.dueAt,
    });
    this.outbox.push({
      type: "subject.data_export_requested",
      userId: input.subjectId,
      exportId: row.id,
    });
    this.audit.push({
      exportId: row.id,
      event: "data_export.requested",
      sessionId: input.context.sessionId,
      ipAddress: input.context.ipAddress,
      userAgent: input.context.userAgent,
      detail: { dueAt: input.dueAt.toISOString() },
    });
    return { outcome: "requested", row };
  }

  async findLatest(subjectId: string): Promise<SubjectExportRow | null> {
    const mine = this.rows.filter((row) => row.subjectId === subjectId);
    mine.sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
    return mine[0] ?? null;
  }

  async findById(exportId: string): Promise<SubjectExportRow | null> {
    return this.rows.find((row) => row.id === exportId) ?? null;
  }

  async mutate(
    exportId: string,
    decide: (row: SubjectExportRow) => SubjectExportMutation | null,
  ): Promise<{ before: SubjectExportRow; after: SubjectExportRow } | null> {
    const index = this.rows.findIndex((row) => row.id === exportId);
    const before = this.rows[index];
    if (!before) return null;
    const mutation = decide(before);
    if (!mutation) return null;
    const after = { ...before, ...mutation.patch };
    this.rows[index] = after;
    if (mutation.queueObjectPurge) this.purgeQueued.add(exportId);
    for (const entry of mutation.audit) this.audit.push({ ...entry, exportId });
    return { before, after };
  }

  async listPendingObjectPurges(limit: number): Promise<SubjectExportPendingPurge[]> {
    return [...this.purgeQueued]
      .filter((exportId) => !this.purged.has(exportId))
      .flatMap((exportId) => {
        const objectKey = this.rows.find((row) => row.id === exportId)?.objectKey;
        return objectKey ? [{ exportId, objectKey }] : [];
      })
      .slice(0, limit);
  }

  async markObjectPurged(exportId: string): Promise<boolean> {
    if (!this.purgeQueued.has(exportId) || this.purged.has(exportId)) return false;
    this.purged.add(exportId);
    return true;
  }

  async expireDue(now: Date, limit: number): Promise<SubjectExportRow[]> {
    const expired: SubjectExportRow[] = [];
    for (const [index, row] of this.rows.entries()) {
      if (expired.length >= limit) break;
      if (row.status !== "ready" || !row.expiresAt || row.expiresAt > now) continue;
      const after = { ...row, status: "expired" as const };
      this.rows[index] = after;
      this.purgeQueued.add(row.id);
      this.audit.push({ exportId: row.id, event: "data_export.expired" });
      expired.push(after);
    }
    return expired;
  }

  async claimDeadlineAlerts(
    now: Date,
    tierFor: (row: SubjectExportRow, now: Date) => number,
    limit: number,
  ): Promise<{ row: SubjectExportRow; tier: number }[]> {
    const claimed: { row: SubjectExportRow; tier: number }[] = [];
    for (const [index, row] of this.rows.entries()) {
      if (claimed.length >= limit || !isPreparing(row.status)) continue;
      const tier = tierFor(row, now);
      if (tier <= row.deadlineAlertTier) continue;
      const after = { ...row, deadlineAlertTier: tier };
      this.rows[index] = after;
      claimed.push({ row: after, tier });
    }
    return claimed;
  }
}

export class FakeReadSigner implements SubjectExportReadSigner {
  readonly signed: { objectKey: string; fileName: string; expiresInSec: number; now: Date }[] = [];

  async signDownload(input: {
    objectKey: string;
    fileName: string;
    expiresInSec: number;
    now: Date;
  }) {
    this.signed.push(input);
    return {
      url: `https://bucket.example/${input.objectKey}?sig=${this.signed.length}`,
      expiresAt: new Date(input.now.getTime() + input.expiresInSec * 1_000),
    };
  }
}
