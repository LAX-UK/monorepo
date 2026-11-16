import type {
  InboundDkimResult,
  InboundMatchMethod,
  InboundQuarantineReason,
  InboundSpfResult,
} from "@auction/domain";
import type { StaffStatusTone } from "@auction/staff-ui";

/**
 * The words staff read about email replies to enquiries and the mail held back from them, in one
 * place. Screens look these up by key, so a new reason or result is one row here.
 */

export const REPLIES_COPY = {
  sectionTitle: "Replies by email",
  sectionDescription:
    "What the client emailed back to this enquiry, as plain text. Formatting and images are removed.",
  logLabel: (name: string) => `Email replies from ${name}`,
  empty: "No replies by email yet.",
  channel: "via email",
  clientRole: "Client",
  filesNote: "Only the file names were kept. Ask the client to upload the files if you need them.",
  awaitingBadge: "Client replied",
  awaitingDescription: (since: string) =>
    `The client replied on ${since} and is waiting for an answer.`,
  awaitingNoticeTitle: "The client is waiting for an answer",
  awaitingNoticeBody:
    "Reply from your own email, then move the enquiry to Waiting on client or close it. That clears this notice.",
  timelineEvent: "Client replied by email",
  timelineAttached: "Held email attached to this enquiry",
} as const;

/** How an emailed reply was tied to the thread, as the record says it. */
export const MATCHED_BY_LABELS: Record<InboundMatchMethod, string> = {
  token: "Matched by its reply address",
  in_reply_to: "Matched by the email it answers",
  staff: "Attached by staff from held email",
};

export const QUARANTINE_COPY = {
  title: "Held email",
  description:
    "Email sent to enquiry reply addresses that could not be matched safely. Nothing here reaches an enquiry until someone attaches it. Held email is deleted 30 days after it arrived.",
  listLabel: "Held email",
  openFromEnquiries: "Held email",
  views: { pending: "To review", reviewed: "Reviewed" },
  columns: {
    from: "From",
    reason: "Why it was held",
    enquiry: "Suspected enquiry",
    received: "Received",
    deleted: "Deleted on",
  },
  empty: {
    pending: {
      title: "No held email to review",
      description: "Replies that can't be matched safely to an enquiry wait here for a person.",
    },
    reviewed: {
      title: "Nothing reviewed yet",
      description: "Held email that was attached or discarded shows here until it is deleted.",
    },
  },
  loadError: "Held email couldn't be loaded",
  noSuspect: "None",
  noSubject: "(no subject)",
  pendingCount: (count: number) => (count === 1 ? "1 to review" : `${count} to review`),
  record: {
    breadcrumb: "Held email",
    metaFrom: "From",
    metaReceived: "Received",
    metaDeleted: "Deleted on",
    messageTitle: "Message",
    messageDescription: "As plain text. Links and formatting are not shown.",
    filesTitle: "Files",
    filesNote: "Only the file names were kept. The files themselves were not downloaded or stored.",
    filesLabel: "Files named in this email",
    checksTitle: "Sender checks",
    checksDescription:
      "What the receiving mail server recorded about who sent it. An email joins an enquiry on its own only when SPF passed or a DKIM signature for the sender's domain passed.",
    reasonTitle: "Why it was held",
    suspectTitle: "Suspected enquiry",
    suspectNone: "Its reply address named no enquiry we could find.",
    reviewedLinked: "Attached to an enquiry",
    reviewedDismissed: "Discarded",
    reviewedNotice: (when: string) => `Reviewed on ${when}. It is kept until it is deleted.`,
    viewOnly: "You can read held email but not attach or discard it.",
  },
  actions: {
    attach: "Attach to enquiry",
    discard: "Discard",
    back: "Back to held email",
    copyAddress: "Copy sender address",
    more: "More held email actions",
  },
  attach: {
    title: "Attach this email to an enquiry?",
    description:
      "It joins the enquiry's thread as a reply from the client and marks the enquiry as waiting for an answer. This can't be undone.",
    suspectLabel: (reference: string) => `${reference}, the enquiry its reply address named`,
    otherLabel: "Another enquiry",
    otherHint: "The reference the client quoted, such as E-1042.",
    referenceLabel: "Enquiry reference",
    referenceInvalid: "Enter a reference such as E-1042.",
    choiceLegend: "Which enquiry",
    confirm: (reference: string) => `Attach to ${reference}`,
    confirmEmpty: "Attach",
    cancel: "Cancel",
    done: (reference: string) => `Email attached to ${reference}`,
  },
  discard: {
    title: "Discard this email?",
    description:
      "It stays off every enquiry and is deleted with the rest of held email 30 days after it arrived. This can't be undone.",
    confirm: "Discard email",
    done: "Email discarded",
  },
  errors: {
    quarantine_not_found: "This email is no longer held, or you can't open it.",
    review_forbidden: "You can't attach or discard held email.",
    already_reviewed: "Someone has already attached or discarded this email.",
    enquiry_not_found: "No enquiry with that reference, or you can't open it.",
    forbidden: "You don't have permission to review held email.",
    unavailable: "The Bid API didn't answer. Nothing was changed. Try again in a moment.",
  },
} as const;

/** Why a mail was held: a short label for the list and a sentence for the record. */
export const QUARANTINE_REASON_COPY: Record<
  InboundQuarantineReason,
  { label: string; description: string; tone: StaffStatusTone }
> = {
  unmatched: {
    label: "No enquiry found",
    description:
      "It was sent to the reply address without an enquiry in it, and quoted no email we sent.",
    tone: "neutral",
  },
  bad_token: {
    label: "Altered reply address",
    description:
      "The reply address it was sent to was changed or made up, so it can't be trusted to name an enquiry.",
    tone: "danger",
  },
  sender_mismatch: {
    label: "Different sender",
    description:
      "It names an enquiry but came from a different address than the client's, such as a forward or a shared inbox.",
    tone: "warning",
  },
  spf_failed: {
    label: "Failed SPF",
    description:
      "The sender's domain says this server may not send its email. It may not be from who it says.",
    tone: "danger",
  },
  unauthenticated: {
    label: "Sender not verified",
    description:
      "Neither SPF nor a DKIM signature for the sender's domain passed, so we can't tell it is from the client.",
    tone: "warning",
  },
  auto_reply: {
    label: "Automatic reply",
    description: "An out-of-office, bounce or mailing list message rather than a person writing.",
    tone: "neutral",
  },
};

export const SPF_LABELS: Record<InboundSpfResult, string> = {
  pass: "Passed",
  fail: "Failed",
  softfail: "Soft fail",
  neutral: "Neutral",
  none: "No result",
  temperror: "Temporary error",
  permerror: "Policy error",
};

export const DKIM_LABELS: Record<InboundDkimResult, string> = {
  pass: "Passed for the sender's domain",
  pass_unaligned: "Passed for another domain",
  fail: "Failed",
  none: "No result",
};

/** Said for mail received before the result was recorded. */
export const AUTH_NOT_RECORDED = "Not recorded";
