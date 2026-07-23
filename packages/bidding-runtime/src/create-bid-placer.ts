import { BidService, type BidServiceOptions } from "./bid.service.js";

/** Factory input mirrors {@link BidServiceOptions}, wired through narrow bidding-runtime ports. */
export type CreateBidPlacerDeps = BidServiceOptions;

/** Composes the bid placement stack around narrow ports (DIP over apps/api concretes). */
export function createBidPlacer(deps: CreateBidPlacerDeps): BidService {
  return new BidService(deps);
}
