import type {
  ConsignmentInboxBulkBody,
  ConsignmentInboxListQuery,
  ConsignmentThreadAssignBody,
  ConsignmentThreadReplyBody,
  PostConsignmentMessageBody,
  SavedReplyBody,
} from "@auction/validators";
import type {
  SubmissionHttpJson,
  SubmissionLegalEntityContext,
  SubmissionViewerContext,
} from "./submission-route-http.js";

/** A consignment's messages for the account that sent it. */
export interface IConsignmentMessageClientHttp {
  listForClient(input: {
    submissionId: string;
    legalEntity: SubmissionLegalEntityContext;
  }): Promise<SubmissionHttpJson>;
  postForClient(input: {
    submissionId: string;
    body: PostConsignmentMessageBody;
    legalEntity: SubmissionLegalEntityContext;
  }): Promise<SubmissionHttpJson>;
  markReadForClient(input: {
    submissionId: string;
    legalEntity: SubmissionLegalEntityContext;
  }): Promise<SubmissionHttpJson>;
}

type ThreadInput = { submissionId: string; viewer: SubmissionViewerContext };

/** The staff inbox: threads across consignments, and answering them. */
export interface IConsignmentMessageStaffHttp {
  listThreads(input: {
    query: ConsignmentInboxListQuery;
    viewer: SubmissionViewerContext;
  }): Promise<SubmissionHttpJson>;
  summary(input: { viewer: SubmissionViewerContext }): Promise<SubmissionHttpJson>;
  assignees(input: { viewer: SubmissionViewerContext }): Promise<SubmissionHttpJson>;
  getForStaff(input: ThreadInput): Promise<SubmissionHttpJson>;
  replyForStaff(
    input: ThreadInput & { body: ConsignmentThreadReplyBody },
  ): Promise<SubmissionHttpJson>;
  undoReply(input: ThreadInput & { messageId: string }): Promise<SubmissionHttpJson>;
  closeThread(input: ThreadInput): Promise<SubmissionHttpJson>;
  reopenThread(input: ThreadInput): Promise<SubmissionHttpJson>;
  markReadForStaff(input: ThreadInput): Promise<SubmissionHttpJson>;
  markUnreadForStaff(input: ThreadInput): Promise<SubmissionHttpJson>;
  assignForStaff(
    input: ThreadInput & { body: ConsignmentThreadAssignBody },
  ): Promise<SubmissionHttpJson>;
  bulk(input: {
    body: ConsignmentInboxBulkBody;
    viewer: SubmissionViewerContext;
  }): Promise<SubmissionHttpJson>;
}

/** The team's saved replies. */
export interface IConsignmentSavedReplyHttp {
  list(input: { viewer: SubmissionViewerContext }): Promise<SubmissionHttpJson>;
  create(input: {
    body: SavedReplyBody;
    viewer: SubmissionViewerContext;
  }): Promise<SubmissionHttpJson>;
  update(input: {
    id: string;
    body: SavedReplyBody;
    viewer: SubmissionViewerContext;
  }): Promise<SubmissionHttpJson>;
  remove(input: { id: string; viewer: SubmissionViewerContext }): Promise<SubmissionHttpJson>;
}

export type IConsignmentMessageHttpApplicationService = IConsignmentMessageClientHttp &
  IConsignmentMessageStaffHttp;
