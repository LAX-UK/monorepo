import type { AccessRequestStatus } from "@auction/domain";
import type { AccessRequestRow } from "@auction/persistence/interfaces";
import type { LegalEntityMemberRole } from "@auction/types";
import type { Result } from "neverthrow";
import type { OrganisationMemberActor } from "./organisation-membership-service.js";

export type AccessRequestError = {
  code: string;
  status: 400 | 403 | 404 | 409;
  message: string;
  hint?: string;
};

export type AccessResult<T> = Promise<Result<T, AccessRequestError>>;

/** What a member asks for: a role, or one capability, with why. */
export type AccessAskInput =
  | { role: LegalEntityMemberRole; capability?: undefined; reason: string }
  | { capability: string; role?: undefined; reason: string };

/**
 * "Ask for access": members ask, owners and admins approve (by giving a role) or decline, and
 * the requester may withdraw while it waits. Every step is recorded in Activity.
 */
export interface IAccessRequestService {
  /** Opens the request, or returns the member's pending one for the same ask. */
  ask(
    actor: OrganisationMemberActor,
    input: AccessAskInput,
  ): AccessResult<{ request: AccessRequestRow; created: boolean }>;
  /** Owners and admins see every request; other members see their own. */
  list(
    actor: OrganisationMemberActor,
    filter: { status?: AccessRequestStatus | undefined },
  ): AccessResult<AccessRequestRow[]>;
  approve(
    actor: OrganisationMemberActor,
    requestId: string,
    input: { role?: LegalEntityMemberRole | undefined; note?: string | undefined },
  ): AccessResult<AccessRequestRow>;
  decline(
    actor: OrganisationMemberActor,
    requestId: string,
    input: { note?: string | undefined },
  ): AccessResult<AccessRequestRow>;
  withdraw(actor: OrganisationMemberActor, requestId: string): AccessResult<AccessRequestRow>;
}
