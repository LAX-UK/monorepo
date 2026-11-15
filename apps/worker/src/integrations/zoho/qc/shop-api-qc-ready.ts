import {
  type InventoryPeerClient,
  InventoryPeerUnavailableError,
  QC_READY_TO_PACK_SUBROUTE,
  qcReadyToPackAnswerSchema,
} from "@auction/artwork-register-contracts";
import type { QcReadyShop } from "./zoho-qc-ready.js";

/**
 * Asks LAX Shop over the inventory machine route. LAX Shop being briefly unreachable is retried
 * as it is; a refusal (the credential is wrong or not set) is a setup fault and fails the notice.
 */
export function createShopApiQcReady(peer: InventoryPeerClient): QcReadyShop {
  return {
    async markPassed(request) {
      try {
        const answer = await peer.call(
          "POST",
          QC_READY_TO_PACK_SUBROUTE,
          qcReadyToPackAnswerSchema,
          request,
        );
        return answer.outcome;
      } catch (error) {
        if (error instanceof InventoryPeerUnavailableError) throw error;
        throw new Error(`zoho_qc_shop_refused:${error instanceof Error ? error.message : "?"}`);
      }
    },
  };
}
