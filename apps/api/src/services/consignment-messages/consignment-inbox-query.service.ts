import {
  consignmentInboxAbilities,
  consignmentReference,
  consignmentThreadStatus,
  defaultConsignmentInboxSort,
  firstNameOf,
  replyClock,
  threadAssignee,
} from "@auction/domain";
import type {
  ConsignmentInboxQueryFilter,
  ConsignmentInboxRowRecord,
  ConsignmentThreadFactsRecord,
  IConsignmentInboxReader,
  IConsignmentMessageRepository,
  IConsignmentStaffDirectory,
  IConsignmentThreadFactsReader,
} from "@auction/persistence/interfaces";
import {
  CONSIGNMENT_INBOX_REPLY_ACCESS,
  type StaffRoles,
  type UserRole,
  normalizeStaffRoles,
  primaryStaffRole,
  userHasAccessTo,
} from "@auction/types";
import type {
  ConsignmentAssignableStaff,
  ConsignmentInboxFilter,
  ConsignmentInboxListQuery,
  ConsignmentInboxListResponse,
  ConsignmentInboxRow,
  ConsignmentInboxSummary,
  ConsignmentReplyClockView,
  ConsignmentThreadDetail,
  ConsignmentThreadFacts,
  ConsignmentThreadPeople,
} from "@auction/validators";
import type { ConsignmentMessagePresenter } from "./consignment-message-presenter.js";
import { memberRoleWords } from "./consignment-message-presenter.js";
import type { IImageLinks } from "./consignment-message.ports.js";
import { type ConsignmentMessageOutcome, NOT_FOUND } from "./consignment-message.shared.js";

const EXCERPT_LENGTH = 140;

function excerptOf(body: string, hasAttachment: boolean): string {
  const flat = body.replace(/\s+/g, " ").trim();
  if (flat.length === 0) return hasAttachment ? "Sent a file." : "";
  return flat.length > EXCERPT_LENGTH ? `${flat.slice(0, EXCERPT_LENGTH - 1)}…` : flat;
}

function clockView(awaitingSince: Date, now: Date): ConsignmentReplyClockView {
  const clock = replyClock(awaitingSince, now);
  return {
    state: clock.state,
    waitingSince: awaitingSince.toISOString(),
    dueAt: clock.dueAt.toISOString(),
    waitedMinutes: clock.waitedMinutes,
    remainingMinutes: clock.remainingMinutes,
    overdueMinutes: clock.overdueMinutes,
  };
}

