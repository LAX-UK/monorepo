import { LAX_PRODUCT_NAMES, legalEntityFor } from "@auction/branding";
import type { LegalPolicyDocument, LegalPolicyRelease } from "../policy/policy-document.js";

/**
 * The privacy notice and cookie policy of London Art Exchange Ltd, which runs LAX Shop and
 * lax.art. Both products publish the same text, each on its own site, with the shared legal
 * layout and the same draft rules as Shop's policies.
 */
export type ArtExchangeNoticeSlug = "privacy" | "cookies";

export const ART_EXCHANGE_NOTICE_RELEASES: Readonly<
  Record<ArtExchangeNoticeSlug, LegalPolicyRelease>
> = {
  privacy: { status: "draft", version: "0.1", lastUpdated: "2026-10-25" },
  cookies: { status: "draft", version: "0.1", lastUpdated: "2026-10-25" },
};

const COMPANY = legalEntityFor("shop").name;
const SHOP = LAX_PRODUCT_NAMES.shop;
const ART = LAX_PRODUCT_NAMES.art;
const ACCOUNT = LAX_PRODUCT_NAMES.account;
const BID = LAX_PRODUCT_NAMES.bid;

const PRIVACY_NOTICE: LegalPolicyDocument<"privacy"> = {
  slug: "privacy",
  title: "Privacy notice",
  summary: `How ${COMPANY} collects and uses your personal data when you use ${SHOP} or ${ART}, and the rights you have over it.`,
  sections: [
    {
      id: "who-we-are",
      heading: "Who we are",
      blocks: [
        {
          type: "paragraph",
          text: `${SHOP} and ${ART} are run by **${COMPANY}**. For the personal data described here, ${COMPANY} is the controller.`,
        },
        { type: "company", product: "shop" },
        {
          type: "list",
          items: [
            "Privacy contact: [TO CONFIRM: privacy contact email address]",
            "Data protection officer: [TO CONFIRM: name and contact of a data protection officer, or state that none is appointed]",
            "ICO registration number: [TO CONFIRM: ICO data protection fee registration number]",
          ],
        },
        {
          type: "paragraph",
          text: `You sign in with a ${ACCOUNT}, which is provided by ${legalEntityFor("bid").name} and ${COMPANY}. [TO CONFIRM: which company is controller for sign-in and account security data, and where its notice is published]`,
        },
      ],
    },
    {
      id: "what-we-collect",
      heading: "What we collect",
      blocks: [
        {
          type: "table",
          caption: "Personal data we collect and where it comes from",
          columns: ["What", "Examples", "Where it comes from"],
          rows: [
            ["Account details", "Name, email address, sign-in history", `Your ${ACCOUNT}`],
            [
              "Orders",
              "Items bought, delivery or collection choice, delivery address, order history",
              `You, at checkout on ${SHOP}`,
            ],
            [
              "Payments",
              "Payment status and the last digits and type of card. We never see or store your full card number.",
              "Stripe, our payment provider",
            ],
            [
              "Enquiries",
              "Name, email address, phone number, the work you asked about and your message",
              `You, through an enquiry form on ${ART} or ${SHOP}`,
            ],
            [
              "Saved works and alerts",
              "Favourites, your collection, and requests to hear when a work is back in stock",
              "You",
            ],
            ["Messages", "Emails and calls with our team", "You"],
            [
              "Technical data",
              "IP address, browser, pages viewed, and error reports",
              "Your device, our servers and, on lax.art with your consent, Google Analytics",
            ],
          ],
        },
        {
          type: "paragraph",
          text: "We do not ask for special category data, such as health or political opinions. Please do not include it in a message.",
        },
      ],
    },
    {
      id: "how-we-use-it",
      heading: "How we use it and our legal basis",
      blocks: [
        {
          type: "table",
          caption: "Why we use personal data and the lawful basis for each use",
          columns: ["Purpose", "Lawful basis"],
          rows: [
            ["Taking, paying for and delivering your order, and handling returns", "Contract"],
            [
              "Answering your enquiries and arranging viewings",
              "Contract, or our legitimate interest in replying to you",
            ],
            ["Keeping your account, favourites and alerts", "Contract"],
            ["Sending emails about your orders, enquiries and account", "Contract"],
            ["Keeping records for tax and accounting", "Legal obligation"],
            [
              "Preventing fraud and keeping the sites secure",
              "Legitimate interest in protecting customers and our business",
            ],
            [
              "Understanding how lax.art is used, through Google Analytics",
              "Consent, which you can withdraw at any time",
            ],
            [
              "Marketing emails",
              "[TO CONFIRM: whether marketing emails are sent; if so, consent or soft opt-in, and how to unsubscribe]",
            ],
          ],
        },
      ],
    },
    {
      id: "who-we-share-it-with",
      heading: "Who we share it with",
      blocks: [
        {
          type: "paragraph",
          text: "We share personal data only with the service providers who help us run the sites, and only for the purposes above. They act on our instructions.",
        },
        {
          type: "list",
          items: [
            "**Stripe**, to take payments.",
            "**Google Analytics**, on lax.art only and only with your consent.",
            "Hosting and infrastructure: [TO CONFIRM: hosting and database providers]",
            "Email delivery: [TO CONFIRM: email delivery provider]",
            "**Sentry**, to report errors so we can fix them.",
            "Couriers and art handlers, to deliver your order: [TO CONFIRM: couriers used]",
            `${legalEntityFor("bid").name}, which runs ${BID} and co-provides ${ACCOUNT}, for sign-in and account security. [TO CONFIRM: data sharing arrangement between the two companies]`,
          ],
        },
        {
          type: "paragraph",
          text: "We may also share data when the law requires it, for example with HMRC or the police, or to protect our legal rights. We do not sell personal data.",
        },
      ],
    },
    {
      id: "international-transfers",
      heading: "International transfers",
      blocks: [
        {
          type: "paragraph",
          text: "Some providers process data outside the UK, for example in the United States. Where they do, we rely on UK adequacy regulations or the International Data Transfer Agreement or Addendum. [TO CONFIRM: transfers and safeguards for each provider]",
        },
      ],
    },
    {
      id: "how-long-we-keep-it",
      heading: "How long we keep it",
      blocks: [
        {
          type: "table",
          caption: "How long each kind of personal data is kept",
          columns: ["Data", "How long"],
          rows: [
            [
              "Orders and payment records",
              "[TO CONFIRM: retention period, for example 6 years after the end of the tax year]",
            ],
            ["Enquiries", "[TO CONFIRM: retention period for enquiries]"],
            [
              "Account, favourites and alerts",
              "Until you delete your account, then [TO CONFIRM: period]",
            ],
            ["Sign-in sessions", "Deleted 7 days after they expire"],
            [
              "Analytics data in Google Analytics",
              "[TO CONFIRM: retention set in Google Analytics, for example 14 months]",
            ],
          ],
        },
      ],
    },
    {
      id: "your-rights",
      heading: "Your rights",
      blocks: [
        {
          type: "paragraph",
          text: "Under UK data protection law you can ask us to:",
        },
        {
          type: "list",
          items: [
            "give you a copy of your personal data",
            "correct data that is wrong",
            "delete your data, where we no longer need to keep it",
            "restrict or object to how we use it",
            "send your data to you or another organisation in a portable format",
            "withdraw your consent, where we rely on it",
          ],
        },
        {
          type: "paragraph",
          text: "To use a right, contact [TO CONFIRM: privacy contact email address]. We reply within one month. You can delete your account from your account settings.",
        },
      ],
    },
    {
      id: "cookies",
      heading: "Cookies",
      blocks: [
        {
          type: "paragraph",
          text: "We use cookies to keep you signed in, keep your basket and remember your choices. On lax.art we use analytics cookies only if you accept them. Our cookie policy lists every cookie.",
        },
      ],
    },
    {
      id: "complaints",
      heading: "Complaints",
      blocks: [
        {
          type: "paragraph",
          text: "Please contact us first if you are unhappy with how we use your data. You can also complain to the Information Commissioner's Office at [ico.org.uk](https://ico.org.uk) or on 0303 123 1113.",
        },
      ],
    },
    {
      id: "changes",
      heading: "Changes to this notice",
      blocks: [
        {
          type: "paragraph",
          text: "We update this notice when the way we use personal data changes. The date at the top shows the latest version.",
        },
      ],
    },
  ],
};

