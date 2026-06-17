import type { ClerkLivePhase } from "@/features/saleroom/lib/clerk-live-phase";
import type { ClerkActionPolicy } from "@/features/saleroom/types/clerk-console.types";
import type { Lot } from "@auction/types";

export type ResolveClerkActionPolicyInput = {
  phase: ClerkLivePhase;
  sessionStatus: "none" | "pending" | "live" | "paused" | "ended";
  canHammer: boolean;
  nextLot: Lot | null;
  betweenLots: boolean;
};

export function resolveClerkActionPolicy(input: ResolveClerkActionPolicyInput): ClerkActionPolicy {
  const { phase, sessionStatus, canHammer, nextLot, betweenLots } = input;
  const hasNextLot = nextLot != null;
  const sessionActive = sessionStatus === "live" || sessionStatus === "paused";

  if (!sessionActive) {
    return {
      advanceInRunway: false,
      advanceInOnBlock: false,
      advanceInDock: false,
      hammerInOnBlock: false,
      hammerInDock: false,
      jumpToLotInRunway: false,
    };
  }

  if (phase === "selling") {
    return {
      advanceInRunway: false,
      advanceInOnBlock: false,
      advanceInDock: hasNextLot,
      hammerInOnBlock: false,
      hammerInDock: canHammer,
      jumpToLotInRunway: true,
    };
  }

  if (phase === "betweenLots" || phase === "paused") {
    return {
      advanceInRunway: hasNextLot && !betweenLots,
      advanceInOnBlock: false,
      advanceInDock: hasNextLot,
      hammerInOnBlock: false,
      hammerInDock: canHammer,
      jumpToLotInRunway: true,
    };
  }

  return {
    advanceInRunway: hasNextLot,
    advanceInOnBlock: hasNextLot,
    advanceInDock: false,
    hammerInOnBlock: false,
    hammerInDock: false,
    jumpToLotInRunway: sessionActive,
  };
}
