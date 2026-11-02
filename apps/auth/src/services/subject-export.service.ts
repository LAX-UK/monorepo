import type { SecurityNoticePublisher } from "@auction/auth";
import {
  SUBJECT_EXPORT_DOWNLOAD_LINK_SECONDS,
  SUBJECT_EXPORT_MAX_REQUESTS_PER_WINDOW,
  SUBJECT_EXPORT_RATE_LIMIT_WINDOW_DAYS,
  type SubjectExportCreateOutcome,
  type SubjectExportProgress,
  type SubjectExportView,
  subjectExportDueAt,
} from "@auction/identity-contracts";
import type { ReauthRequired } from "./account-contact.service.js";
import type { IdentityOperationsService } from "./identity-operations.service.js";
import { RecentSessionGuard } from "./recent-session-guard.js";
import type {
  SubjectExportReadSigner,
  SubjectExportRepository,
  SubjectExportRequestContext,
  SubjectExportRow,
} from "./subject-export.ports.js";
import {
  deadlineTierFor,
  decideProgress,
  subjectExportObjectPrefix,
  toSubjectExportView,
} from "./subject-export.state.js";

const DAY_MS = 86_400_000;

export type SubjectExportPorts = {
  operations: Pick<IdentityOperationsService, "listSessions">;
  repository: SubjectExportRepository;
  /** Null when the export bucket is not configured: downloads are then unavailable, requests still work. */
  signer: SubjectExportReadSigner | null;
  /** Tells the person by email; it never throws, so a failed notice cannot undo the change. */
  notices: SecurityNoticePublisher;
};

export type SubjectExportProgressResult =
  | "applied"
  | "ignored"
  | "not_found"
  | "invalid_object_key";

export type SubjectExportDownloadResult =
  | { outcome: "signed"; url: string; expiresAt: string }
  /** No such request for this person. */
  | { outcome: "not_found" }
  /** The request exists but is not downloadable now: still preparing, expired, deleted or failed. */
  | { outcome: "unavailable" };

/** Thrown when a download is asked for but no export bucket is configured; callers answer 503. */
export class SubjectExportStorageUnavailableError extends Error {
  constructor() {
    super("The data export bucket is not configured");
    this.name = "SubjectExportStorageUnavailableError";
  }
}

/**
 * "Download my data", decided in one place.
 *
 * LAX Account asks for a copy (with a recent sign-in); Identity records the request with its
 * legal due date, tells the worker through the outbox and tells the person by email. The worker
 * reports progress through the internal route. A finished copy is downloadable for seven days,
 * only by its owner and only after a recent sign-in, through one short-lived signed link that is
 * created at the moment of download and never stored or emailed.
 */
export class SubjectExportService {
  private readonly sessions: RecentSessionGuard;

  constructor(
    private readonly ports: SubjectExportPorts,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.sessions = new RecentSessionGuard(ports.operations, now);
  }

  /** The person's latest request, or null when they have never asked. */
  async current(subjectId: string): Promise<SubjectExportView | null> {
    const row = await this.ports.repository.findLatest(subjectId);
    return row ? toSubjectExportView(row, this.now()) : null;
  }

  /** Account's request: needs a sign-in from the last few minutes. */
  async request(
    subjectId: string,
    context: SubjectExportRequestContext,
  ): Promise<ReauthRequired | { ok: true; outcome: SubjectExportCreateOutcome }> {
    if (!(await this.sessions.findRecent(subjectId, context.sessionId))) {
      return { ok: false, reason: "reauth_required" };
    }
    const requestedAt = this.now();
    const result = await this.ports.repository.createIfAllowed({
      subjectId,
      requestedAt,
      dueAt: subjectExportDueAt(requestedAt),
      windowStart: new Date(requestedAt.getTime() - SUBJECT_EXPORT_RATE_LIMIT_WINDOW_DAYS * DAY_MS),
      maxPerWindow: SUBJECT_EXPORT_MAX_REQUESTS_PER_WINDOW,
      windowDays: SUBJECT_EXPORT_RATE_LIMIT_WINDOW_DAYS,
      context,
    });
    if (result.outcome === "rate_limited") {
      return {
        ok: true,
        outcome: { outcome: "rate_limited", retryAfter: result.retryAfter.toISOString() },
      };
    }
    if (result.outcome === "requested") {
      await this.ports.notices.notify({
        kind: "data_export_requested",
        userId: subjectId,
        at: requestedAt,
        userAgent: context.userAgent,
      });
    }
    return {
      ok: true,
      outcome: { outcome: result.outcome, export: toSubjectExportView(result.row, this.now()) },
    };
  }

