import { canViewEnquiry, enquiryTransitionRefusal } from "@auction/domain";
import type {
  IEnquiryNoteRepository,
  IMarketingEnquiryRepository,
  ITransactionRunner,
  MarketingEnquiryChange,
  MarketingEnquiryRecord,
} from "@auction/persistence/interfaces";
import type { AdminEnquiryListQuery, AdminEnquiryPatch } from "@auction/validators";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type {
  EnquiryStaffViewer,
  EnquiryUpdateResult,
  IMarketingEnquiryDesk,
  MarketingEnquiryHandledResult,
  MarketingEnquiryListPage,
  MarketingEnquiryView,
} from "../interfaces/marketing-enquiry-service.js";
import type { IEnquiryAssigneeDirectory } from "./enquiry-assignee-directory.js";
import { decodeEnquiryCursor, encodeEnquiryCursor } from "./enquiry-cursor.js";
import { toListItem, toView } from "./enquiry-view.js";

export type EnquiryDeskServiceDeps = {
  enquiries: IMarketingEnquiryRepository;
  notes: IEnquiryNoteRepository;
  assignees: IEnquiryAssigneeDirectory;
  transactionRunner: ITransactionRunner;
  events: IDomainEventSink;
  now: () => Date;
};

const ENQUIRY = "marketing_enquiry" as const;

/**
 * Staff work on enquiries here. Who may see an enquiry is decided in this service, not in the
 * routes: a private sale enquiry is invisible to roles without private sale access, whether they
 * ask for it by reference, list it, or are assigned it. Every change is made against the version the
 * person was looking at, and each assignment and status change is an audited domain event.
 */
export class EnquiryDeskService implements IMarketingEnquiryDesk {
  constructor(private readonly deps: EnquiryDeskServiceDeps) {}

  async list(
    viewer: EnquiryStaffViewer,
    query: AdminEnquiryListQuery,
  ): Promise<MarketingEnquiryListPage> {
    const rows = await this.deps.enquiries.list({
      view: query.view,
      scope: {
        viewerUserId: viewer.userId,
        readsGeneral: viewer.readsGeneral,
        readsPrivateSale: viewer.readsPrivateSale,
      },
      intent: query.kind,
      departmentSlug: query.department,
      status: query.status,
      assignee: query.assignee,
      afterId: query.cursor ? decodeEnquiryCursor(query.cursor) : null,
      limit: query.limit,
    });
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return {
      items: page.map(toListItem),
      nextCursor: rows.length > query.limit && last ? encodeEnquiryCursor(last) : null,
    };
  }

  async detail(viewer: EnquiryStaffViewer, ref: string): Promise<MarketingEnquiryView | null> {
    const record = await this.deps.enquiries.findByRef(ref);
    if (!record || !canViewEnquiry(record, viewer)) return null;
    return toView(record, await this.deps.notes.listForEnquiry(record.id));
  }

  async update(
    viewer: EnquiryStaffViewer,
    actorUserId: string,
    ref: string,
    patch: AdminEnquiryPatch,
  ): Promise<EnquiryUpdateResult> {
    const existing = await this.deps.enquiries.findByRef(ref);
    if (!existing || !canViewEnquiry(existing, viewer)) {
      return { ok: false, error: "enquiry_not_found" };
    }
    if (existing.version !== patch.version) {
      return { ok: false, error: "stale_version", currentVersion: existing.version };
    }
    const refusal = await this.refusalFor(viewer, existing, patch);
    if (refusal) return { ok: false, error: refusal };

    const change = this.changeFor(existing, patch, actorUserId);
    const updated = await this.deps.transactionRunner.runInTransaction(async (tx) => {
      const record = await this.deps.enquiries.updateInTransaction(
        tx,
        existing.id,
        patch.version,
        change,
      );
      if (!record) return null;
      if (patch.note) {
        await this.deps.notes.addInTransaction(tx, {
          enquiryId: record.id,
          authorUserId: actorUserId,
          body: patch.note,
        });
      }
      await this.publishChanges(this.deps.events.withTx(tx), existing, record, actorUserId);
      return record;
    });
    if (!updated) {
      const current = await this.deps.enquiries.findById(existing.id);
      return {
        ok: false,
        error: "stale_version",
        ...(current ? { currentVersion: current.version } : {}),
      };
    }
    return { ok: true, enquiry: toView(updated, await this.deps.notes.listForEnquiry(updated.id)) };
  }

