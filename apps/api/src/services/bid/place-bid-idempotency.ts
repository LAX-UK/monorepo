import type { Bid } from "@auction/types";
import type { BidError } from "../../lib/errors.js";

export type PlaceBidWithIdempotencyOutcome =
  | { type: "replay"; body: { data: Bid } }
  | { type: "err"; error: BidError }
  | { type: "ok"; body: { data: Bid } };