  /**
   * One signed GET for one object. Re-checks the recent sign-in, the owner, the status and the
   * expiry at this moment, and records the download before the link is released.
   */
  async download(
    subjectId: string,
    exportId: string,
    context: SubjectExportRequestContext,
  ): Promise<ReauthRequired | { ok: true; result: SubjectExportDownloadResult }> {
    if (!(await this.sessions.findRecent(subjectId, context.sessionId))) {
      return { ok: false, reason: "reauth_required" };
    }
    const row = await this.ports.repository.findById(exportId);
    if (!row || row.subjectId !== subjectId) return { ok: true, result: { outcome: "not_found" } };
    if (!this.isDownloadable(row)) return { ok: true, result: { outcome: "unavailable" } };
    if (!this.ports.signer) throw new SubjectExportStorageUnavailableError();
    const objectKey = row.objectKey;
    if (!objectKey) return { ok: true, result: { outcome: "unavailable" } };

    const now = this.now();
    const link = await this.ports.signer.signDownload({
      objectKey,
      fileName: row.fileName ?? "lax-data.zip",
      expiresInSec: SUBJECT_EXPORT_DOWNLOAD_LINK_SECONDS,
      now,
    });
    // Re-checked under the row lock, so a copy deleted or expired while signing is not released.
    const recorded = await this.ports.repository.mutate(exportId, (locked) =>
      locked.subjectId === subjectId && this.isDownloadable(locked)
        ? {
            patch: { downloadCount: locked.downloadCount + 1 },
            audit: [
              {
                event: "data_export.downloaded",
                sessionId: context.sessionId,
                ipAddress: context.ipAddress,
                userAgent: context.userAgent,
              },
            ],
          }
        : null,
    );
    if (!recorded) return { ok: true, result: { outcome: "unavailable" } };
    return {
      ok: true,
      result: { outcome: "signed", url: link.url, expiresAt: link.expiresAt.toISOString() },
    };
  }

  /**
   * "Delete this copy": marks it deleted and queues the stored file for deletion. Like
   * cancelling a deletion it only takes something away, so a live sign-in is enough.
   */
  async deleteCopy(
    subjectId: string,
    exportId: string,
    sessionId: string,
  ): Promise<ReauthRequired | { ok: true; outcome: "deleted" | "not_found" }> {
    const live = await this.sessions.liveSessions(subjectId);
    if (!live.some((session) => session.id === sessionId)) {
      return { ok: false, reason: "reauth_required" };
    }
    const now = this.now();
    const changed = await this.ports.repository.mutate(exportId, (row) =>
      row.subjectId === subjectId && row.status === "ready"
        ? {
            patch: { status: "deleted", deletedAt: now },
            queueObjectPurge: true,
            audit: [
              {
                event: "data_export.deleted_by_subject",
                sessionId,
                detail: { objectPurgeQueued: true },
              },
            ],
          }
        : null,
    );
    return { ok: true, outcome: changed ? "deleted" : "not_found" };
  }

  /** What the worker reports. Applied once; a repeated or out-of-state report changes nothing. */
  async applyProgress(
    exportId: string,
    report: SubjectExportProgress,
  ): Promise<SubjectExportProgressResult> {
    if (
      report.event === "ready" &&
      !report.objectKey.startsWith(subjectExportObjectPrefix(exportId))
    ) {
      return "invalid_object_key";
    }
    const now = this.now();
    const existing = await this.ports.repository.findById(exportId);
    if (!existing) return "not_found";
    const changed = await this.ports.repository.mutate(exportId, (row) =>
      decideProgress(row, report, now),
    );
    if (!changed) return "ignored";
    if (report.event === "ready" && changed.after.expiresAt) {
      await this.ports.notices.notify({
        kind: "data_export_ready",
        userId: changed.after.subjectId,
        at: now,
        expiresAt: changed.after.expiresAt,
      });
    }
    return "applied";
  }

  /** Marks copies past their expiry as expired; returns how many. The stored files are queued for deletion. */
  async expireDue(limit = 100): Promise<number> {
    return (await this.ports.repository.expireDue(this.now(), limit)).length;
  }

  /** Requests still being prepared that crossed a new overdue tier since the last check. */
  claimDeadlineAlerts(limit = 100): Promise<{ row: SubjectExportRow; tier: number }[]> {
    return this.ports.repository.claimDeadlineAlerts(this.now(), deadlineTierFor, limit);
  }

  private isDownloadable(row: SubjectExportRow): boolean {
    return (
      row.status === "ready" &&
      row.objectKey !== null &&
      row.expiresAt !== null &&
      row.expiresAt.getTime() > this.now().getTime()
    );
  }
}
