import type {
  ClerkPaddleBidTelemetryOutcome,
  IClerkPaddleBidTelemetry,
} from "../interfaces/admin-live-bidding-ports.js";
import { paddleBidPlacedTotal } from "../paddle.service.js";

export class ClerkPaddleBidTelemetry implements IClerkPaddleBidTelemetry {
  recordOutcome(outcome: ClerkPaddleBidTelemetryOutcome): void {
    paddleBidPlacedTotal.inc({ outcome });
  }

  logPlaced(input: {
    saleId: string;
    lotId: string;
    paddleNumber: number;
    clerkUserId: string;
    outcome: ClerkPaddleBidTelemetryOutcome;
    errorMessage?: string;
  }): void {
    console.info(
      JSON.stringify({
        action: "paddle_bid_placed",
        saleId: input.saleId,
        lotId: input.lotId,
        paddleNumber: input.paddleNumber,
        clerkUserId: input.clerkUserId,
        outcome: input.outcome,
        ...(input.errorMessage ? { error: input.errorMessage } : {}),
      }),
    );
  }
}
