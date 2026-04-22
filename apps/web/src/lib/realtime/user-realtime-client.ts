import type { LotRealtimePort } from "@/lib/realtime/contracts";
import { createSocketLotRealtime } from "@/lib/realtime/socket-adapter";

/** DIP: user dashboard realtime (lot rooms). */
export function createUserRealtimeClient(): LotRealtimePort {
  return createSocketLotRealtime();
}
