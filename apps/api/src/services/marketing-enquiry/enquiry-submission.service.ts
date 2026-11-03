import type { EnquiryIntakeInput } from "@auction/validators";
import type {
  IMarketingEnquiryIntake,
  MarketingEnquirySubmitted,
} from "../interfaces/marketing-enquiry-service.js";
import type { EnquirerAccountResolution, EnquirerViewer } from "./enquirer-account.resolver.js";
import type { IEnquiryDraftTokens } from "./enquiry-draft-token.js";
import { enquiryIntentOf } from "./enquiry-intake.mapper.js";

export type EnquirySubmissionResult =
  | ({ ok: true } & MarketingEnquirySubmitted)
  | { ok: false; status: number; code: string; error: string };

/** What the public endpoint needs from the person's request: who they are, if signed in. */
export interface IEnquirySubmission {
  submit(
    input: EnquiryIntakeInput,
    viewer: EnquirerViewer | null,
  ): Promise<EnquirySubmissionResult>;
}

export type EnquirySubmissionDeps = {
  intake: IMarketingEnquiryIntake;
  drafts: Pick<IEnquiryDraftTokens, "verify">;
  accounts: {
    resolve(input: {
      viewer: EnquirerViewer | null;
      intent: ReturnType<typeof enquiryIntentOf>;
      legalEntityId?: string | undefined;
    }): Promise<EnquirerAccountResolution>;
  };
};

/**
 * Turns a request into an enquiry: whose account it is sent from, and whose uploaded files go with
 * it. A signed-in sender brings their own uploads; a visitor brings the draft token they uploaded
 * under. A draft token that has expired costs the visitor their files, never the enquiry.
 */
export class EnquirySubmissionService implements IEnquirySubmission {
  constructor(private readonly deps: EnquirySubmissionDeps) {}

  async submit(
    input: EnquiryIntakeInput,
    viewer: EnquirerViewer | null,
  ): Promise<EnquirySubmissionResult> {
    const resolution = await this.deps.accounts.resolve({
      viewer,
      intent: enquiryIntentOf(input),
      legalEntityId: "legalEntityId" in input ? input.legalEntityId : undefined,
    });
    if (!resolution.ok) return resolution;

    const submitted = await this.deps.intake.submit(input, {
      account: resolution.account,
      uploadOwner: this.uploadOwnerOf(input, viewer),
    });
    return { ok: true, ...submitted };
  }

  private uploadOwnerOf(input: EnquiryIntakeInput, viewer: EnquirerViewer | null) {
    if (viewer) return { ownerUserId: viewer.userId };
    if (input.intent !== "private_sale_sell" || !input.draftToken) return undefined;
    const draft = this.deps.drafts.verify(input.draftToken);
    return draft ? { enquiryDraftId: draft.draftId } : undefined;
  }
}
