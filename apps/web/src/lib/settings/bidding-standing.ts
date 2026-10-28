import type { SessionUser } from "@/lib/data/contracts";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";

type KycStatus = NonNullable<SessionUser["kycStatus"]>;

export type BiddingStandingRow = {
  id: "identity" | "limit";
  title: string;
  detail: string;
  action: { label: string; href: string } | null;
};

/** What the identity check means for bidding, one row per status. */
const IDENTITY: Record<KycStatus, Omit<BiddingStandingRow, "id">> = {
  approved: {
    title: "Identity verified",
    detail: "You can bid in every sale you register for.",
    action: null,
  },
  pending: {
    title: "We're checking your identity",
    detail: "This usually takes less than a working day. We'll email you when it's done.",
    action: null,
  },
  unverified: {
    title: "Verify your identity",
    detail: "We check who you are once, before your first bid.",
    action: { label: "Verify identity", href: CLIENT_ROUTES.verifyIdentity },
  },
  rejected: {
    title: "We couldn't verify your identity",
    detail: "Try again with a clear photo, or ask client services for help.",
    action: { label: "Try again", href: CLIENT_ROUTES.verifyIdentity },
  },
};

const LIMIT: BiddingStandingRow = {
  id: "limit",
  title: "Bidding limit",
  detail: "Your limit is set when we verify you. Ask us to raise it at any time.",
  action: { label: "Request an increase", href: "/contact?intent=bidding-limit" },
};

/** Bid settings' Bidding section: whether the person can bid, and how to raise their limit. */
export function biddingStanding(kycStatus: SessionUser["kycStatus"]): BiddingStandingRow[] {
  return [{ id: "identity", ...IDENTITY[kycStatus ?? "unverified"] }, LIMIT];
}
