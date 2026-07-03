import type { ConnectAddressSnapshot } from "./legal-entity-connect.types.js";

const ENTITY_ADDRESS_TYPE_ORDER: Record<string, number> = {
  registered_office: 0,
  billing: 1,
  both: 2,
};

export function toAddressSnapshot(row: {
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

export function pickEntityAddress(
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

export function pickUserAddress(
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
