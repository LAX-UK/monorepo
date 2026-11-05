import { purchaseProblemTransitionRefusal } from "@auction/domain";
import type {
  IPurchaseProblemDeskRepository,
  IPurchaseProblemNoteRepository,
  ITransactionRunner,
  PurchaseProblemChange,
  PurchaseProblemDeskRecord,
} from "@auction/persistence/interfaces";
import type { AdminPurchaseProblemListQuery, AdminPurchaseProblemPatch } from "@auction/validators";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type {
  IPurchaseProblemDesk,
  PurchaseProblemListPage,
  PurchaseProblemUpdateError,
  PurchaseProblemUpdateResult,
  PurchaseProblemView,
} from "../interfaces/purchase-problem-desk-service.js";
import type { IEnquiryAssigneeDirectory } from "../marketing-enquiry/enquiry-assignee-directory.js";
import { toListItem, toView } from "./purchase-problem-view.js";

export type PurchaseProblemDeskServiceDeps = {
  problems: IPurchaseProblemDeskRepository;
  notes: IPurchaseProblemNoteRepository;
  assignees: IEnquiryAssigneeDirectory;
  transactionRunner: ITransactionRunner;
  events: IDomainEventSink;
  now: () => Date;
};

const AGGREGATE = "purchase_problem" as const;

/**
 * Staff work on buyers' purchase problems here: list them by status and sale, take one on, hand
 * it to a colleague, add internal notes and resolve it. Resolving needs a note saying what was
 * done. Every change is made against the version the person was looking at, and each assignment,
 * status change and note is a domain event, so the Audit log shows who did what.
 */
export class PurchaseProblemDeskService implements IPurchaseProblemDesk {
  constructor(private readonly deps: PurchaseProblemDeskServiceDeps) {}

  async list(query: AdminPurchaseProblemListQuery): Promise<PurchaseProblemListPage> {
    const filters = {
      ...(query.saleId ? { saleId: query.saleId } : {}),
      ...(query.assignee ? { assignee: query.assignee } : {}),
      ...(query.q ? { search: query.q } : {}),
    };
    const [{ rows, total }, counts, sales] = await Promise.all([
      this.deps.problems.list({
        ...filters,
        status: query.status,
        limit: query.limit,
        offset: (query.page - 1) * query.limit,
      }),
      this.deps.problems.counts(filters),
      this.deps.problems.salesWithReports(),
    ]);
    return {
      items: rows.map(toListItem),
      total,
      page: query.page,
      pageSize: query.limit,
      counts,
      sales,
    };
  }

  async detail(id: string): Promise<PurchaseProblemView | null> {
    const record = await this.deps.problems.findById(id);
    return record ? toView(record, await this.deps.notes.listForProblem(id)) : null;
  }

  assignees() {
    return this.deps.assignees.list();
  }

  async update(
    actorUserId: string,
    id: string,
    patch: AdminPurchaseProblemPatch,
  ): Promise<PurchaseProblemUpdateResult> {
    const existing = await this.deps.problems.findById(id);
    if (!existing) return { ok: false, error: "purchase_problem_not_found" };
    if (existing.version !== patch.version) {
      return { ok: false, error: "stale_version", currentVersion: existing.version };
    }
    const refusal = await this.refusalFor(existing, patch);
    if (refusal) return { ok: false, error: refusal };

    const change = this.changeFor(existing, patch, actorUserId);
    const updated = await this.deps.transactionRunner.runInTransaction(async (tx) => {
      const record = await this.deps.problems.updateInTransaction(tx, id, patch.version, change);
      if (!record) return null;
      if (patch.note) {
        await this.deps.notes.addInTransaction(tx, {
          purchaseProblemId: id,
          authorUserId: actorUserId,
          body: patch.note,
        });
      }
      await this.publishChanges(this.deps.events.withTx(tx), existing, record, patch, actorUserId);
      return record;
    });
    if (!updated) {
      const current = await this.deps.problems.findById(id);
      return {
        ok: false,
        error: "stale_version",
        ...(current ? { currentVersion: current.version } : {}),
      };
    }
    return { ok: true, problem: toView(updated, await this.deps.notes.listForProblem(id)) };
  }

  private async refusalFor(
    existing: PurchaseProblemDeskRecord,
    patch: AdminPurchaseProblemPatch,
  ): Promise<PurchaseProblemUpdateError | null> {
    const reassigns =
      patch.assignedToUserId !== undefined && patch.assignedToUserId !== existing.assignedToUserId;
    if (patch.status === undefined && !reassigns && patch.note === undefined) return "unchanged";
    if (patch.status !== undefined) {
      const refusal = purchaseProblemTransitionRefusal({
        from: existing.status,
        to: patch.status,
        note: patch.note,
      });
      if (refusal) return refusal;
    }
    if (reassigns) {
      if (existing.status === "resolved") return "not_allowed";
      const target = patch.assignedToUserId;
      if (target && !(await this.deps.assignees.isStaff(target))) return "assignee_invalid";
    }
    return null;
  }

  private changeFor(
    existing: PurchaseProblemDeskRecord,
    patch: AdminPurchaseProblemPatch,
    actorUserId: string,
  ): PurchaseProblemChange {
    const change: PurchaseProblemChange = {};
    if (
      patch.assignedToUserId !== undefined &&
      patch.assignedToUserId !== existing.assignedToUserId
    ) {
      change.assignedToUserId = patch.assignedToUserId;
    }
    if (patch.status !== undefined) {
      change.status = patch.status;
      if (patch.status === "resolved") {
        change.resolved = { at: this.deps.now(), byUserId: actorUserId };
      }
    }
    return change;
  }

  private async publishChanges(
    events: IDomainEventSink,
    before: PurchaseProblemDeskRecord,
    after: PurchaseProblemDeskRecord,
    patch: AdminPurchaseProblemPatch,
    actorUserId: string,
  ): Promise<void> {
    if (after.assignedToUserId !== before.assignedToUserId) {
      await events.publish({
        aggregateType: AGGREGATE,
        aggregateId: after.id,
        eventType: "purchase_problem.assigned",
        payload: {
          problemId: after.id,
          assignedToUserId: after.assignedToUserId,
          previousAssignedToUserId: before.assignedToUserId,
        },
        actorUserId,
      });
    }
    if (after.status !== before.status) {
      await events.publish({
        aggregateType: AGGREGATE,
        aggregateId: after.id,
        eventType: "purchase_problem.status_changed",
        payload: { problemId: after.id, from: before.status, to: after.status },
        actorUserId,
      });
    }
    if (patch.note) {
      await events.publish({
        aggregateType: AGGREGATE,
        aggregateId: after.id,
        eventType: "purchase_problem.note_added",
        payload: { problemId: after.id },
        actorUserId,
      });
    }
  }
}
