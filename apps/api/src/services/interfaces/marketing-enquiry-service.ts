import type { ContactEnquiryInput } from "@auction/validators";

/** What staff read when they open an enquiry. */
export type MarketingEnquiryView = {
  id: string;
  topic: string;
  topicLabel: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  sourcePage: string | null;
  status: "new" | "handled";
  receivedAt: string;
  handledAt: string | null;
  /** When the promised reply is due: two business days after the enquiry arrived. */
  replyDueAt: string;
};

export type MarketingEnquiryHandledResult =
  | { ok: true; enquiry: MarketingEnquiryView }
  | { ok: false; error: "enquiry_not_found" | "already_handled" };

/** The public side: the contact form hands a message to the platform. */
export interface IMarketingEnquiryIntake {
  submit(input: ContactEnquiryInput): Promise<{ id: string }>;
}

/** The staff side: open an enquiry and mark it handled. */
export interface IMarketingEnquiryDesk {
  detail(id: string): Promise<MarketingEnquiryView | null>;
  markHandled(id: string, actorUserId: string): Promise<MarketingEnquiryHandledResult>;
}