  async markHandled(
    viewer: EnquiryStaffViewer,
    id: string,
    actorUserId: string,
  ): Promise<MarketingEnquiryHandledResult> {
    const existing = await this.deps.enquiries.findById(id);
    if (!existing || !canViewEnquiry(existing, viewer)) {
      return { ok: false, error: "enquiry_not_found" };
    }
    const updated = await this.deps.transactionRunner.runInTransaction(async (tx) => {
      const record = await this.deps.enquiries.markHandledInTransaction(
        tx,
        id,
        actorUserId,
        this.deps.now(),
      );
      if (!record) return null;
      await this.deps.events.withTx(tx).publish({
        aggregateType: ENQUIRY,
        aggregateId: record.id,
        eventType: "marketing_enquiry.handled",
        payload: { enquiryId: record.id, intent: record.intent },
        actorUserId,
      });
      return record;
    });
    if (!updated) return { ok: false, error: "already_handled" };
    return { ok: true, enquiry: toView(updated) };
  }

  /** Why this change may not be made, or null. */
  private async refusalFor(
    viewer: EnquiryStaffViewer,
    existing: MarketingEnquiryRecord,
    patch: AdminEnquiryPatch,
  ): Promise<Exclude<EnquiryUpdateResult, { ok: true }>["error"] | null> {
    if (patch.status === undefined && patch.closeReason !== undefined) {
      return "close_reason_without_status";
    }
    if (patch.status !== undefined) {
      const refusal = enquiryTransitionRefusal({
        from: existing.status,
        to: patch.status,
        intent: existing.intent,
        closeReason: patch.closeReason,
        manual: true,
      });
      if (refusal) return refusal;
    }
    if (patch.assignedToUserId !== undefined) {
      if (!viewer.canAssign) return "assign_forbidden";
      const target = patch.assignedToUserId;
      if (target !== null && !(await this.deps.assignees.isStaff(target))) {
        return "assignee_invalid";
      }
    }
    return null;
  }

  private changeFor(
    existing: MarketingEnquiryRecord,
    patch: AdminEnquiryPatch,
    actorUserId: string,
  ): MarketingEnquiryChange {
    const change: MarketingEnquiryChange = {};
    if (
      patch.assignedToUserId !== undefined &&
      patch.assignedToUserId !== existing.assignedToUserId
    ) {
      change.assignedToUserId = patch.assignedToUserId;
    }
    if (patch.status !== undefined) {
      change.status = patch.status;
      change.closeReason = patch.status === "closed" ? (patch.closeReason ?? null) : null;
      change.closed =
        patch.status === "closed" ? { at: this.deps.now(), byUserId: actorUserId } : null;
    }
    return change;
  }

  private async publishChanges(
    events: IDomainEventSink,
    before: MarketingEnquiryRecord,
    after: MarketingEnquiryRecord,
    actorUserId: string,
  ): Promise<void> {
    if (after.assignedToUserId !== before.assignedToUserId) {
      await events.publish({
        aggregateType: ENQUIRY,
        aggregateId: after.id,
        eventType: "marketing_enquiry.assigned",
        payload: {
          enquiryId: after.id,
          intent: after.intent,
          assignedToUserId: after.assignedToUserId,
          previousAssignedToUserId: before.assignedToUserId,
          source: "staff",
        },
        actorUserId,
      });
    }
    if (after.status !== before.status) {
      await events.publish({
        aggregateType: ENQUIRY,
        aggregateId: after.id,
        eventType:
          after.status === "converted"
            ? "marketing_enquiry.converted"
            : "marketing_enquiry.status_changed",
        payload:
          after.status === "converted"
            ? { enquiryId: after.id, intent: after.intent, from: before.status }
            : {
                enquiryId: after.id,
                intent: after.intent,
                from: before.status,
                to: after.status,
                ...(after.closeReason ? { closeReason: after.closeReason } : {}),
              },
        actorUserId,
      });
    }
  }
}
