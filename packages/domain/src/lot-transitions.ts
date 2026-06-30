import type { LotStatus } from "@auction/types";

/** Named transition kinds — single registry replaces ALLOWED_LOT_TRANSITIONS + CANCELLABLE. */
export type LotTransitionKind =
  | "publish"
  | "unpublish"
  | "cancel"
  | "activate"
  | "end"
  | "void"
  | "attach"
  | "detach"
  | "admin_override"
  | "return_to_inventory";

export type LotTransitionDef = {
  kind: LotTransitionKind;
  from: ReadonlySet<LotStatus>;
  to: LotStatus;
};

/** Allowed status transitions keyed by transition kind. Guards are enforced separately. */
export const LOT_TRANSITIONS: readonly LotTransitionDef[] = [
  { kind: "publish", from: new Set(["draft"]), to: "scheduled" },
  { kind: "unpublish", from: new Set(["scheduled"]), to: "draft" },
  {
    kind: "cancel",
    from: new Set(["draft", "scheduled", "active"]),
    to: "cancelled",
  },
  { kind: "activate", from: new Set(["scheduled"]), to: "active" },
  { kind: "end", from: new Set(["active"]), to: "ended" },
  { kind: "void", from: new Set(["active"]), to: "voided" },
  { kind: "attach", from: new Set(["draft"]), to: "draft" },
  { kind: "detach", from: new Set(["draft"]), to: "draft" },
  {
    kind: "admin_override",
    from: new Set(["draft", "scheduled", "active"]),
    to: "ended",
  },
  {
    kind: "return_to_inventory",
    from: new Set(["ended", "cancelled", "voided"]),
    to: "draft",
  },
] as const;

const ADMIN_OVERRIDE_TARGETS: Partial<Record<LotStatus, ReadonlySet<LotStatus>>> = {
  draft: new Set(["scheduled", "cancelled"]),
  scheduled: new Set(["cancelled"]),
  active: new Set(["ended", "cancelled"]),
  ended: new Set(["draft"]),
  cancelled: new Set(["draft"]),
  voided: new Set(["draft"]),
};

export function canTransition(from: LotStatus, kind: LotTransitionKind): boolean {
  const def = LOT_TRANSITIONS.find((t) => t.kind === kind);
  if (!def) return false;
  return def.from.has(from);
}

export function canAdminOverrideLotStatus(from: LotStatus, to: LotStatus): boolean {
  return ADMIN_OVERRIDE_TARGETS[from]?.has(to) ?? false;
}

export function targetStatusForKind(kind: LotTransitionKind): LotStatus | null {
  return LOT_TRANSITIONS.find((t) => t.kind === kind)?.to ?? null;
}
