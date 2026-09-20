export const PLACEMENT_SLOTS = [
  "featured_originals",
  "featured_categories",
  "featured_prints",
  "featured_artists",
] as const;

export type PlacementSlot = (typeof PLACEMENT_SLOTS)[number];

export type PlacementTargetKind = "artwork" | "category" | "artist";

export type PlacementTarget = {
  kind: PlacementTargetKind;
  id: string;
};

export type PlannedPlacement = {
  slot: PlacementSlot;
  position: number;
  target: PlacementTarget;
};

export const PLACEMENT_SLOT_RULES: Record<
  PlacementSlot,
  { target: PlacementTargetKind; maxItems: number }
> = {
  featured_originals: { target: "artwork", maxItems: 6 },
  featured_categories: { target: "category", maxItems: 8 },
  featured_prints: { target: "artwork", maxItems: 12 },
  featured_artists: { target: "artist", maxItems: 8 },
};

import { ShopDomainError } from "./shop-domain-error.js";

export function isPlacementSlot(value: string): value is PlacementSlot {
  return (PLACEMENT_SLOTS as readonly string[]).includes(value);
}

export function assertValidPlacement(slot: PlacementSlot, target: PlacementTarget): void {
  const rule = PLACEMENT_SLOT_RULES[slot];
  if (target.kind !== rule.target) {
    throw new ShopDomainError(
      `Placement slot "${slot}" accepts ${rule.target} targets, not ${target.kind}`,
    );
  }
}

export function maxItemsForPlacement(slot: PlacementSlot): number {
  return PLACEMENT_SLOT_RULES[slot].maxItems;
}

export function assertValidPlacementSet(placements: readonly PlannedPlacement[]): void {
  const positionsBySlot = new Map<PlacementSlot, Set<number>>();

  for (const placement of placements) {
    assertValidPlacement(placement.slot, placement.target);
    if (!Number.isSafeInteger(placement.position) || placement.position < 0) {
      throw new ShopDomainError("Placement positions must be non-negative integers");
    }

    const positions = positionsBySlot.get(placement.slot) ?? new Set<number>();
    if (positions.has(placement.position)) {
      throw new ShopDomainError(
        `Placement slot "${placement.slot}" has duplicate position ${placement.position}`,
      );
    }
    positions.add(placement.position);
    positionsBySlot.set(placement.slot, positions);
  }

  for (const [slot, positions] of positionsBySlot) {
    if (positions.size > maxItemsForPlacement(slot)) {
      throw new ShopDomainError(
        `Placement slot "${slot}" exceeds its ${maxItemsForPlacement(slot)} item limit`,
      );
    }
  }
}
