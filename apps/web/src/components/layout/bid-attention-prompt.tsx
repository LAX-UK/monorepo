"use client";

import { clientPart } from "@/components/layout/client-part";
import { whenSignedIn } from "@/components/layout/signed-in-only";

/**
 * The header's urgent prompt for a signed-in client (see `BidAttentionPromptChip`). It draws
 * nothing for a guest or before the account facts are read, so its code loads for signed-in
 * visitors only.
 */
export const BidAttentionPrompt = whenSignedIn(
  clientPart(() =>
    import("@/components/layout/bid-attention-prompt-chip").then(
      (mod) => mod.BidAttentionPromptChip,
    ),
  ),
);
