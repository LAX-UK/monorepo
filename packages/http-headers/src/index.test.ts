import { describe, expect, it } from "vitest";
import {
  BROWSER_API_CUSTOM_HEADERS,
  MARKETING_ATTRIBUTION_HEADER,
  MARKETING_CONSENT_ANALYTICS_HEADER,
  MARKETING_CONSENT_MARKETING_HEADER,
  MARKETING_PAGE_URL_HEADER,
  X_LEGAL_ENTITY_ID_HEADER,
} from "./index.js";

describe("@auction/http-headers", () => {
  it("includes all browser custom headers used by hc-browser", () => {
    expect(BROWSER_API_CUSTOM_HEADERS).toEqual([
      "Content-Type",
      "Authorization",
      "Idempotency-Key",
      MARKETING_CONSENT_MARKETING_HEADER,
      MARKETING_CONSENT_ANALYTICS_HEADER,
      MARKETING_PAGE_URL_HEADER,
      MARKETING_ATTRIBUTION_HEADER,
      X_LEGAL_ENTITY_ID_HEADER,
    ]);
  });
});