const SHOP_COOKIES: readonly (readonly string[])[] = [
  ["shop_identity_session", "Keeps you signed in", "Essential", "7 days"],
  ["shop_identity_id_token", "Lets you sign out safely", "Essential", "7 days"],
  ["shop_basket_token", "Remembers your basket", "Essential", "14 days"],
  ["shop_commerce_csrf", "Protects forms and checkout from forgery", "Essential", "7 days"],
  [
    "shop_sso_probe",
    "Checks once whether you are already signed in to LAX",
    "Essential",
    "10 minutes",
  ],
  ["shop_sso_quiet", "Stops that check repeating", "Essential", "30 minutes"],
  ["shop_sso_suppressed", "Remembers that you signed out", "Essential", "30 days"],
  ["shop_sso_notice", "Shows a one-off “You are signed in” message", "Essential", "2 minutes"],
  ["lax_theme", "Remembers light or dark mode", "Preference", "1 year"],
];

const ART_COOKIES: readonly (readonly string[])[] = [
  ["shop_identity_session", "Keeps you signed in", "Essential", "7 days"],
  ["shop_identity_id_token", "Lets you sign out safely", "Essential", "7 days"],
  ["shop_basket_token", "Remembers works you are buying", "Essential", "14 days"],
  ["shop_commerce_csrf", "Protects forms from forgery", "Essential", "7 days"],
  ["lax_art_consent", "Remembers whether you accepted analytics cookies", "Essential", "180 days"],
  ["lax_theme", "Remembers light or dark mode", "Preference", "1 year"],
  ["_ga", "Google Analytics: tells visits apart", "Analytics, only with consent", "2 years"],
  [
    "_ga_<id>",
    "Google Analytics: keeps the state of a visit",
    "Analytics, only with consent",
    "2 years",
  ],
];

