import type { LegalEntity, MemberLegalEntity } from "@auction/types";

/**
 * The organisation as a member may read it, built field by field so a field added to the record
 * later stays staff-only until someone lists it here.
 */
export function toMemberLegalEntity(entity: LegalEntity): MemberLegalEntity {
  return {
    id: entity.id,
    displayName: entity.displayName,
    legalName: entity.legalName,
    slug: entity.slug,
    kind: entity.kind,
    subkind: entity.subkind,
    status: entity.status,
    statusChangedAt: entity.statusChangedAt,
    stripeConnectChargesEnabled: entity.stripeConnectChargesEnabled,
    stripeConnectPayoutsEnabled: entity.stripeConnectPayoutsEnabled,
    stripeConnectRequirementsCurrentlyDue: entity.stripeConnectRequirementsCurrentlyDue,
    stripeConnectRequirementsErrors: entity.stripeConnectRequirementsErrors,
    stripeConnectDisabledReason: entity.stripeConnectDisabledReason,
    vatNumber: entity.vatNumber,
    isLaxManaged: entity.isLaxManaged,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    stripeConnectAccountLinked: entity.stripeConnectAccountId !== null,
  };
}
