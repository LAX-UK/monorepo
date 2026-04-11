/**
 * Re-export strategy contracts next to concrete strategies (plan layout).
 * Canonical definitions live under `services/interfaces/auction-strategy.ts`.
 */
export type {
  IAuctionStrategy,
  IAuctionStrategyFactory,
} from "../services/interfaces/auction-strategy.js";
