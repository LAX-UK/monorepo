import { createSocketLotRealtime } from "@/lib/realtime/socket-adapter";
import type { LotRealtimePort } from "@/lib/realtime/contracts";

/** DIP: user dashboard realtime (lot rooms). */
export function createUserRealtimeClient(): LotRealtimePort {
  return createSocketLotRealtime();
}
