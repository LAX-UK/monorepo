"use client";

import { usesBidAsClient } from "@/lib/auth/client-audience";
import { useAppSession } from "@/lib/auth/use-app-session";
import {
  type AttentionChip,
  type ClientAttention,
  attentionChip,
} from "@/lib/navigation/client-attention";
import { useAccountMenuContext } from "@/lib/navigation/use-account-menu-context.client";
import { useMemo } from "react";

export type BidAttention = {
  signedIn: boolean;
  /** The session is still being read. */
  pending: boolean;
  /** What is waiting for a signed-in client; `null` for guests, staff and until it loads. */
  attention: ClientAttention | null;
  /** The one urgent prompt (outbid, account in review, payment due), or `null`. */
  chip: AttentionChip | null;
};

/**
 * What needs the signed-in client, from the one account-menu read the header menu and sub-nav
 * already share. The attention strip, the tab bar's dots and the account entry all use it, so
 * they always agree.
 */
export function useBidAttention(): BidAttention {
  const { user, pending } = useAppSession();
  const isClient = user ? usesBidAsClient(user) : false;
  const context = useAccountMenuContext(user?.id ?? "", isClient);
  const attention = isClient ? (context?.attention ?? null) : null;
  const chip = useMemo(() => (attention ? attentionChip(attention) : null), [attention]);
  return { signedIn: Boolean(user), pending, attention, chip };
}
