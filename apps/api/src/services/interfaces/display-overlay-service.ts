import type { SaleroomDisplayOverlay } from "@auction/types";
import type { Result } from "neverthrow";
import type { DisplayServiceError } from "./display-pairing-service.js";

export type { DisplayServiceError };

export interface IDisplayOverlayService {
  setOverlay(input: {
    saleId: string;
    kind: "fair_warning" | "announcement";
    message?: string;
    actorUserId: string;
  }): Promise<Result<SaleroomDisplayOverlay, DisplayServiceError>>;
  clearOverlay(input: {
    saleId: string;
    actorUserId: string;
  }): Promise<Result<void, DisplayServiceError>>;
}
