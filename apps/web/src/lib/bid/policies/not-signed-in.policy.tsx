import Link from "next/link";
import type { BidPolicy, BidPolicyContext, BidPolicyDecision } from "./types";

export const notSignedInPolicy: BidPolicy = {
  id: "not-signed-in",
  evaluate(ctx: BidPolicyContext): BidPolicyDecision {
    if (ctx.user !== null) {
      return { kind: "allow" };
    }
    const next = encodeURIComponent(ctx.loginNextPath);
    return {
      kind: "block",
      viewId: "not-signed-in",
      render: () => (
        <div className="rounded-lg bg-surface-container-high/80 p-8 text-center ring-1 ring-outline-variant/10">
          <p className="mb-4 font-body text-sm text-on-surface-variant">
            Sign in to place a bid on this lot.
          </p>
          <Link
            href={`/login?next=${next}`}
            className="inline-flex w-full items-center justify-center bg-gradient-to-br from-primary to-primary-container py-4 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-primary shadow-md transition-opacity hover:opacity-95"
          >
            Sign in to bid
          </Link>
        </div>
      ),
    };
  },
};
