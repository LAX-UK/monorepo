import type {
  CloseDataRequestInput,
  CreateDataRequestInput,
  DataRequestListQuery,
  ExtendDataRequestInput,
  PatchDataRequestInput,
} from "@auction/identity-contracts";
import type {
  DataRequestOutcome,
  IIdentityDataRequestsClient,
} from "../../interfaces/identity-data-requests-client.js";
import type { DataRequestAuditAction, IDataRequestAuditTrail } from "./data-request-audit-trail.js";

type Body<T> = Omit<T, "actorSubjectId">;

export type AdminDataRequestsDeps = {
  identity: IIdentityDataRequestsClient;
  audit: IDataRequestAuditTrail;
};

/**
 * Bid admin's Data requests. Identity owns the requests and the rules; this service adds who is
 * acting and Bid's own audit trail. Opening a record and every action is audited with the staff
 * member and the reference before Identity is called, so a person's details are never shown
 * without a trace. A new request has no reference until Identity creates it, so it is audited
 * straight after. The audit rows hold the reference and the action, never contact details or notes.
 */
export class AdminDataRequestsService {
  constructor(private readonly deps: AdminDataRequestsDeps) {}

  list(query: DataRequestListQuery) {
    return this.deps.identity.list(query);
  }

  summary() {
    return this.deps.identity.summary();
  }

  async record(reference: string, actorUserId: string) {
    await this.audit("viewed", reference, actorUserId);
    return this.deps.identity.record(reference, actorUserId);
  }

  async create(body: Body<CreateDataRequestInput>, actorUserId: string) {
    const outcome = await this.deps.identity.create({ ...body, actorSubjectId: actorUserId });
    if (outcome.ok) await this.audit("logged", outcome.value.request.reference, actorUserId);
    return outcome;
  }

  async patch(reference: string, body: Body<PatchDataRequestInput>, actorUserId: string) {
    await this.audit("updated", reference, actorUserId);
    return this.deps.identity.patch(reference, { ...body, actorSubjectId: actorUserId });
  }

  async extend(reference: string, body: Body<ExtendDataRequestInput>, actorUserId: string) {
    await this.audit("extended", reference, actorUserId);
    return this.deps.identity.extend(reference, { ...body, actorSubjectId: actorUserId });
  }

  async close(reference: string, body: Body<CloseDataRequestInput>, actorUserId: string) {
    await this.audit("closed", reference, actorUserId);
    return this.deps.identity.close(reference, { ...body, actorSubjectId: actorUserId });
  }

  async continueDownload(reference: string, actorUserId: string) {
    await this.audit("continued", reference, actorUserId);
    return this.deps.identity.continueDownload(reference, actorUserId);
  }

  private audit(action: DataRequestAuditAction, reference: string, actorUserId: string) {
    return this.deps.audit.record({ action, reference, actorUserId });
  }
}

export type { DataRequestOutcome };
