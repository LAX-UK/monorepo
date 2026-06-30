import { firstString, parseListSearchParams } from "@/lib/admin/admin-list-params";
import type { AdminListQueryBase, IAdminListController } from "@/lib/admin/i-admin-list-controller";
import { getAdminSubmissions } from "@/lib/data/http/submissions.server";
import type { ItemSubmission } from "@auction/types";

export type SubmissionDecisionQueue = "awaiting" | "accepted" | "rejected";

export type SubmissionsListQuery = AdminListQueryBase & {
  /** Decision-queue tabs. Maps to grouped statuses via API `queue`. */
  queue?: SubmissionDecisionQueue | undefined;
  categoryId?: string | undefined;
  /** When true, only rows with quality warnings or missing required fields. */
  qualityGaps?: boolean | undefined;
  /** When true, only submissions assigned to the signed-in staff member. */
  assignedToMe?: boolean | undefined;
  sort?: "sla" | undefined;
};

export const submissionsListController: IAdminListController<ItemSubmission, SubmissionsListQuery> =
  {
    id: "submissions",
    parseQuery(sp) {
      const { sort: _baseSort, ...base } = parseListSearchParams(sp);
      const qt = firstString(sp.queue);
      const queueAllowed: SubmissionDecisionQueue[] = ["awaiting", "accepted", "rejected"];
      const queueExplicit =
        qt && (queueAllowed as readonly string[]).includes(qt)
          ? (qt as SubmissionDecisionQueue)
          : undefined;
      const queue = queueExplicit ?? ("awaiting" as SubmissionDecisionQueue);
      const limit = base.limit === 50 ? 100 : Math.min(100, base.limit);
      const categoryId = firstString(sp.categoryId);
      const qualityGaps = firstString(sp.qualityGaps) === "1";
      const assignedToMe = firstString(sp.assignedTo) === "me";
      const sortSla = firstString(sp.sort) === "sla";
      return {
        ...base,
        queue,
        limit,
        ...(categoryId ? { categoryId } : {}),
        ...(qualityGaps ? { qualityGaps: true } : {}),
        ...(assignedToMe ? { assignedToMe: true } : {}),
        ...(sortSla ? { sort: "sla" as const } : {}),
      };
    },
    async fetch(q) {
      const p: Parameters<typeof getAdminSubmissions>[0] = {
        limit: q.limit,
        offset: q.offset,
        queue: q.queue ?? "awaiting",
      };
      if (q.q !== undefined && q.q !== "") p.q = q.q;
      if (q.categoryId) p.categoryId = q.categoryId;
      if (q.qualityGaps) p.qualityGaps = true;
      if (q.assignedToMe) p.assignedTo = "me";
      if (q.sort) p.sort = q.sort;
      const { rows, total } = await getAdminSubmissions(p);
      return { rows, offset: q.offset, limit: q.limit, total };
    },
  };
