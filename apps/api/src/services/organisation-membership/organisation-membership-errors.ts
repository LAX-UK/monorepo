import { type Result, err } from "neverthrow";
import type {
  OrganisationMembershipError,
  OrganisationMembershipErrorCode,
} from "../interfaces/organisation-membership-service.js";

const ERRORS: Record<OrganisationMembershipErrorCode, OrganisationMembershipError> = {
  forbidden: {
    code: "forbidden",
    status: 403,
    message: "Your role in this organisation cannot do this",
  },
  not_found: {
    code: "not_found",
    status: 404,
    message: "That bid is no longer open",
  },
};

export function membershipFailure<T>(
  code: OrganisationMembershipErrorCode,
): Result<T, OrganisationMembershipError> {
  return err(ERRORS[code]);
}
