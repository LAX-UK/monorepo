import type { SaleroomDisplayControlPayload } from "@auction/types";

export interface ISaleroomRealtimePublisher {
  publishDisplayControl(saleId: string, payload: SaleroomDisplayControlPayload): Promise<void>;
}
