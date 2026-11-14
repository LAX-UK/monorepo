import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";

export type ClerkSessionControlState = {
  canGoLive: boolean;
  canPause: boolean;
  canResume: boolean;
  canClose: boolean;
};

/**
 * Which session controls the clerk may press. `status` must be the state the server confirmed
 * (the page snapshot, a realtime event, or a re-read after a control), and `confirming` is true
 * from the press of a control until the server has been asked again what state the room is in.
 * While confirming nothing is pressable: the console would otherwise offer Pause on a room the
 * server has already paused, and the server refuses it ("Saleroom must be live to pause").
 */
export function resolveClerkSessionControls(input: {
  status: PublicSaleroomSessionStatus["status"];
  confirming: boolean;
}): ClerkSessionControlState {
  const { status, confirming } = input;
  if (confirming) {
    return { canGoLive: false, canPause: false, canResume: false, canClose: false };
  }
  return {
    canGoLive: status === "none" || status === "ended" || status === "pending",
    canPause: status === "live",
    canResume: status === "paused",
    canClose: status === "live" || status === "paused",
  };
}
