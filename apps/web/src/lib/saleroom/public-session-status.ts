export type PublicSaleroomSessionStatus = {
  status: "none" | "pending" | "live" | "paused" | "ended";
  currentLotId: string | null;
};

export function isSaleroomSessionActive(status: PublicSaleroomSessionStatus["status"]): boolean {
  return status === "live" || status === "paused";
}
