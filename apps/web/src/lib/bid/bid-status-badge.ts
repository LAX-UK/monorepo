import type { StatusBadgeShape, StatusBadgeTone } from "@auction/ui/lax";
import type { MyBidStatus } from "./my-bid-status";

/**
 * How each bid status is drawn: an outbid lot asks for attention (warning, with the alert cue),
 * a winning or won lot is good news, a maximum waiting for the lot to open is information, and
 * the rest are neutral.
 */
export const BID_STATUS_BADGE: Record<
  MyBidStatus,
  { tone: StatusBadgeTone; shape: StatusBadgeShape }
> = {
  outbid: { tone: "warning", shape: "alert" },
  winning: { tone: "success", shape: "check" },
  "maximum-set": { tone: "info", shape: "dot" },
  absentee: { tone: "neutral", shape: "ring" },
  won: { tone: "success", shape: "check" },
  "not-won": { tone: "neutral", shape: "ring" },
  withdrawn: { tone: "neutral", shape: "ring" },
};
