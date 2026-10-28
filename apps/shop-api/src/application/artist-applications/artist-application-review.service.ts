import {
  type AdminArtistApplicationActionResponse,
  type AdminArtistApplicationDetail,
  type AdminArtistApplicationListQuery,
  SHOP_API_ERROR_CODES,
} from "@auction/shop-contracts";
import {
  type ArtistApplicationAction,
  type ArtistApplicationStatus,
  artistApplicationReapplyDate,
  assertMessageToArtist,
  transitionArtistApplication,
} from "@auction/shop-domain";
import { ShopApiError, notFound } from "../../errors/shop-api-error.js";
import { StaleVersionError } from "../../errors/stale-version-error.js";
import type {
  ArtistApplicationQueueCursor,
  ArtistApplicationQueueFilters,
  ArtistApplicationQueueReader,
  ArtistApplicationRecord,
  ArtistApplicationReviewers,
  ArtistApplicationTx,
  ArtistApplicationUnitOfWork,
  Clock,
} from "./artist-application.ports.js";

/** Every staff action is audited under the capability that allowed it. */
const CAPABILITY = "artist_application.review";
const AUDIT_TARGET = "shop_artist_application";

type StaffCommand = { actorSubjectId: string; applicationId: string; expectedVersion: number };

function encodeCursor(cursor: ArtistApplicationQueueCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor(value: string | undefined): ArtistApplicationQueueCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as ArtistApplicationQueueCursor).submittedAt === "string" &&
      typeof (parsed as ArtistApplicationQueueCursor).id === "string"
    ) {
      return parsed as ArtistApplicationQueueCursor;
    }
  } catch {
    // Fall through to the validation error.
  }
  throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, "The page link is not valid", 400);
}

function resolveAssignee(
  value: string | undefined,
  actorSubjectId: string,
): ArtistApplicationQueueFilters["assignee"] {
  if (value === undefined) return undefined;
  if (value === "unassigned") return { type: "unassigned" };
  return { type: "subject", subject: value === "me" ? actorSubjectId : value };
}

/**
 * Staff review of applications: the queue, the record, and the four decisions (assign, ask for
 * more, accept, decline). The transition table in the domain decides what is allowed; this
 * service checks the version, records the event and the audit entry, and queues the email in the
 * same transaction, so a change and its notice are never separated.
 */
