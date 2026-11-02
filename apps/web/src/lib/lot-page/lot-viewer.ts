import { isIndexableObject } from "@/lib/data/http/object-guards";
import type { LotPosition, LotRegistrationState, LotViewerState } from "@auction/domain";

/** The invoice behind a lot the viewer won. */
export type LotViewerPurchase = {
  id: string;
  status: "not_invoiced" | "due" | "overdue" | "processing" | "paid" | "refunded" | "cancelled";
  dueAt: string | null;
};

/** `GET /lots/:id/me`: where the acting account stands on one lot. */
export type LotViewerView = LotViewerState & {
  registrationRequired: boolean;
  purchase: LotViewerPurchase | null;
  agentLimitLeft: string | null;
};

const REGISTRATIONS: readonly LotRegistrationState[] = ["none", "pending", "approved", "declined"];
const POSITIONS: readonly LotPosition[] = [
  "none",
  "leading",
  "outbid",
  "maximum_set",
  "won",
  "lost",
];
const PURCHASE_STATUSES: readonly LotViewerPurchase["status"][] = [
  "not_invoiced",
  "due",
  "overdue",
  "processing",
  "paid",
  "refunded",
  "cancelled",
];

/** Someone who is signed out, or whose standing could not be read: no part in the lot. */
export const NO_LOT_VIEWER: LotViewerView = {
  registration: "none",
  position: "none",
  myHighestBid: null,
  myMaxBid: null,
  registrationRequired: false,
  purchase: null,
  agentLimitLeft: null,
};

function oneOf<T extends string>(allowed: readonly T[], value: unknown, fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function parsePurchase(raw: unknown): LotViewerPurchase | null {
  if (!isIndexableObject(raw) || typeof raw.id !== "string") return null;
  return {
    id: raw.id,
    status: oneOf(PURCHASE_STATUSES, raw.status, "due"),
    dueAt: stringOrNull(raw.dueAt),
  };
}

/** Reads the `/me` payload; an unreadable one is the same as no standing. */
export function parseLotViewerView(raw: unknown): LotViewerView {
  if (!isIndexableObject(raw)) return NO_LOT_VIEWER;
  return {
    registration: oneOf(REGISTRATIONS, raw.registration, "none"),
    position: oneOf(POSITIONS, raw.position, "none"),
    myHighestBid: stringOrNull(raw.myHighestBid),
    myMaxBid: stringOrNull(raw.myMaxBid),
    registrationRequired: raw.registrationRequired === true,
    purchase: parsePurchase(raw.purchase),
    agentLimitLeft: stringOrNull(raw.agentLimitLeft),
  };
}
