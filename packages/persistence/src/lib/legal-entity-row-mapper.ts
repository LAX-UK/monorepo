import type { legalEntity } from "@auction/db/schema";
import type { LegalEntity } from "@auction/types";

export function legalEntityRowToDomain(row: typeof legalEntity.$inferSelect): LegalEntity {
  return {
    id: row.id,
    displayName: row.displayName,
    legalName: row.legalName ?? null,
    slug: row.slug ?? null,
    kind: row.kind,
    subkind: row.subkind,
    createdByUserId: row.createdByUserId,
    status: row.status,
    statusChangedAt: row.statusChangedAt ?? null,
    statusChangedByUserId: row.statusChangedByUserId ?? null,
    stripeConnectAccountId: row.stripeConnectAccountId ?? null,
    stripeCustomerId: row.stripeCustomerId ?? null,
    stripeConnectChargesEnabled: row.stripeConnectChargesEnabled,
    stripeConnectPayoutsEnabled: row.stripeConnectPayoutsEnabled,
    stripeConnectRequirementsCurrentlyDue: row.stripeConnectRequirementsCurrentlyDue ?? [],
    stripeConnectRequirementsErrors: row.stripeConnectRequirementsErrors ?? [],
    stripeConnectDisabledReason: row.stripeConnectDisabledReason ?? null,
    xeroContactId: row.xeroContactId ?? null,
    vatNumber: row.vatNumber ?? null,
    marginSchemeEligible: row.marginSchemeEligible,
    isLaxManaged: row.isLaxManaged,
    platformFeeBps: row.platformFeeBps ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
