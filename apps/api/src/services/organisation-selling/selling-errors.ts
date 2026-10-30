import type { EntityActor } from "@auction/domain";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import type {
  OrganisationSellingError,
  OrganisationSellingErrorCode,
} from "../interfaces/organisation-selling-service.js";

const ERRORS: Record<OrganisationSellingErrorCode, Omit<OrganisationSellingError, "code">> = {
  insufficient_entity_role: { status: 403, message: "Your role in this account can't see this." },
  payout_not_found: { status: 404, message: "This payout isn't in this account." },
  agreement_not_found: {
    status: 404,
    message: "There's no agreement for this consignment yet.",
  },
};

/** The one place selling errors get their status and wording. */
export function sellingError(code: OrganisationSellingErrorCode): OrganisationSellingError {
  return { code, ...ERRORS[code] };
}

export function entityActorOf(actor: OrganisationMemberActor): EntityActor {
  return { role: actor.role, isImpersonation: actor.isImpersonation };
}

/** One row past the page says whether another page follows. */
export function paged<T>(rows: readonly T[], page: { limit: number; offset: number }) {
  return {
    items: rows.slice(0, page.limit),
    nextOffset: rows.length > page.limit ? page.offset + page.limit : null,
  };
}
