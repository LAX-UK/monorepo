import { NIL } from "./worker-role-contract.test-helpers.js";

/**
 * Valid arguments for the role-contract probes. A probe only proves a grant when its statement
 * reaches PostgreSQL, so every value here has the right type for its column: a uuid is a uuid, an
 * enum is one of its members, a boolean is a boolean. They name rows that do not exist, which keeps
 * reads empty and writes inert (each call also runs in a transaction that is rolled back).
 */

/** The lot `seed-worker-role-contract-probes.ts` inserts, for calls that must find an existing row. */
export const PROBE_LOT_ID = "00000000-0000-4000-8000-000000000002";

/** The account and Shop rows `seed-worker-role-contract-probes.ts` inserts for the accounting facts reader. */
export const PROBE_USER_ID = "worker-role-contract-probe-user";
export const PROBE_SHOP_GUEST_ORDER_ID = "00000000-0000-4000-8000-000000000015";
export const PROBE_SHOP_USER_ORDER_ID = "00000000-0000-4000-8000-000000000016";
export const PROBE_SHOP_ORIGINAL_SALE_ID = "00000000-0000-4000-8000-000000000017";

export const today = new Date();
export const earlier = new Date(today.getTime() - 24 * 60 * 60 * 1000);

/** A lot outcome as the unsold-lot stores key it. */
export const outcomeKey = { lotId: NIL, lotEndTime: today };

/** A recorded alert match; `id` is only read by the validator, the ledger ignores it. */
export function alertMatch() {
  return {
    id: NIL,
    subscriberId: NIL,
    topic: "bid.new_sales",
    itemKey: `sale:${NIL}`,
    groupKey: null,
    snapshot: {},
    matchedAt: today,
  } as const;
}

/** What `ArtworkRegisterRepository.issue` takes for a new original in a valid stock-code series. */
export function issuedRegisterEntry() {
  return {
    zohoProductId: "role-contract",
    collectionCode: "RCT",
    title: "Role contract",
    artist: { zohoArtistId: null, name: "Role Contract", code: "RCT" },
    medium: null,
    dimensions: null,
    year: null,
    imageRefs: [],
    catalogueStatus: null,
    zohoPrice: null,
  };
}

export const registerActor = "role-contract";

export function soldAttention() {
  return {
    registerId: NIL,
    zohoProductId: "role-contract",
    zohoStatus: "Sold",
    place: "lax_art",
    placeRefId: null,
    markedAt: today,
    now: today,
  } as const;
}

export function lifecycleSnapshot() {
  return { lotId: NIL, snapshotPatch: { lastEventType: "role-contract", lastEventAt: today } };
}

export function sellerConsentAnswer() {
  return {
    id: NIL,
    from: "requested",
    to: "given",
    channel: "workspace",
    answeredByUserId: null,
    answeredAt: today,
    note: null,
    preferredNext: null,
  } as const;
}

/** A new register entry as `create` takes it: a stock code and kind of its own, and no source original. */
export function newRegisterEntry() {
  const { collectionCode: _collection, ...rest } = issuedRegisterEntry();
  return {
    ...rest,
    stockCode: "LAX-ORI-RCT-RCT-26-0001",
    kind: "original",
    sourceOriginalId: null,
  } as const;
}

export const stockCodeSeries = { kind: "original", artist: "RCT", second: "RCT" } as const;

export const consent = { consentText: "Role contract", consentSource: "role-contract" } as const;
