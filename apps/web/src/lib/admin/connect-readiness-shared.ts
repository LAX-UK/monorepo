/** Serializable connect flags keyed by lot id (safe across RSC → client). */
export type ConnectRequiredByLotId = Record<string, boolean>;

export function lotConnectRequired(
  connectRequiredByLotId: ConnectRequiredByLotId | undefined,
  lotId: string,
): boolean {
  return connectRequiredByLotId?.[lotId] ?? false;
}