const COOKIE_POLICY: LegalPolicyDocument<"cookies"> = {
  slug: "cookies",
  title: "Cookie policy",
  summary: `The cookies ${SHOP} and ${ART} set, what each one does and how long it lasts.`,
  sections: [
    {
      id: "about-cookies",
      heading: "About cookies",
      blocks: [
        {
          type: "paragraph",
          text: `A cookie is a small file a website stores on your device. ${SHOP} and ${ART} are run by ${COMPANY}. We set essential cookies so the sites work, a preference cookie for light or dark mode, and, on lax.art only, analytics cookies if you accept them.`,
        },
        {
          type: "paragraph",
          text: "Essential cookies do not need your consent, because the sites cannot work without them. We do not use advertising cookies.",
        },
      ],
    },
    {
      id: "lax-shop",
      heading: "Cookies on LAX Shop",
      blocks: [
        {
          type: "table",
          caption: "Cookies set by LAX Shop",
          columns: ["Name", "Purpose", "Type", "Lasts"],
          rows: SHOP_COOKIES,
        },
        {
          type: "paragraph",
          text: "LAX Shop does not use analytics cookies.",
        },
      ],
    },
    {
      id: "lax-art",
      heading: "Cookies on lax.art",
      blocks: [
        {
          type: "table",
          caption: "Cookies set by lax.art",
          columns: ["Name", "Purpose", "Type", "Lasts"],
          rows: ART_COOKIES,
        },
        {
          type: "paragraph",
          text: "Google Analytics cookies are set only after you choose “Accept” in the cookie banner. [TO CONFIRM: the cookie lifetimes set in Google Analytics]",
        },
      ],
    },
    {
      id: "payments",
      heading: "Payments",
      blocks: [
        {
          type: "paragraph",
          text: "When you pay, you complete checkout on a page run by Stripe, which sets its own cookies to process the payment and prevent fraud. Stripe's [cookie policy](https://stripe.com/cookies-policy/legal) explains them.",
        },
      ],
    },
    {
      id: "your-choices",
      heading: "Your choices",
      blocks: [
        {
          type: "list",
          items: [
            "On lax.art, choose “Cookie preferences” in the footer to accept or reject analytics cookies at any time. Rejecting them deletes the Google Analytics cookies.",
            "You can also block or delete cookies in your browser settings. If you block essential cookies, you cannot sign in or buy.",
          ],
        },
        {
          type: "paragraph",
          text: "Questions about cookies: [TO CONFIRM: privacy contact email address].",
        },
      ],
    },
  ],
};

export const ART_EXCHANGE_NOTICES: Readonly<
  Record<ArtExchangeNoticeSlug, LegalPolicyDocument<ArtExchangeNoticeSlug>>
> = {
  privacy: PRIVACY_NOTICE,
  cookies: COOKIE_POLICY,
};
