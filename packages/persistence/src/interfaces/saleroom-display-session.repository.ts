import type { SaleroomDisplayOverlay } from "@auction/types";

export interface ISaleroomDisplaySessionRepository {
  setDisplayOverlay(input: {
    saleId: string;
    overlay: SaleroomDisplayOverlay;
  }): Promise<{ updated: boolean }>;
  clearDisplayOverlay(saleId: string): Promise<{ updated: boolean }>;
}
