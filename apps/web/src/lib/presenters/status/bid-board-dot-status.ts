import { presentationToDotStatus } from "@auction/ui";
import type { StatusBadgeVariant } from "./core";

function bidBoardVariant(input: {
  statusLabel: string;
  lotStatus?: string | null | undefined;
}): StatusBadgeVariant {
  if (input.statusLabel === "Winning" || input.statusLabel === "Won") return "success";
  if (input.statusLabel === "Outbid") return "danger";
  if (input.lotStatus === "active") return "live";
  return "neutral";
}

/** Buyer bids board — placement label + lot lifecycle context. */
export function bidBoardDotStatus(input: {
  statusLabel: string;
  lotStatus?: string | null | undefined;
}) {
  return presentationToDotStatus({
    label: input.statusLabel,
    variant: bidBoardVariant(input),
  });
}

export function bidHintDotStatus(hint: "high" | "outbid") {
  if (hint === "high") {
    return presentationToDotStatus({ label: "High bidder", variant: "success" });
  }
  return presentationToDotStatus({ label: "Outbid", variant: "danger" });
}
