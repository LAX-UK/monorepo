import { type EnquiryRoutingRule, diffEnquiryRouting } from "@auction/domain";
import type {
  IEnquiryRoutingRepository,
  ITransactionRunner,
} from "@auction/persistence/interfaces";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type {
  EnquiryRoutingUpdateResult,
  IEnquiryRouting,
} from "../interfaces/marketing-enquiry-service.js";
import type { EnquiryAssignee, IEnquiryAssigneeDirectory } from "./enquiry-assignee-directory.js";

export type EnquiryRoutingServiceDeps = {
  routing: IEnquiryRoutingRepository;
  assignees: IEnquiryAssigneeDirectory;
  transactionRunner: ITransactionRunner;
  events: IDomainEventSink;
};

/**
 * The table that sends each department's enquiries to a specialist, with one fallback. Saving it
 * replaces the whole table and records one domain event per row that changed, with the person who
 * changed it.
 */
export class EnquiryRoutingService implements IEnquiryRouting {
  constructor(private readonly deps: EnquiryRoutingServiceDeps) {}

  rules(): Promise<EnquiryRoutingRule[]> {
    return this.deps.routing.listRules();
  }

  assignees(): Promise<EnquiryAssignee[]> {
    return this.deps.assignees.list();
  }

  async replace(
    actorUserId: string,
    rules: readonly EnquiryRoutingRule[],
  ): Promise<EnquiryRoutingUpdateResult> {
    for (const userId of new Set(rules.map((rule) => rule.assignedToUserId))) {
      if (!(await this.deps.assignees.isStaff(userId))) {
        return { ok: false, error: "assignee_invalid", userId };
      }
    }
    const saved = await this.deps.transactionRunner.runInTransaction(async (tx) => {
      const previous = await this.deps.routing.listRulesInTransaction(tx);
      await this.deps.routing.replaceRulesInTransaction(tx, rules, actorUserId);
      const events = this.deps.events.withTx(tx);
      for (const change of diffEnquiryRouting(previous, rules)) {
        await events.publish({
          aggregateType: "enquiry_routing",
          aggregateId: change.departmentSlug ?? "fallback",
          eventType: "enquiry_routing.changed",
          payload: {
            ...(change.departmentSlug ? { departmentSlug: change.departmentSlug } : {}),
            assignedToUserId: change.assignedToUserId,
            previousAssignedToUserId: change.previousAssignedToUserId,
          },
          actorUserId,
        });
      }
      return this.deps.routing.listRulesInTransaction(tx);
    });
    return { ok: true, rules: saved };
  }
}
