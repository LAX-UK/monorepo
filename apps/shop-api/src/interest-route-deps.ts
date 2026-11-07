import type { EnquiryRateLimiter } from "./application/enquiry-rate-limit.js";
import type { AccountEmailAlertHandlers } from "./application/handlers/account-email-alerts.handler.js";
import type { EditionAlertHandlers } from "./application/handlers/edition-alerts.handler.js";
import type { createGetArtworkInterestHandler } from "./application/handlers/get-artwork-interest.handler.js";
import type { createRegisterArtworkInterestHandler } from "./application/handlers/register-artwork-interest.handler.js";
import type { ShopAlertHandlers } from "./application/handlers/shop-alerts.handler.js";

export type InterestRoutesDeps = {
  registerArtworkInterest: ReturnType<typeof createRegisterArtworkInterestHandler>;
  getArtworkInterest: ReturnType<typeof createGetArtworkInterestHandler>;
  enquiryRateLimiter: EnquiryRateLimiter;
  editionAlerts: EditionAlertHandlers;
  editionAlertRateLimiter: EnquiryRateLimiter;
  releaseAlerts: ShopAlertHandlers;
  releaseAlertRateLimiter: EnquiryRateLimiter;
  accountEmailAlerts: AccountEmailAlertHandlers;
};
