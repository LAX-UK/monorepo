import type {
  CloseDataRequestInput,
  CreateDataRequestInput,
  DataRequestListQuery,
  ExtendDataRequestInput,
  PatchDataRequestInput,
} from "@auction/identity-contracts";
import { enquiryErasureBlock } from "@auction/identity-contracts";
import type {
  DataRequestOutcome,
  IIdentityDataRequestsClient,
} from "../../interfaces/identity-data-requests-client.js";
import type { IEnquiryErasure } from "../../marketing-enquiry/enquiry-erasure.service.js";
import type { DataRequestAuditAction, IDataRequestAuditTrail } from "./data-request-audit-trail.js";

type Body<T> = Omit<T, "actorSubjectId">;

/** A LAX account found by its full email address, for the Log dialog. */
export type DataRequestAccount = { subjectId: string; name: string; status: string };

/** Finds the person a staff-logged request is about. Narrow on purpose: one exact email, one account. */
export interface IDataRequestAccountFinder {
  findByEmail(email: string): Promise<DataRequestAccount | null>;
}

export type AdminDataRequestsDeps = {
  identity: IIdentityDataRequestsClient;
  audit: IDataRequestAuditTrail;
  accounts: IDataRequestAccountFinder;
  enquiryErasure: IEnquiryErasure;
};

/** What an erasure answers with: the counts the erasure service reports. */
export type EnquiryErasureCounts = Omit<
  Extract<Awaited<ReturnType<IEnquiryErasure["eraseByEmail"]>>, { ok: true }>,
  "ok"
>;

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

  /** Exact email only: never a partial match, so the dialog cannot be used to browse accounts. */
  findAccount(email: string) {
    return this.deps.accounts.findByEmail(email.trim().toLowerCase());
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

  /**
   * Erases the enquiries from the request's own email address. The address and the request's
   * state come from Identity, never from the caller: only a manual request being worked on, about
   * someone else, with an email address, may erase. The typed confirmation is compared with that
   * address. The erasure's audit event names the request, and the request's timeline records it.
   */
  async eraseEnquiries(
    reference: string,
    body: { confirmation: string; reason: string },
    actorUserId: string,
  ): Promise<DataRequestOutcome<EnquiryErasureCounts>> {
    const found = await this.deps.identity.record(reference, actorUserId);
    if (!found.ok) return found;
    const { request, person, ownRequest } = found.value;
    if (ownRequest) return { ok: false, status: 403, error: "own_request" };
    const blocked = enquiryErasureBlock(request);
    if (blocked) return { ok: false, status: 409, error: "erasure_not_allowed" };
    if (!person.email) return { ok: false, status: 422, error: "no_email" };
    const outcome = await this.deps.enquiryErasure.eraseByEmail({
      email: person.email,
      confirmation: body.confirmation,
      reason: body.reason,
      actorUserId,
      requestReference: request.reference,
    });
    if (!outcome.ok) return { ok: false, status: 422, error: outcome.error };
    await this.audit("enquiries_erased", request.reference, actorUserId);
    const { ok: _ok, ...counts } = outcome;
    return { ok: true, value: counts };
  }

  private audit(action: DataRequestAuditAction, reference: string, actorUserId: string) {
    return this.deps.audit.record({ action, reference, actorUserId });
  }
}

export type { DataRequestOutcome };
