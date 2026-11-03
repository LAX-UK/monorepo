import type { EnquirerOrganisation } from "@/lib/private-sales/enquiring-as";
import type { ContactTopic, EnquiryIntakeWire } from "@auction/validators";

/** What the contact form collects, before it becomes a general enquiry. */
export type ContactPayload = {
  topic: ContactTopic;
  email: string;
  name: string;
  message: string;
  phone?: string | undefined;
  /** The page the form was sent from, as a path. */
  sourcePage?: string | undefined;
};

/** An enquiry as the platform takes it: one payload per path, chosen by its `intent`. */
export type EnquiryPayload = EnquiryIntakeWire;

/** What a sender is given back: the reference to quote and the day a reply is promised. */
export type EnquiryReceipt = { reference: string; replyBy: string };

/** A draft a visitor may upload photos under until they send the enquiry. */
export type EnquiryDraft = { draftToken: string; expiresAt: string };

/** The enquiry did not reach the platform. The form shows its send-failed state. */
export class ContactDispatchError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ContactDispatchError";
  }
}

export type ContactDispatcher = {
  /** Resolves once the enquiry is stored; throws {@link ContactDispatchError} when it is not. */
  dispatch(input: EnquiryPayload): Promise<EnquiryReceipt>;
  /** Starts a draft for a visitor's files; throws {@link ContactDispatchError} when refused. */
  startDraft(): Promise<EnquiryDraft>;
  /** The organisations the signed-in sender may send an enquiry for. */
  organisations(): Promise<EnquirerOrganisation[]>;
};
