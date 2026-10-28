"use client";

import { useAppSession } from "@/lib/auth/use-app-session";
import type { SessionUser } from "@/lib/data/contracts";
import type { AttentionChip } from "@/lib/navigation/client-attention";
import { cn } from "@auction/ui";
import Link from "next/link";
import { useHeaderAccountMenu } from "./account-menu/use-header-account-menu";

const TONE: Record<AttentionChip["kind"], string> = {
  outbid: "border-danger/25 bg-danger-container text-danger-on-surface hover:border-danger/45",
  "payment-due":
    "border-warning/30 bg-warning-container text-warning-on-surface hover:border-warning/50",
};

function Chip({ chip }: { chip: AttentionChip }) {
  return (
    <Link
      href={chip.href}
      className={cn(
        "relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 font-body text-[0.8125rem] font-medium whitespace-nowrap transition-colors",
        "after:absolute after:-inset-y-1.5 after:inset-x-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        TONE[chip.kind],
      )}
    >
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />
      <span className="hidden sm:inline">{chip.label}</span>
      <span className="sm:hidden">{chip.shortLabel}</span>
    </Link>
  );
}

function ClientChip({ user }: { user: SessionUser }) {
  const state = useHeaderAccountMenu(user);
  return state.kind === "client" && state.chip ? <Chip chip={state.chip} /> : null;
}

/**
 * The header's one urgent prompt for a signed-in client: outbid while a sale is live, else a
 * payment due. Staff never see it, and nothing shows when nothing is pressing.
 */
export function HeaderAttentionChip() {
  const { user } = useAppSession();
  return user ? <ClientChip user={user} /> : null;
}
