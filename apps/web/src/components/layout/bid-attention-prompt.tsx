"use client";

import { whenSignedIn } from "@/components/layout/signed-in-only";
import dynamic from "next/dynamic";

/**
 * The header's urgent prompt for a signed-in client (see `BidAttentionPromptChip`). It draws
 * nothing for a guest or before the account facts are read, so its code loads for signed-in
 * visitors only.
 */
export const BidAttentionPrompt = whenSignedIn(
  dynamic(
    () =>
      import("@/components/layout/bid-attention-prompt-chip").then((mod) => ({
        default: mod.BidAttentionPromptChip,
      })),
    { ssr: false },
  ),
);