function sentenceCase(words: string): string {
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The filter every inbox read shares, with the person looking. */
export function inboxQueryFilter(
  filter: ConsignmentInboxFilter,
  viewerUserId: string,
): ConsignmentInboxQueryFilter {
  return {
    view: filter.view,
    viewerUserId,
    q: filter.q,
    specialist: filter.specialist,
    sale: filter.sale,
    organisation: filter.organisation,
  };
}

export type ConsignmentInboxQueryDeps = {
  inbox: IConsignmentInboxReader;
  messages: IConsignmentMessageRepository;
  facts: IConsignmentThreadFactsReader;
  staff: IConsignmentStaffDirectory;
  presenter: ConsignmentMessagePresenter;
  images: IImageLinks;
  now?: () => Date;
};

/**
 * What the Bid admin inbox reads: the list with its counts, the numbers behind the tabs and the
 * sidebar, one thread with its side panel, and the colleagues a thread can be given to.
 */
export class ConsignmentInboxQueryService {
  private readonly now: () => Date;

  constructor(private readonly deps: ConsignmentInboxQueryDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async list(
    viewerUserId: string,
    query: ConsignmentInboxListQuery,
  ): Promise<ConsignmentInboxListResponse> {
    const filter = inboxQueryFilter(query, viewerUserId);
    const sort = query.sort ?? defaultConsignmentInboxSort(query.view);
    const now = this.now();
    const [page, facets] = await Promise.all([
      this.deps.inbox.list({ filter, sort, limit: query.limit, offset: query.offset }),
      this.deps.inbox.facets(filter),
    ]);
    const stored = page.rows.map((row) => row.image).filter((image): image is string => !!image);
    const links = stored.length > 0 ? await this.deps.images.resolveAll(stored) : [];
    const linkOf = new Map(stored.map((image, i) => [image, links[i] ?? image]));
    return {
      data: page.rows.map((row) => this.toRow(row, linkOf, now)),
      total: page.total,
      view: query.view,
      sort,
      facets,
    };
  }

  async summary(viewerUserId: string): Promise<ConsignmentInboxSummary> {
    const now = this.now();
    const record = await this.deps.inbox.summary(viewerUserId);
    const oldestMine = record.mineWaitingSince.reduce<Date | null>(
      (oldest, since) => (!oldest || since < oldest ? since : oldest),
      null,
    );
    return {
      unanswered: record.unanswered,
      mine: {
        waiting: record.mineWaitingSince.length,
        overdue: record.mineWaitingSince.filter(
          (since) => replyClock(since, now).state === "overdue",
        ).length,
        oldestWaitingSince: oldestMine ? oldestMine.toISOString() : null,
      },
      unassigned: {
        waiting: record.unassignedWaiting,
        oldestWaitingSince: record.unassignedOldestWaitingSince
          ? record.unassignedOldestWaitingSince.toISOString()
          : null,
        oldestAccountName: record.unassignedOldestAccountName,
      },
    };
  }

  async detail(
    viewer: { userId: string; role: UserRole; staffRoles: StaffRoles | undefined },
    submissionId: string,
  ): Promise<ConsignmentMessageOutcome<ConsignmentThreadDetail>> {
    const subject = await this.deps.messages.findSubject(submissionId);
    if (!subject) return NOT_FOUND;
    const now = this.now();
    const [rows, events, facts] = await Promise.all([
      this.deps.messages.listMessages(submissionId, { kind: "staff" }),
      this.deps.messages.listEvents(submissionId),
      this.deps.facts.readFacts(submissionId),
    ]);
    if (!facts) return NOT_FOUND;
    const thread = subject.thread;
    const status = consignmentThreadStatus({
      closedAt: thread?.closedAt ?? null,
      lastVisibleSide: thread?.lastMessageSide ?? null,
    });
    const abilities = consignmentInboxAbilities(viewer.role, viewer.staffRoles);
    const [messages, imageUrl] = await Promise.all([
      this.deps.presenter.forStaff(rows, {
        viewerUserId: viewer.userId,
        accountName: subject.account?.name ?? null,
        now,
      }),
      this.imageUrl(facts.submission.image),
    ]);
    const lastThreadMessage = [...rows].reverse().find((row) => row.visibility === "thread");
    return {
      ok: true,
      value: {
        submission: {
          id: subject.submissionId,
          title: subject.title,
          reference: consignmentReference(subject.referenceNumber),
          imageUrl,
        },
        account: subject.account
          ? { id: subject.account.id, name: subject.account.name, kind: subject.account.kind }
          : null,
        facts: this.toFacts(facts),
        people: this.toPeople(facts),
        specialist: subject.specialist,
        assignee: threadAssignee({ specialist: subject.specialist, covering: subject.covering }),
        status,
        closed:
          thread?.closedAt != null
            ? { at: thread.closedAt.toISOString(), by: thread.closedBy }
            : null,
        clock:
          status === "waiting_on_us" && thread?.awaitingSince
            ? clockView(thread.awaitingSince, now)
            : null,
        messages,
        events: events.map((event) => ({
          id: event.id,
          kind: event.kind,
          actor: event.actor,
          subject: event.subject,
          at: event.at.toISOString(),
        })),
        unread: rows.filter((row) => row.authorSide === "client" && !row.readAt).length,
        lastMessageId: lastThreadMessage?.id ?? null,
        abilities: {
          canReply: abilities.canReply,
          canAssign: abilities.canAssign,
          canClose: abilities.canClose,
        },
      },
    };
  }

  /** Colleagues who answer client messages, with the open threads each has. */
  async assignees(): Promise<ConsignmentAssignableStaff[]> {
    const staff = await this.deps.staff.listActiveStaff(this.now());
    const eligible = staff.filter((member) =>
      userHasAccessTo("staff", member.roles, CONSIGNMENT_INBOX_REPLY_ACCESS),
    );
    const counts = await this.deps.inbox.openThreadCounts(eligible.map((member) => member.userId));
    return eligible.map((member) => ({
      userId: member.userId,
      name: member.name,
      staffRole: primaryStaffRole(normalizeStaffRoles(member.roles)),
      openCount: counts.get(member.userId) ?? 0,
    }));
  }

  private toRow(
    row: ConsignmentInboxRowRecord,
    linkOf: ReadonlyMap<string, string>,
    now: Date,
  ): ConsignmentInboxRow {
    const status = consignmentThreadStatus({
      closedAt: row.closedAt,
      lastVisibleSide: row.lastMessageSide,
    });
    return {
      submissionId: row.submissionId,
      title: row.title,
      reference: consignmentReference(row.referenceNumber),
      imageUrl: row.image ? (linkOf.get(row.image) ?? row.image) : null,
      sale: row.sale,
      account: row.account,
      clientPerson: row.clientPersonName ? { name: row.clientPersonName } : null,
      lastMessage: {
        side: row.lastMessage.side,
        authorFirstName:
          firstNameOf(row.lastMessage.authorName) ??
          (row.lastMessage.side === "staff" ? "LAX" : "Client"),
        excerpt: excerptOf(row.lastMessage.body, row.lastMessage.hasAttachment),
        hasAttachment: row.lastMessage.hasAttachment,
        at: row.lastMessage.at.toISOString(),
      },
      status,
      unread: row.unreadFromClient > 0,
      clock:
        status === "waiting_on_us" && row.awaitingSince ? clockView(row.awaitingSince, now) : null,
      assignee: threadAssignee({ specialist: row.specialist, covering: row.covering }),
    };
  }

  private async imageUrl(image: string | null): Promise<string | null> {
    if (!image) return null;
    const [url] = await this.deps.images.resolveAll([image]);
    return url ?? image;
  }

  private toFacts(facts: ConsignmentThreadFactsRecord): ConsignmentThreadFacts {
    const { agreement, submission } = facts;
    const artistLine = [submission.medium, submission.yearOfWork]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(", ");
    return {
      stage: submission.status,
      artistLine: artistLine || null,
      sale: facts.sale
        ? {
            id: facts.sale.id,
            name: facts.sale.name,
            startsAt: facts.sale.startsAt ? facts.sale.startsAt.toISOString() : null,
          }
        : null,
      lot: facts.lot,
      estimate:
        agreement && (agreement.estimateLow || agreement.estimateHigh)
          ? {
              low: agreement.estimateLow,
              high: agreement.estimateHigh,
              currency: agreement.currency,
            }
          : null,
      reserve:
        agreement?.reservePrice != null
          ? { amount: agreement.reservePrice, currency: agreement.currency }
          : null,
      agreement: agreement
        ? {
            state: agreement.acceptedAt ? "accepted" : "proposed",
            proposedAt: agreement.proposedAt.toISOString(),
            acceptedAt: agreement.acceptedAt ? agreement.acceptedAt.toISOString() : null,
          }
        : null,
    };
  }

  private toPeople(facts: ConsignmentThreadFactsRecord): ConsignmentThreadPeople {
    return {
      sender: facts.sender
        ? {
            name: facts.sender.name,
            role: facts.sender.memberRole
              ? `${sentenceCase(memberRoleWords(facts.sender.memberRole))}, sent this work`
              : "Sent this work",
          }
        : null,
      alsoNotified: facts.alsoNotified,
      accountConsignmentCount: facts.accountConsignmentCount,
    };
  }
}
