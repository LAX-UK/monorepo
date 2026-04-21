import { ADMIN_CANNOT_BUY_DESCRIPTION, ADMIN_CANNOT_BUY_TITLE } from "@/lib/ui/admin-cannot-buy";
import type { BidErrorMatcher, BidErrorPresentation } from "../types";

export const adminBidErrorMatcher: BidErrorMatcher = {
  match(raw: string): BidErrorPresentation | null {
    if (raw !== "admin_cannot_buy") return null;
    return {
      title: ADMIN_CANNOT_BUY_TITLE,
      message: ADMIN_CANNOT_BUY_DESCRIPTION,
      severity: "info",
    };
  },
};
