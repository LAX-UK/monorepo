import { enquiryDepartmentLabel } from "@auction/domain";
import type { ClaimedEnquiryFiles, MarketingEnquiryRecord } from "@auction/persistence/interfaces";
import type { EnquiryIntakeInput } from "@auction/validators";
import { enquiryTopicLabel } from "./enquiry-view.js";

/**
 * What the acknowledgement repeats back to the sender: the path, the department and work, and how
 * many photos arrived. Email is not a confidential channel, so it never includes the price in
 * mind, the budget, the notes or the files themselves.
 */
export type EnquiryAcknowledgementSummary = {
  kind: "sell" | "buy" | "general";
  topicLabel?: string;
  departmentLabel?: string;
  work?: string;
  photoCount: number;
};

/** Tells the sender their enquiry arrived. */
export interface IEnquiryAcknowledgement {
  send(enquiry: MarketingEnquiryRecord, summary: EnquiryAcknowledgementSummary): Promise<void>;
}

/** Used where acknowledgements are not sent. */
export const noEnquiryAcknowledgement: IEnquiryAcknowledgement = {
  async send() {},
};

export function summariseForAcknowledgement(
  input: EnquiryIntakeInput,
  files: ClaimedEnquiryFiles,
): EnquiryAcknowledgementSummary {
  if (input.intent === "private_sale_sell") {
    return {
      kind: "sell",
      departmentLabel: enquiryDepartmentLabel(input.departmentSlug),
      work: `${input.artist}, ${input.title}`,
      photoCount: files.images,
    };
  }
  if (input.intent === "private_sale_buy") return { kind: "buy", photoCount: files.images };
  return { kind: "general", topicLabel: enquiryTopicLabel(input.topic), photoCount: files.images };
}
