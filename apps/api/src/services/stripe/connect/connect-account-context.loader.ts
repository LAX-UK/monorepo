import type { Database } from "@auction/db";
import {
  kycVerification,
  legalEntity,
  legalEntityAddress,
  user,
  userAddress,
} from "@auction/db/schema";
import { and, desc, eq } from "drizzle-orm";
import type { ConnectKycSnapshot } from "./connect-account-prefill.js";
import type { ConnectAddressSnapshot } from "./connect-address-snapshot.js";
import { throwConnectError } from "./connect-service-errors.js";

const ENTITY_ADDRESS_TYPE_ORDER: Record<string, number> = {
  registered_office: 0,
  billing: 1,
  both: 2,
};

function toAddressSnapshot(row: {
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
}): ConnectAddressSnapshot {
  return {
    line1: row.line1,
    line2: row.line2,
    city: row.city,
    state: row.state,
    postalCode: row.postalCode,
    country: row.country,
  };
}

function pickEntityAddress(
  rows: Array<{
    line1: string;
    line2: string | null;
    city: string;
    state: string | null;
    postalCode: string;
    country: string;
    addressType: string;
    isDefault: boolean;
  }>,
): ConnectAddressSnapshot | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => {
    const oa = ENTITY_ADDRESS_TYPE_ORDER[a.addressType] ?? 99;
    const ob = ENTITY_ADDRESS_TYPE_ORDER[b.addressType] ?? 99;
    if (oa !== ob) return oa - ob;
    return (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0);
  });
  const best = sorted[0];
  return best ? toAddressSnapshot(best) : null;
}

function pickUserAddress(
  rows: Array<{
    line1: string;
    line2: string | null;
    city: string;
    state: string | null;
    postalCode: string;
    country: string;
    addressType: string;
    isDefault: boolean;
  }>,
): ConnectAddressSnapshot | null {
  if (rows.length === 0) return null;
  const def = rows.find((r) => r.isDefault);
  const billingish = rows.find((r) => r.addressType === "billing" || r.addressType === "both");
  const picked = def ?? billingish ?? rows[0];
  return picked ? toAddressSnapshot(picked) : null;
}

export type ConnectAccountCreationContext = {
  entity: typeof legalEntity.$inferSelect;
  ownerUserId: string;
  ownerEmail: string;
  ownerFirstName: string | null;
  ownerLastName: string | null;
  ownerDisplayName: string | null;
  ownerKycStatus: (typeof user.$inferSelect)["kycStatus"];
  ownerMobile: string | null;
  entityAddress: ConnectAddressSnapshot | null;
  userAddress: ConnectAddressSnapshot | null;
  kyc: ConnectKycSnapshot | null;
};

export async function loadConnectAccountCreationContext(
  db: Database,
  legalEntityId: string,
): Promise<ConnectAccountCreationContext> {
  const entityRows = await db
    .select({
      entity: legalEntity,
      ownerEmail: user.email,
      ownerFirstName: user.firstName,
      ownerLastName: user.lastName,
      ownerDisplayName: user.name,
      ownerKycStatus: user.kycStatus,
      ownerMobile: user.mobile,
      ownerUserId: user.id,
    })
    .from(legalEntity)
    .innerJoin(user, eq(user.id, legalEntity.createdByUserId))
    .where(eq(legalEntity.id, legalEntityId))
    .limit(1);
  const entityRow = entityRows[0];
  if (!entityRow) throwConnectError("legal_entity_not_found", 404);

  const [entityAddresses, userAddresses, kycRows] = await Promise.all([
    db
      .select({
        line1: legalEntityAddress.line1,
        line2: legalEntityAddress.line2,
        city: legalEntityAddress.city,
        state: legalEntityAddress.state,
        postalCode: legalEntityAddress.postalCode,
        country: legalEntityAddress.country,
        addressType: legalEntityAddress.addressType,
        isDefault: legalEntityAddress.isDefault,
      })
      .from(legalEntityAddress)
      .where(eq(legalEntityAddress.legalEntityId, legalEntityId)),
    db
      .select({
        line1: userAddress.line1,
        line2: userAddress.line2,
        city: userAddress.city,
        state: userAddress.state,
        postalCode: userAddress.postalCode,
        country: userAddress.country,
        addressType: userAddress.addressType,
        isDefault: userAddress.isDefault,
      })
      .from(userAddress)
      .where(eq(userAddress.userId, entityRow.ownerUserId)),
    db
      .select({
        verifiedFirstName: kycVerification.verifiedFirstName,
        verifiedLastName: kycVerification.verifiedLastName,
        verifiedDateOfBirth: kycVerification.verifiedDateOfBirth,
        verifiedIdCountry: kycVerification.verifiedIdCountry,
      })
      .from(kycVerification)
      .where(
        and(
          eq(kycVerification.userId, entityRow.ownerUserId),
          eq(kycVerification.status, "verified"),
        ),
      )
      .orderBy(desc(kycVerification.decisionAt), desc(kycVerification.createdAt))
      .limit(1),
  ]);

  const kycRow = kycRows[0];
  const kyc: ConnectKycSnapshot | null = kycRow
    ? {
        verifiedFirstName: kycRow.verifiedFirstName ?? null,
        verifiedLastName: kycRow.verifiedLastName ?? null,
        verifiedDateOfBirth: kycRow.verifiedDateOfBirth ?? null,
        verifiedIdCountry: kycRow.verifiedIdCountry ?? null,
      }
    : null;

  return {
    entity: entityRow.entity,
    ownerUserId: entityRow.ownerUserId,
    ownerEmail: entityRow.ownerEmail,
    ownerFirstName: entityRow.ownerFirstName,
    ownerLastName: entityRow.ownerLastName,
    ownerDisplayName: entityRow.ownerDisplayName,
    ownerKycStatus: entityRow.ownerKycStatus,
    ownerMobile: entityRow.ownerMobile,
    entityAddress: pickEntityAddress(entityAddresses),
    userAddress: pickUserAddress(userAddresses),
    kyc,
  };
}
