import type { EnquiryRateLimiter } from "./application/enquiry-rate-limit.js";
import type { EditionAlertHandlers } from "./application/handlers/edition-alerts.handler.js";
import type { createGetArtworkInterestHandler } from "./application/handlers/get-artwork-interest.handler.js";
import type { createRegisterArtworkInterestHandler } from "./application/handlers/register-artwork-interest.handler.js";

export type InterestRoutesDeps = {
  registerArtworkInterest: ReturnType<typeof createRegisterArtworkInterestHandler>;
  getArtworkInterest: ReturnType<typeof createGetArtworkInterestHandler>;
  enquiryRateLimiter: EnquiryRateLimiter;
  editionAlerts: EditionAlertHandlers;
  editionAlertRateLimiter: EnquiryRateLimiter;
};
