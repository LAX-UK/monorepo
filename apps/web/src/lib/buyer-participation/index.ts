/**
 * Buyer lot-page participation boundaries (server loaders, acting context, realtime decode).
 * Keeps route/components thin while preserving existing HTTP contracts.
 */
export {
  LotPageDataService,
  type LotPageShellData,
  type LotPageSecondaryData,
} from "../marketing/lot-page-data.service.js";
export { buildLotPageViewModel } from "../marketing/lot-page-vm.js";
export { parseBidUpdateEvent } from "../realtime/parse-bid-update.js";
export { resolveActingContext } from "../legal-entity/acting-context.server.js";
