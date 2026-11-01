import type { PostConsignmentMessageBody, StaffConsignmentThreadsQuery } from "@auction/validators";
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

/** The staff inbox: threads across consignments, and answering them. */
export interface IConsignmentMessageStaffHttp {
  listThreads(input: {
    query: StaffConsignmentThreadsQuery;
    viewer: SubmissionViewerContext;
  }): Promise<SubmissionHttpJson>;
  getForStaff(input: {
    submissionId: string;
    viewer: SubmissionViewerContext;
  }): Promise<SubmissionHttpJson>;
  replyForStaff(input: {
    submissionId: string;
    body: PostConsignmentMessageBody;
    viewer: SubmissionViewerContext;
  }): Promise<SubmissionHttpJson>;
  assignForStaff(input: {
    submissionId: string;
    assignedToUserId: string | null;
    viewer: SubmissionViewerContext;
  }): Promise<SubmissionHttpJson>;
  markReadForStaff(input: {
    submissionId: string;
    viewer: SubmissionViewerContext;
  }): Promise<SubmissionHttpJson>;
}

export type IConsignmentMessageHttpApplicationService = IConsignmentMessageClientHttp &
  IConsignmentMessageStaffHttp;
