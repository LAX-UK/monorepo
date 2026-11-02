import type { LegalPolicyDocument } from "../policy/policy-document.js";

/**
 * Cookie Notice and Preference Controls, as published by London Art Exchange Ltd at https://www.thelax.art/cookie-notice
 * (version 1.0, effective 2026-08-12). Business-team text: keep the wording and clause numbers.
 * Section 4 leaves out the live page's note to staff that the former cookie_client_id,
 * popup_shown_v2 and accept_cookies_i cookies must be removed before the notice goes live.
 */
export const COOKIES_POLICY: LegalPolicyDocument<"cookies"> = {
  slug: "cookies",
  title: "Cookie Notice and Preference Controls",
  summary:
    "Our Cookie Notice and the live preference centre, where you can accept, reject or customise at any time.",
  sections: [
    {
      id: "what-this-notice-covers",
      heading: "1. What this notice covers",
      blocks: [
        {
          type: "paragraph",
          text: "This notice explains cookies and other storage or access technologies used on www.thelax.art, including pixels, tags, local storage and similar identifiers. It must be read with the Privacy Notice.",
        },
      ],
    },
    {
      id: "consent-and-exceptions",
      heading: "2. Consent and exceptions",
      blocks: [
        {
          type: "paragraph",
          text: "2.1 We place or access a non-exempt technology only after you take a clear positive action. Accept all and Reject all are equally prominent on the first layer, and Customise provides granular controls. No non-essential switch is pre-selected.",
        },
        {
          type: "paragraph",
          text: "2.2 Continued browsing, scrolling, silence or closing the banner is not consent.",
        },
        {
          type: "paragraph",
          text: "2.3 Technology that is strictly necessary to provide a service you request may operate without consent. A narrow statutory exception, such as qualifying aggregate statistical analytics or appearance/functionality, is used only if every legal condition is met, users receive clear information and any required easy objection is available. An internal label of “analytics” does not by itself create an exception.",
        },
      ],
    },
    {
      id: "categories",
      heading: "3. Categories",
      blocks: [
        {
          type: "list",
          items: [
            "Strictly necessary: security, session, checkout, load balancing and remembering a privacy choice where genuinely required.",
            "Preferences/functionality: optional features and settings that are not essential.",
            "Analytics: measurement of use and performance. Consent is obtained unless a verified exception applies.",
            "Advertising: remarketing, ad measurement, profiling, cross-site or cross-device tracking and advertising personalisation. Consent is required.",
          ],
        },
      ],
    },
    {
      id: "live-inventory",
      heading: "4. Live inventory",
      blocks: [
        {
          type: "paragraph",
          text: "The inventory below is the approved production inventory for this release. The preference centre and this page must display the same live information. If a vendor, cookie name, purpose or duration changes, update both before deployment.",
        },
        {
          type: "table",
          caption: "4. Live inventory",
          columns: [
            "Name / technology",
            "Provider",
            "Purpose",
            "Category / legal position",
            "Party",
            "Duration",
            "Data destination",
            "Control",
          ],
          rows: [
            [
              "PHPSESSID",
              "London Art Exchange",
              "Secure account, form and checkout session",
              "Strictly necessary",
              "First party",
              "Session",
              "UK website hosting",
              "Always active",
            ],
            [
              "lax_cookie_preferences",
              "London Art Exchange",
              "Remember consent choice and notice version",
              "Strictly necessary preference",
              "First party",
              "90 days",
              "UK website hosting",
              "Always active",
            ],
            [
              "popup preference",
              "London Art Exchange",
              "Remember a user-dismissed catalogue prompt",
              "Optional functionality",
              "First party",
              "30 days",
              "UK website hosting",
              "Functional opt-in or direct user request",
            ],
            [
              "_ga",
              "Google Analytics",
              "Distinguish visitors for website measurement",
              "Analytics; consent required",
              "First party; Google recipient",
              "Up to 2 years",
              "Google services; protected transfer where applicable",
              "Analytics opt-in",
            ],
            [
              "_ga_YGZCF5FD67",
              "Google Analytics",
              "Maintain session state for GA4 property G-YGZCF5FD67",
              "Analytics; consent required",
              "First party; Google recipient",
              "Up to 2 years",
              "Google services; protected transfer where applicable",
              "Analytics opt-in",
            ],
            [
              "_gcl_au / _gcl_aw",
              "Google Ads",
              "Conversion measurement and advertising attribution",
              "Advertising; consent required",
              "First party; Google recipient",
              "Up to 90 days",
              "Google services; protected transfer where applicable",
              "Advertising opt-in",
            ],
            [
              "SalesIQ cookies / local storage",
              "Zoho SalesIQ",
              "User-requested live chat and optional visitor/session continuity",
              "Functionality; consent required before widget loads",
              "Zoho-hosted",
              "Session; any permitted persistent identifier no more than 12 months",
              "Zoho EU services; protected transfer where applicable",
              "Functional opt-in",
            ],
          ],
        },
        {
          type: "paragraph",
          text: "The replacement consent record is limited to 90 days. PHPSESSID remains session-only and must use Secure, HttpOnly and SameSite=Lax or SameSite=Strict as appropriate.",
        },
      ],
    },
    {
      id: "changing-your-choice",
      heading: "5. Changing your choice",
      blocks: [
        {
          type: "paragraph",
          text: "You can reopen Cookie settings from the footer of every page and withdraw or change consent as easily as you gave it. Withdrawal stops future non-exempt access and is passed to relevant tags and partners. It does not make earlier consented processing unlawful.",
        },
      ],
    },
    {
      id: "consent-records-and-refresh",
      heading: "6. Consent records and refresh",
      blocks: [
        {
          type: "paragraph",
          text: "We record the choice, timestamp, consent-policy version, categories and a pseudonymous identifier needed for proof. We do not retain proof longer than necessary. We ask again when purposes or vendors materially change, consent is no longer valid, or the approved refresh period is reached. A rejection is not repeatedly nagged at every page view.",
        },
      ],
    },
    {
      id: "browser-controls",
      heading: "7. Browser controls",
      blocks: [
        {
          type: "paragraph",
          text: "Browser controls may block or delete technologies, but they are not a substitute for our consent controls. Blocking strictly necessary storage may prevent requested checkout or security features.",
        },
      ],
    },
  ],
} as const;
