import type { SessionUser } from "@/lib/data/contracts";
import type { Lot } from "@auction/types";
import type { ReactNode } from "react";

export type BidPolicyContext = {
  user: SessionUser | null;
  lot: Lot;
  lotStatus: Lot["status"];
  /** Post-login return path for the sign-in CTA (e.g. `/artwork/:id`). */
  loginNextPath: string;
};

export type BidPolicyDecision =
  | { kind: "allow" }
  | { kind: "block"; viewId: string; render: () => ReactNode };

export interface BidPolicy {
  readonly id: string;
  evaluate(ctx: BidPolicyContext): BidPolicyDecision;
}
