import type {
  checkInBidder as CheckInBidder,
  searchCheckInCandidates as SearchCheckInCandidates,
} from "@/lib/admin/saleroom/check-in.client";

/**
 * Door check-in, loaded on first use. The registrations tab, the check-in panel and the expected
 * guests list call these; the transport and its copy (`check-in.client.ts`) are fetched the first
 * time staff search or check someone in, so they stay out of the tab's start-up JavaScript.
 */
const load = () => import("@/lib/admin/saleroom/check-in.client");

export const searchCheckInCandidates: typeof SearchCheckInCandidates = async (input) =>
  (await load()).searchCheckInCandidates(input);

export const checkInBidder: typeof CheckInBidder = async (input) =>
  (await load()).checkInBidder(input);
