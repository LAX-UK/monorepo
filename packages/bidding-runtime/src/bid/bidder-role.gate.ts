import type { IBidBidderRoleReader } from "@auction/persistence/interfaces";
import { normalizeUserRole, roleHasCapability } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { BidError } from "../bid-error.js";

export interface IBidderRoleGate {
  assertCanBid(bidderUserId: string): Promise<Result<void, BidError>>;
}

/**
 * The account a bid is for must hold the `bid.place` capability, whichever channel placed it.
 * It checks the bidder, never the operator: a saleroom clerk may place a bid for a client.
 * An account with no bidding profile yet is a client by default. No staff role grants
 * `bid.place`, so staff never bid as clients whatever roles they hold.
 */
export class BidderRoleGate implements IBidderRoleGate {
  constructor(private readonly roleReader: IBidBidderRoleReader) {}

  async assertCanBid(bidderUserId: string): Promise<Result<void, BidError>> {
    const row = await this.roleReader.findBidderRole(bidderUserId);
    const role = normalizeUserRole(row ? row.role : "client");
    if (role != null && roleHasCapability(role, "bid.place", row?.staffRoles)) {
      return ok(undefined);
    }
    return err(
      new BidError("This account type cannot place bids", 403, "bidding_not_allowed_for_role"),
    );
  }
}
