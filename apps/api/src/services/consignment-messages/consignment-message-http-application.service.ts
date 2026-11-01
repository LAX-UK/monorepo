import { type UserRole, normalizeUserRoleOrClient } from "@auction/types";
import {
  requireConsignmentInboxReadHttp,
  requireConsignmentInboxReplyHttp,
  requireSavedRepliesManageHttp,
} from "../../lib/consignment-inbox-http-auth.js";
import type {
  IConsignmentMessageHttpApplicationService,
  IConsignmentSavedReplyHttp,
} from "../interfaces/submission-routes/consignment-message-http.js";
import type {
  SubmissionHttpJson,
  SubmissionLegalEntityContext,
  SubmissionViewerContext,
} from "../interfaces/submission-routes/submission-route-http.js";
import {
  type ConsignmentInboxQueryService,
  inboxQueryFilter,
} from "./consignment-inbox-query.service.js";
import type {
  ConsignmentMessageOutcome,
  ConsignmentMessageService,
  ConsignmentThreadMember,
} from "./consignment-message.service.js";
import type { ConsignmentSavedReplyService } from "./consignment-saved-reply.service.js";
import type { ConsignmentThreadCommandService } from "./consignment-thread-command.service.js";

type Input<K extends keyof IConsignmentMessageHttpApplicationService> = Parameters<
  IConsignmentMessageHttpApplicationService[K]
>[0];

function respond<T>(outcome: ConsignmentMessageOutcome<T>, okStatus = 200): SubmissionHttpJson {
  if (outcome.ok) return { status: okStatus, body: { data: outcome.value } };
  return {
    status: outcome.status,
    body: { error: outcome.error, code: outcome.code, ...outcome.extra },
  };
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
 * inbox. Each staff call is checked against its capability here again (reads need the inbox
 * read access, every change the reply access), as the other staff endpoints do.
 */
export class ConsignmentMessageHttpApplicationService
  implements IConsignmentMessageHttpApplicationService
{
  constructor(
    private readonly messages: ConsignmentMessageService,
    private readonly commands: ConsignmentThreadCommandService,
    private readonly queries: ConsignmentInboxQueryService,
  ) {}

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
    const denied = readDenied(input.viewer);
    if (denied) return denied;
    return { status: 200, body: await this.queries.list(input.viewer.userId, input.query) };
  }

  async summary(input: Input<"summary">): Promise<SubmissionHttpJson> {
    const denied = readDenied(input.viewer);
    if (denied) return denied;
    return { status: 200, body: { data: await this.queries.summary(input.viewer.userId) } };
  }

  async assignees(input: Input<"assignees">): Promise<SubmissionHttpJson> {
    const denied = readDenied(input.viewer);
    if (denied) return denied;
    return { status: 200, body: { data: await this.queries.assignees() } };
  }

  async getForStaff(input: Input<"getForStaff">): Promise<SubmissionHttpJson> {
    const denied = readDenied(input.viewer);
    if (denied) return denied;
    return respond(
      await this.queries.detail(
        {
          userId: input.viewer.userId,
          role: normalizeUserRoleOrClient(input.viewer.role) as UserRole,
          staffRoles: input.viewer.staffRoles,
        },
        input.submissionId,
      ),
    );
  }

  async replyForStaff(input: Input<"replyForStaff">): Promise<SubmissionHttpJson> {
    const denied = replyDenied(input.viewer);
    if (denied) return denied;
    return respond(
      await this.commands.reply(input.viewer.userId, input.submissionId, input.body),
      201,
    );
  }

  async undoReply(input: Input<"undoReply">): Promise<SubmissionHttpJson> {
    const denied = replyDenied(input.viewer);
    if (denied) return denied;
    return respond(
      await this.commands.undo(input.viewer.userId, input.submissionId, input.messageId),
    );
  }

  async closeThread(input: Input<"closeThread">): Promise<SubmissionHttpJson> {
    const denied = replyDenied(input.viewer);
    if (denied) return denied;
    return respond(await this.commands.close(input.viewer.userId, input.submissionId));
  }

  async reopenThread(input: Input<"reopenThread">): Promise<SubmissionHttpJson> {
    const denied = replyDenied(input.viewer);
    if (denied) return denied;
    return respond(await this.commands.reopen(input.viewer.userId, input.submissionId));
  }

  async markReadForStaff(input: Input<"markReadForStaff">): Promise<SubmissionHttpJson> {
    const denied = replyDenied(input.viewer);
    if (denied) return denied;
    return respond(await this.commands.markRead(input.submissionId));
  }

  async markUnreadForStaff(input: Input<"markUnreadForStaff">): Promise<SubmissionHttpJson> {
    const denied = replyDenied(input.viewer);
    if (denied) return denied;
    return respond(await this.commands.markUnread(input.submissionId));
  }

  async assignForStaff(input: Input<"assignForStaff">): Promise<SubmissionHttpJson> {
    const denied = replyDenied(input.viewer);
    if (denied) return denied;
    return respond(await this.commands.assign(input.viewer.userId, input.submissionId, input.body));
  }

  async bulk(input: Input<"bulk">): Promise<SubmissionHttpJson> {
    const denied = replyDenied(input.viewer);
    if (denied) return denied;
    const filter = input.body.filter
      ? inboxQueryFilter(input.body.filter, input.viewer.userId)
      : null;
    return respond(await this.commands.bulk(input.viewer.userId, input.body, filter));
  }
}

/** The saved replies endpoints: anyone who reads the inbox lists; managers change. */
export class ConsignmentSavedReplyHttpApplicationService implements IConsignmentSavedReplyHttp {
  constructor(private readonly replies: ConsignmentSavedReplyService) {}

  async list(input: { viewer: SubmissionViewerContext }): Promise<SubmissionHttpJson> {
    const denied = readDenied(input.viewer);
    if (denied) return denied;
    return { status: 200, body: { data: await this.replies.list() } };
  }

  async create(input: Parameters<IConsignmentSavedReplyHttp["create"]>[0]) {
    const denied = manageDenied(input.viewer);
    if (denied) return denied;
    return respond(await this.replies.create(input.viewer.userId, input.body), 201);
  }

  async update(input: Parameters<IConsignmentSavedReplyHttp["update"]>[0]) {
    const denied = manageDenied(input.viewer);
    if (denied) return denied;
    return respond(await this.replies.update(input.viewer.userId, input.id, input.body));
  }

  async remove(input: Parameters<IConsignmentSavedReplyHttp["remove"]>[0]) {
    const denied = manageDenied(input.viewer);
    if (denied) return denied;
    return respond(await this.replies.remove(input.viewer.userId, input.id));
  }
}

function readDenied(viewer: SubmissionViewerContext): SubmissionHttpJson | null {
  return requireConsignmentInboxReadHttp(viewer.role, viewer.staffRoles);
}

function replyDenied(viewer: SubmissionViewerContext): SubmissionHttpJson | null {
  return requireConsignmentInboxReplyHttp(viewer.role, viewer.staffRoles);
}

function manageDenied(viewer: SubmissionViewerContext): SubmissionHttpJson | null {
  return requireSavedRepliesManageHttp(viewer.role, viewer.staffRoles);
}
