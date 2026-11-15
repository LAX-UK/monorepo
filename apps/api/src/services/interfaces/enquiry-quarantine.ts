import type {
  EnquiryIntent,
  InboundDkimResult,
  InboundQuarantineReason,
  InboundQuarantineStatus,
  InboundSpfResult,
} from "@auction/domain";
import type { InboundAttachmentMetadata } from "@auction/persistence/interfaces";
import type {
  AdminEnquiryQuarantineAttach,
  AdminEnquiryQuarantineListQuery,
} from "@auction/validators";
import type { EnquiryStaffViewer } from "./marketing-enquiry-service.js";

/** The enquiry a held mail's reply address named, as far as the viewer may know it. */
export type QuarantineSuspectView = { reference: string; intent: EnquiryIntent };

/** One held mail in the staff list. */
export type QuarantineListItemView = {
  id: string;
  reason: InboundQuarantineReason;
  status: InboundQuarantineStatus;
  fromAddress: string;
  subject: string;
  attachmentCount: number;
  suspectedEnquiry: QuarantineSuspectView | null;
  receivedAt: string;
  purgeAt: string;
  reviewedAt: string | null;
};

export type QuarantineListPage = {
  items: QuarantineListItemView[];
  nextCursor: string | null;
  /** Held mail waiting for review that the viewer may see. */
  pendingCount: number;
};

/** One held mail in full: the plain text and the metadata of its files, never the files. */
export type QuarantineMessageView = QuarantineListItemView & {
  body: string;
  attachments: InboundAttachmentMetadata[];
  /** Null on mail held before the result was recorded. */
  spfResult: InboundSpfResult | null;
  dkimResult: InboundDkimResult | null;
};

export type QuarantineReviewError =
  | "quarantine_not_found"
  | "review_forbidden"
  | "already_reviewed"
  | "enquiry_not_found";

export type QuarantineAttachResult =
  | { ok: true; enquiryReference: string; messageId: string }
  | { ok: false; error: QuarantineReviewError };

export type QuarantineDiscardResult = { ok: true } | { ok: false; error: QuarantineReviewError };

/**
 * Staff review of inbound mail held back from every thread. Reading needs enquiry access (and
 * private sale access for mail suspected to belong to a private sale enquiry); attaching and
 * discarding need the right to work enquiries. Both reviews are audited with who did them.
 */
export interface IEnquiryQuarantineDesk {
  list(
    viewer: EnquiryStaffViewer,
    query: AdminEnquiryQuarantineListQuery,
  ): Promise<QuarantineListPage>;
  detail(viewer: EnquiryStaffViewer, id: string): Promise<QuarantineMessageView | null>;
  attach(
    viewer: EnquiryStaffViewer,
    id: string,
    input: AdminEnquiryQuarantineAttach,
  ): Promise<QuarantineAttachResult>;
  discard(viewer: EnquiryStaffViewer, id: string): Promise<QuarantineDiscardResult>;
}
