import type { LegalEntityStatus } from "@auction/types";
import { type OrganisationAction, organisationStateAllows } from "./organisation-state-policy.js";

/**
 * Why an organisation is held back from trading and what its members can do about it. A state
 * where trading is open, or the organisation is closed, has no recovery to offer.
 */
export type OrganisationRecoveryKind =
  | "documents_requested"
  | "documents_under_review"
  | "restricted"
  | "not_approved";

/**
 * One row per status, so a new status fails to compile until it says whether it has a recovery
 * screen. A closed organisation is moved out of the switcher instead of being recovered.
 */
const RECOVERY_BY_STATUS: Readonly<Record<LegalEntityStatus, OrganisationRecoveryKind | null>> = {
  lead: "documents_requested",
  docs_requested: "documents_requested",
  docs_received: "documents_under_review",
  under_review: "documents_under_review",
  connect_pending: null,
  approved: null,
  restricted: "restricted",
  rejected: "not_approved",
  archived: null,
};

export function organisationRecoveryKind(
  status: LegalEntityStatus,
): OrganisationRecoveryKind | null {
  return RECOVERY_BY_STATUS[status];
}

/** The three things a member wants to know while an organisation is held. */
export const ORGANISATION_ABILITY_KEYS = ["history", "pay", "trade"] as const;
export type OrganisationAbilityKey = (typeof ORGANISATION_ABILITY_KEYS)[number];

export type OrganisationAbility = { key: OrganisationAbilityKey; open: boolean };

/** Each ability is open only when every action behind it is allowed. */
const ABILITY_ACTIONS: Readonly<Record<OrganisationAbilityKey, readonly OrganisationAction[]>> = {
  history: ["read_history"],
  pay: ["pay"],
  trade: ["bid", "register", "submit"],
};

/**
 * What an organisation in `status` lets its members do, from the one state policy, in a fixed
 * order, so the screen never states a rule of its own.
 */
export function organisationAbilities(status: LegalEntityStatus): OrganisationAbility[] {
  return ORGANISATION_ABILITY_KEYS.map((key) => ({
    key,
    open: ABILITY_ACTIONS[key].every((action) => organisationStateAllows(status, action)),
  }));
}
