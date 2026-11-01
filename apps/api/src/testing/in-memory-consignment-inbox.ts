import type {
  ConsignmentInboxFacetsRecord,
  ConsignmentInboxQueryFilter,
  ConsignmentInboxRowRecord,
  ConsignmentInboxSummaryRecord,
  IConsignmentInboxReader,
} from "@auction/persistence/interfaces";
import type { InMemoryConsignmentMessages } from "./in-memory-consignment-messages.js";

/**
 * The inbox over the in-memory threads: the views, the specialist filter and the sorts the route
 * tests need. The real filters, search and facets are SQL, checked against a database.
 */
export class InMemoryConsignmentInbox implements IConsignmentInboxReader {
  constructor(private readonly store: InMemoryConsignmentMessages) {}

  private matching(filter: ConsignmentInboxQueryFilter): ConsignmentInboxRowRecord[] {
    const rows: ConsignmentInboxRowRecord[] = [];
    for (const [submissionId, thread] of this.store.threads) {
      const subject = this.store.subjects.get(submissionId);
      if (!subject) continue;
      const visible = this.store.messages
        .filter((m) => m.submissionId === submissionId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const last = visible.find((m) => m.visibility === "thread") ?? visible[0];
      if (!last) continue;
      const assigneeId = thread.covering ?? subject.specialist?.userId ?? null;
      const open = thread.closedAt === null;
      const included =
        filter.view === "unanswered"
          ? open && thread.lastMessageSide === "client"
          : filter.view === "mine"
            ? open && assigneeId === filter.viewerUserId
            : filter.view === "closed"
              ? !open
              : true;
      if (!included) continue;
      if (filter.specialist?.length && !filter.specialist.includes(assigneeId ?? "unassigned")) {
        continue;
      }
      rows.push({
        submissionId,
        title: subject.title,
        referenceNumber: subject.referenceNumber,
        image: null,
        sale: null,
        account: subject.account
          ? { id: subject.account.id, name: subject.account.name, kind: subject.account.kind }
          : null,
        clientPersonName: null,
        closedAt: thread.closedAt,
        awaitingSince: thread.awaitingSince,
        lastMessage: {
          side: last.authorSide,
          authorName: last.authorUserId ? (this.store.names.get(last.authorUserId) ?? null) : null,
          body: last.body,
          hasAttachment: last.attachments.length > 0,
          at: last.createdAt,
        },
        lastMessageSide: thread.lastMessageSide,
        unreadFromClient: visible.filter((m) => m.authorSide === "client" && !m.readAt).length,
        specialist: subject.specialist,
        covering: thread.covering
          ? {
              userId: thread.covering,
              name: this.store.names.get(thread.covering) ?? "A colleague",
            }
          : null,
        coveringUntil: thread.covering ? (thread.coveringUntil ?? null) : null,
      });
    }
    return rows;
  }

  async list(input: {
    filter: ConsignmentInboxQueryFilter;
    sort: string;
    limit: number;
    offset: number;
  }) {
    const rows = this.matching(input.filter).sort((a, b) =>
      input.sort === "waiting"
        ? (a.awaitingSince?.getTime() ?? Number.POSITIVE_INFINITY) -
          (b.awaitingSince?.getTime() ?? Number.POSITIVE_INFINITY)
        : b.lastMessage.at.getTime() - a.lastMessage.at.getTime(),
    );
    return {
      rows: rows.slice(input.offset, input.offset + input.limit),
      total: rows.length,
    };
  }

  async facets(): Promise<ConsignmentInboxFacetsRecord> {
    return { specialist: [], sale: [], organisation: [] };
  }

  async summary(viewerUserId: string): Promise<ConsignmentInboxSummaryRecord> {
    const waiting = this.matching({ view: "unanswered", viewerUserId });
    const mine = waiting.filter((row) => (row.covering ?? row.specialist)?.userId === viewerUserId);
    const unassigned = waiting
      .filter((row) => !row.covering && !row.specialist)
      .sort(
        (a, b) =>
          (a.awaitingSince?.getTime() ?? Number.POSITIVE_INFINITY) -
          (b.awaitingSince?.getTime() ?? Number.POSITIVE_INFINITY),
      );
    return {
      unanswered: waiting.length,
      mineWaitingSince: mine.flatMap((row) => (row.awaitingSince ? [row.awaitingSince] : [])),
      unassignedWaiting: unassigned.length,
      unassignedOldestWaitingSince: unassigned[0]?.awaitingSince ?? null,
      unassignedOldestAccountName: unassigned[0]?.account?.name ?? null,
    };
  }

  async findSubmissionIds(filter: ConsignmentInboxQueryFilter, limit: number): Promise<string[]> {
    return this.matching(filter)
      .slice(0, limit)
      .map((row) => row.submissionId);
  }

  async openThreadCounts(userIds: readonly string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    for (const row of this.matching({ view: "all", viewerUserId: "" })) {
      const assignee = (row.covering ?? row.specialist)?.userId;
      if (assignee && !row.closedAt && userIds.includes(assignee)) {
        counts.set(assignee, (counts.get(assignee) ?? 0) + 1);
      }
    }
    return counts;
  }
}
