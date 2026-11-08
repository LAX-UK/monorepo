import type { ConnectAccountStatus } from "../services/interfaces/stripe-connect.js";

/** The payout status a member reads: whether an account is linked, never its id. */
export type MemberConnectStatus = Omit<ConnectAccountStatus, "stripeAccountId"> & {
  accountLinked: boolean;
};

export function toMemberConnectStatus(status: ConnectAccountStatus): MemberConnectStatus {
  const { stripeAccountId, ...rest } = status;
  return { ...rest, accountLinked: stripeAccountId !== null };
}
