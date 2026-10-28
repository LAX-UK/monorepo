import type { StaffRoles } from "@auction/types";

export type BidderRoleRow = {
  role: string;
  /** Staff roles in force now; empty for clients. */
  staffRoles: StaffRoles;
};

/** Reads the platform role of the account a bid is placed for. */
export interface IBidBidderRoleReader {
  /** `null` when the account has no bidding profile yet. */
  findBidderRole(userId: string): Promise<BidderRoleRow | null>;
}