export function createArtistApplicationReviewService(deps: {
  uow: ArtistApplicationUnitOfWork;
  queue: ArtistApplicationQueueReader;
  reviewers: ArtistApplicationReviewers;
  clock: Clock;
}) {
  const { uow, queue, reviewers, clock } = deps;

  async function lockForStaff(
    tx: ArtistApplicationTx,
    command: StaffCommand,
  ): Promise<ArtistApplicationRecord> {
    const record = await tx.applications.lock(command.applicationId);
    if (!record || record.status === "draft") throw notFound("Application not found");
    if (record.version !== command.expectedVersion) {
      throw new StaleVersionError("This application", String(record.version));
    }
    return record;
  }

  async function record(
    tx: ArtistApplicationTx,
    input: {
      command: StaffCommand;
      action: ArtistApplicationAction;
      before: ArtistApplicationRecord;
      after: Record<string, unknown>;
      message?: string | null;
      assigneeSubject?: string | null;
    },
  ): Promise<void> {
    await tx.applications.appendEvent({
      applicationId: input.before.id,
      action: input.action,
      actorSubjectId: input.command.actorSubjectId,
      message: input.message ?? null,
      assigneeSubject: input.assigneeSubject ?? null,
    });
    await tx.audit.append({
      actorSubjectId: input.command.actorSubjectId,
      capability: CAPABILITY,
      action: `artist_application.${input.action}`,
      targetType: AUDIT_TARGET,
      targetId: input.before.id,
      beforeJson: {
        status: input.before.status,
        assigneeSubject: input.before.assigneeSubject,
      },
      afterJson: input.after,
    });
  }

  async function versionOf(tx: ArtistApplicationTx, id: string): Promise<number> {
    const after = await tx.applications.lock(id);
    if (!after) throw notFound("Application not found");
    return after.version;
  }

  function nameOf(application: ArtistApplicationRecord): string {
    return application.content.artistName ?? "";
  }

  return {
    async list(actorSubjectId: string, query: AdminArtistApplicationListQuery) {
      const q = query.q?.trim();
      const assignee = resolveAssignee(query.assignee, actorSubjectId);
      const page = await queue.list({
        filters: {
          view: query.view ?? "all",
          ...(assignee ? { assignee } : {}),
          ...(q ? { q } : {}),
        },
        cursor: decodeCursor(query.cursor),
        limit: query.limit ?? 50,
        sort: query.sort ?? "submitted_desc",
      });
      return { ...page, nextCursor: page.nextCursor ? encodeCursor(page.nextCursor) : null };
    },

    summary: async () => ({ newCount: await queue.countNew() }),

    reviewers: async () => ({ items: await reviewers.list() }),

    async getDetail(id: string): Promise<AdminArtistApplicationDetail> {
      const detail = await queue.getDetail(id);
      if (!detail) throw notFound("Application not found");
      const reapplyFrom =
        detail.status === "declined" && detail.decidedAt
          ? artistApplicationReapplyDate(new Date(detail.decidedAt)).toISOString()
          : null;
      return { ...detail, reapplyFrom };
    },

    async assign(
      command: StaffCommand & { assigneeSubject: string | null },
    ): Promise<AdminArtistApplicationActionResponse> {
      if (command.assigneeSubject && !(await reviewers.canReview(command.assigneeSubject))) {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.VALIDATION,
          "Choose a member of staff who can review applications",
          400,
        );
      }
      return uow.run(async (tx) => {
        const before = await lockForStaff(tx, command);
        const status = transitionArtistApplication("assign", before.status);
        await tx.applications.setState(before.id, {
          status,
          assigneeSubject: command.assigneeSubject,
        });
        await record(tx, {
          command,
          action: "assign",
          before,
          after: { status, assigneeSubject: command.assigneeSubject },
          assigneeSubject: command.assigneeSubject,
        });
        return { status, version: await versionOf(tx, before.id) };
      });
    },

    async requestInformation(
      command: StaffCommand & { message: string },
    ): Promise<AdminArtistApplicationActionResponse> {
      const message = assertMessageToArtist(command.message);
      return uow.run(async (tx) => {
        const before = await lockForStaff(tx, command);
        const status = transitionArtistApplication("request_info", before.status);
        await tx.applications.setState(before.id, {
          status,
          messageToArtist: message,
          // Whoever asks holds the application while the artist answers.
          assigneeSubject: before.assigneeSubject ?? command.actorSubjectId,
        });
        await record(tx, { command, action: "request_info", before, after: { status }, message });
        if (before.contactEmail) {
          await tx.notifier.moreInformationNeeded({
            to: before.contactEmail,
            reference: before.reference,
            artistName: nameOf(before),
            message,
          });
        }
        return { status, version: await versionOf(tx, before.id) };
      });
    },

    async decline(
      command: StaffCommand & { reason: string },
    ): Promise<AdminArtistApplicationActionResponse> {
      const reason = assertMessageToArtist(command.reason);
      return uow.run(async (tx) => {
        const before = await lockForStaff(tx, command);
        const status: ArtistApplicationStatus = transitionArtistApplication(
          "decline",
          before.status,
        );
        const decidedAt = clock.now();
        await tx.applications.setState(before.id, { status, messageToArtist: reason, decidedAt });
        await record(tx, {
          command,
          action: "decline",
          before,
          after: { status },
          message: reason,
        });
        if (before.contactEmail) {
          await tx.notifier.declined({
            to: before.contactEmail,
            reference: before.reference,
            artistName: nameOf(before),
            reason,
            reapplyFrom: artistApplicationReapplyDate(decidedAt),
          });
        }
        return { status, version: await versionOf(tx, before.id) };
      });
    },

    /**
     * Makes the applicant a gallery artist in one transaction: the profile, portal access for
     * their account, the works as drafts when asked, the decision and the welcome email. Any
     * refusal (a taken address, an account already linked to another artist) undoes all of it.
     */
    async accept(
      command: StaffCommand & { artistSlug: string; importWorksAsDrafts: boolean },
    ): Promise<AdminArtistApplicationActionResponse> {
      return uow.run(async (tx) => {
        const before = await lockForStaff(tx, command);
        const status = transitionArtistApplication("accept", before.status);
        const displayName = before.content.artistName?.trim();
        if (!displayName) {
          throw new ShopApiError(
            SHOP_API_ERROR_CODES.VALIDATION,
            "The application has no artist name to make a profile from",
            400,
          );
        }
        const artist = await tx.onboarding.createArtistProfile({
          applicationId: before.id,
          displayName,
          slug: command.artistSlug,
          shortBio: before.content.shortBio,
          bio: before.content.statement,
          actorSubjectId: command.actorSubjectId,
        });
        await tx.onboarding.grantPortalAccess({
          applicationId: before.id,
          artistId: artist.artistId,
          identitySubjectId: before.applicantSubjectId,
          actorSubjectId: command.actorSubjectId,
        });
        const importedArtworkCount = command.importWorksAsDrafts
          ? await tx.onboarding.importDraftArtworks({
              applicationId: before.id,
              artistId: artist.artistId,
              artistSlug: artist.slug,
              works: before.content.works,
              actorSubjectId: command.actorSubjectId,
            })
          : 0;
        await tx.applications.setState(before.id, {
          status,
          artistId: artist.artistId,
          messageToArtist: null,
          decidedAt: clock.now(),
        });
        await record(tx, {
          command,
          action: "accept",
          before,
          after: { status, artistId: artist.artistId, importedArtworkCount },
        });
        if (before.contactEmail) {
          await tx.notifier.welcome({
            to: before.contactEmail,
            reference: before.reference,
            artistName: displayName,
            artistSlug: artist.slug,
          });
        }
        return {
          status,
          version: await versionOf(tx, before.id),
          artistId: artist.artistId,
          importedArtworkCount,
        };
      });
    },
  };
}

export type ArtistApplicationReviewService = ReturnType<
  typeof createArtistApplicationReviewService
>;
