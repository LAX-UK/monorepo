import {
  type EnquiryIntent,
  isPrivateSaleEnquiryIntent,
  mayEnquireForOrganisation,
} from "@auction/domain";
import type { ILegalEntityMembershipReader } from "@auction/persistence/interfaces";
import type { UserRole } from "@auction/types";
import type { EnquirerAccount } from "./enquiry-intake.mapper.js";

export type EnquirerViewer = { userId: string; role: UserRole };

export type EnquirerAccountResolution =
  | { ok: true; account: EnquirerAccount | undefined }
  | { ok: false; status: 403; code: string; error: string };

/**
 * Decides whose account an enquiry is sent from. A signed-in sender's enquiry is linked to them;
 * an organisation is linked only when the sender is an active member whose role may send that
 * kind of enquiry for it. Staff are never clients, so they cannot send a private sale enquiry.
 */
export class EnquirerAccountResolver {
  constructor(
    private readonly deps: {
      memberships: Pick<ILegalEntityMembershipReader, "findActiveMembership">;
    },
  ) {}

  async resolve(input: {
    viewer: EnquirerViewer | null;
    intent: EnquiryIntent;
    legalEntityId?: string | undefined;
  }): Promise<EnquirerAccountResolution> {
    const { viewer } = input;
    if (!viewer) return { ok: true, account: undefined };
    if (viewer.role === "staff" && isPrivateSaleEnquiryIntent(input.intent)) {
      return {
        ok: false,
        status: 403,
        code: "staff_cannot_enquire",
        error: "Staff accounts cannot send private sale enquiries.",
      };
    }
    if (!input.legalEntityId) return { ok: true, account: { userId: viewer.userId } };

    const membership = await this.deps.memberships.findActiveMembership(
      viewer.userId,
      input.legalEntityId,
    );
    if (!membership || !mayEnquireForOrganisation(membership.role, input.intent)) {
      return {
        ok: false,
        status: 403,
        code: "organisation_not_permitted",
        error: "You cannot send this enquiry for that organisation.",
      };
    }
    return {
      ok: true,
      account: { userId: viewer.userId, legalEntityId: input.legalEntityId },
    };
  }
}
