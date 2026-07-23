import { type Result, err, ok } from "neverthrow";
import type { BiddingRouteServiceError } from "../services/interfaces/bidding-routes/bidding-route-http.js";

/** Prefer acting-context legal entity; reject body-only identity when it disagrees. */
export function resolveActingBuyerLegalEntity(input: {
  actingLegalEntityId?: string | undefined;
  bodyLegalEntityId?: string | undefined;
}): Result<string, BiddingRouteServiceError> {
  if (input.actingLegalEntityId) {
    if (input.bodyLegalEntityId && input.bodyLegalEntityId !== input.actingLegalEntityId) {
      return err({
        message: "Legal entity does not match acting context",
        status: 403,
        code: "legal_entity_mismatch",
      });
    }
    return ok(input.actingLegalEntityId);
  }
  if (input.bodyLegalEntityId) {
    return ok(input.bodyLegalEntityId);
  }
  return err({
    message: "Buyer legal entity is required",
    status: 400,
    code: "legal_entity_required",
  });
}
