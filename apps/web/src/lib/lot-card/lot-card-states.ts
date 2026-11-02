import { isIndexableObject } from "@/lib/data/http/object-guards";
import type { LotPosition } from "@auction/domain";

/** How the signed-in viewer stands on one lot they have bid on. */
export type LotCardState = {
  lotId: string;
  position: Exclude<LotPosition, "none">;
  nextBidAmount: string | null;
};

const POSITIONS: readonly LotCardState["position"][] = [
  "leading",
  "outbid",
  "maximum_set",
  "won",
  "lost",
];

function isPosition(value: unknown): value is LotCardState["position"] {
  return typeof value === "string" && (POSITIONS as readonly string[]).includes(value);
}

/** Reads `GET /users/me/lot-states`; entries it cannot understand are left out. */
export function parseLotCardStates(data: unknown): LotCardState[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((entry): LotCardState[] => {
    if (!isIndexableObject(entry) || typeof entry.lotId !== "string") return [];
    if (!isPosition(entry.position)) return [];
    const next = entry.nextBidAmount;
    return [
      {
        lotId: entry.lotId,
        position: entry.position,
        nextBidAmount: typeof next === "string" && next !== "" ? next : null,
      },
    ];
  });
}
