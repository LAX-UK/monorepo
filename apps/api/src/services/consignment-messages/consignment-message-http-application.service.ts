import {
  requireSubmissionsAccessHttp,
  requireSubmissionsReadAccessHttp,
} from "../../lib/submission-http-auth.js";
import type { IConsignmentMessageHttpApplicationService } from "../interfaces/submission-routes/consignment-message-http.js";
import type {
  SubmissionHttpJson,
  SubmissionLegalEntityContext,
} from "../interfaces/submission-routes/submission-route-http.js";
import type {
  ConsignmentMessageOutcome,
  ConsignmentMessageService,
  ConsignmentThreadMember,
} from "./consignment-message.service.js";

type Input<K extends keyof IConsignmentMessageHttpApplicationService> = Parameters<
  IConsignmentMessageHttpApplicationService[K]
>[0];

function respond<T>(outcome: ConsignmentMessageOutcome<T>, okStatus = 200): SubmissionHttpJson {
  if (outcome.ok) return { status: okStatus, body: { data: outcome.value } };
  return { status: outcome.status, body: { error: outcome.error, code: outcome.code } };
}

/** The member a client request acts as; requests without one are refused. */
function memberOf(legalEntity: SubmissionLegalEntityContext): ConsignmentThreadMember | null {
  if (!legalEntity.member) return null;
  return {
    legalEntityId: legalEntity.legalEntityId,
    userId: legalEntity.member.userId,
    actor: legalEntity.member.actor,
  };
}

const NO_MEMBER: SubmissionHttpJson = {
  status: 403,
  body: { error: "Choose an account to continue.", code: "no_account" },
};

/**
 * HTTP for consignment messages: the account's side under the account context, and the staff
 * inbox behind the submissions capability (checked again here, as the other staff endpoints do).
 */
export class ConsignmentMessageHttpApplicationService
  implements IConsignmentMessageHttpApplicationService
{
  constructor(private readonly messages: ConsignmentMessageService) {}

  async listForClient(input: Input<"listForClient">): Promise<SubmissionHttpJson> {
    const member = memberOf(input.legalEntity);
    if (!member) return NO_MEMBER;
    return respond(await this.messages.readForClient(member, input.submissionId));
  }

  async postForClient(input: Input<"postForClient">): Promise<SubmissionHttpJson> {
    const member = memberOf(input.legalEntity);
    if (!member) return NO_MEMBER;
    return respond(await this.messages.writeForClient(member, input.submissionId, input.body), 201);
  }

  async markReadForClient(input: Input<"markReadForClient">): Promise<SubmissionHttpJson> {
    const member = memberOf(input.legalEntity);
    if (!member) return NO_MEMBER;
    return respond(await this.messages.markReadForClient(member, input.submissionId));
  }

  async listThreads(input: Input<"listThreads">): Promise<SubmissionHttpJson> {
    const denied = requireSubmissionsReadAccessHttp(input.viewer.role, input.viewer.staffRoles);
    if (denied) return denied;
    const page = await this.messages.listForStaff(input.viewer.userId, input.query);
    return { status: 200, body: { data: page.rows, nextCursor: page.nextCursor } };
  }

  async getForStaff(input: Input<"getForStaff">): Promise<SubmissionHttpJson> {
    const denied = requireSubmissionsReadAccessHttp(input.viewer.role, input.viewer.staffRoles);
    if (denied) return denied;
    return respond(await this.messages.readForStaff(input.submissionId));
  }

  async replyForStaff(input: Input<"replyForStaff">): Promise<SubmissionHttpJson> {
    const denied = requireSubmissionsAccessHttp(input.viewer.role, input.viewer.staffRoles);
    if (denied) return denied;
    return respond(
      await this.messages.writeForStaff(input.viewer.userId, input.submissionId, input.body),
      201,
    );
  }

  async assignForStaff(input: Input<"assignForStaff">): Promise<SubmissionHttpJson> {
    const denied = requireSubmissionsAccessHttp(input.viewer.role, input.viewer.staffRoles);
    if (denied) return denied;
    return respond(
      await this.messages.assign(input.viewer.userId, input.submissionId, input.assignedToUserId),
    );
  }

  async markReadForStaff(input: Input<"markReadForStaff">): Promise<SubmissionHttpJson> {
    const denied = requireSubmissionsAccessHttp(input.viewer.role, input.viewer.staffRoles);
    if (denied) return denied;
    return respond(await this.messages.markReadForStaff(input.submissionId));
  }
}
