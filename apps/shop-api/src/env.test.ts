import { afterEach, describe, expect, it, vi } from "vitest";
import { STRIPE_DEPENDENT_FLAGS, loadShopApiEnv } from "./env.js";

function productionNodeBase(overrides: Record<string, string> = {}) {
  return {
    NODE_ENV: "production",
    DATABASE_URL_SHOP: "postgres://localhost/shop",
    SHOP_API_BFF_TOKEN: "b".repeat(32),
    STRIPE_SECRET_KEY: "sk_test_key",
    STRIPE_WEBHOOK_SECRET: "whsec_test",
    ...overrides,
  };
}

describe("loadShopApiEnv LAX_ART_PUBLIC_URL", () => {
  it("is optional and treats an empty value as unset", () => {
    expect(loadShopApiEnv(productionNodeBase()).LAX_ART_PUBLIC_URL).toBeUndefined();
    expect(
      loadShopApiEnv(productionNodeBase({ LAX_ART_PUBLIC_URL: "" })).LAX_ART_PUBLIC_URL,
    ).toBeUndefined();
  });

  it("accepts an absolute URL", () => {
    expect(
      loadShopApiEnv(productionNodeBase({ LAX_ART_PUBLIC_URL: "https://test-art.lax.bid" }))
        .LAX_ART_PUBLIC_URL,
    ).toBe("https://test-art.lax.bid");
  });

  it("rejects a non-URL value", () => {
    expect(() => loadShopApiEnv(productionNodeBase({ LAX_ART_PUBLIC_URL: "lax.art" }))).toThrow();
  });
});

describe("loadShopApiEnv SHOP_EXPRESS_CHECKOUT", () => {
  it("is off unless set to true, even in production", () => {
    expect(loadShopApiEnv(productionNodeBase()).SHOP_EXPRESS_CHECKOUT).toBe(false);
    expect(
      loadShopApiEnv(productionNodeBase({ SHOP_EXPRESS_CHECKOUT: "false" })).SHOP_EXPRESS_CHECKOUT,
    ).toBe(false);
    expect(
      loadShopApiEnv(productionNodeBase({ SHOP_EXPRESS_CHECKOUT: "true" })).SHOP_EXPRESS_CHECKOUT,
    ).toBe(true);
  });

  it("rejects anything but true or false", () => {
    expect(() => loadShopApiEnv(productionNodeBase({ SHOP_EXPRESS_CHECKOUT: "1" }))).toThrow();
  });
});

describe("loadShopApiEnv SHOP_EDITION_ORDER_LIMIT", () => {
  it("defaults to two copies of an edition per order", () => {
    expect(loadShopApiEnv(productionNodeBase()).SHOP_EDITION_ORDER_LIMIT).toBe(2);
  });

  it("takes a whole number, or none to leave only the stock", () => {
    expect(
      loadShopApiEnv(productionNodeBase({ SHOP_EDITION_ORDER_LIMIT: "4" }))
        .SHOP_EDITION_ORDER_LIMIT,
    ).toBe(4);
    expect(
      loadShopApiEnv(productionNodeBase({ SHOP_EDITION_ORDER_LIMIT: "none" }))
        .SHOP_EDITION_ORDER_LIMIT,
    ).toBeNull();
  });

  it("rejects anything else", () => {
    for (const value of ["0", "-1", "two", "1.5"]) {
      expect(() =>
        loadShopApiEnv(productionNodeBase({ SHOP_EDITION_ORDER_LIMIT: value })),
      ).toThrow();
    }
  });
});

describe("loadShopApiEnv delivery outside the UK", () => {
  it("does not charge export delivery until it is switched on, even in production", () => {
    const env = loadShopApiEnv(productionNodeBase());
    expect(env.SHOP_EXPORT_PAYMENT_ENABLED).toBe(false);
    expect(
      loadShopApiEnv(productionNodeBase({ SHOP_EXPORT_PAYMENT_ENABLED: "true" }))
        .SHOP_EXPORT_PAYMENT_ENABLED,
    ).toBe(true);
  });

  it("holds a guest's print for one working day unless set, within one to three", () => {
    expect(loadShopApiEnv(productionNodeBase()).SHOP_GUEST_QUOTE_HOLD_WORKING_DAYS).toBe(1);
    expect(
      loadShopApiEnv(productionNodeBase({ SHOP_GUEST_QUOTE_HOLD_WORKING_DAYS: "3" }))
        .SHOP_GUEST_QUOTE_HOLD_WORKING_DAYS,
    ).toBe(3);
    for (const value of ["0", "4", "one", "1.5"]) {
      expect(() =>
        loadShopApiEnv(productionNodeBase({ SHOP_GUEST_QUOTE_HOLD_WORKING_DAYS: value })),
      ).toThrow();
    }
  });
});

describe("loadShopApiEnv lax.art revalidation", () => {
  const secret = "r".repeat(32);

  it("is optional as a pair", () => {
    const env = loadShopApiEnv(productionNodeBase());
    expect(env.ART_REVALIDATE_URL).toBeUndefined();
    expect(env.ART_REVALIDATE_SECRET).toBeUndefined();
  });

  it("accepts the URL and secret together", () => {
    const env = loadShopApiEnv(
      productionNodeBase({
        ART_REVALIDATE_URL: "https://lax.art/api/revalidate",
        ART_REVALIDATE_SECRET: secret,
      }),
    );
    expect(env.ART_REVALIDATE_URL).toBe("https://lax.art/api/revalidate");
  });

  it("rejects one without the other", () => {
    expect(() =>
      loadShopApiEnv(productionNodeBase({ ART_REVALIDATE_URL: "https://lax.art/api/revalidate" })),
    ).toThrow("must be set together");
    expect(() => loadShopApiEnv(productionNodeBase({ ART_REVALIDATE_SECRET: secret }))).toThrow(
      "must be set together",
    );
  });
});

describe("loadShopApiEnv Connect platform", () => {
  it("allows bid_sandbox payouts on test when NODE_ENV is production", () => {
    expect(() =>
      loadShopApiEnv(
        productionNodeBase({
          APP_ENV: "test",
          SHOP_PAYOUTS_ENABLED: "true",
          STRIPE_SHOP_CONNECT_PLATFORM_KEY: "bid_sandbox",
        }),
      ),
    ).not.toThrow();
  });

  it("requires lax_art when deployment tier is production and payouts are enabled", () => {
    expect(() =>
      loadShopApiEnv(
        productionNodeBase({
          SHOP_PAYOUTS_ENABLED: "true",
          STRIPE_SHOP_CONNECT_PLATFORM_KEY: "bid_sandbox",
        }),
      ),
    ).toThrow(/STRIPE_SHOP_CONNECT_PLATFORM_KEY=lax_art/);
  });

  it("allows lax_art on production payouts", () => {
    expect(() =>
      loadShopApiEnv(
        productionNodeBase({
          APP_ENV: "production",
          SHOP_PAYOUTS_ENABLED: "true",
          STRIPE_SHOP_CONNECT_PLATFORM_KEY: "lax_art",
        }),
      ),
    ).not.toThrow();
  });
});

describe("loadShopApiEnv Stripe on test", () => {
  // Built from parts so no complete key-shaped string sits in the source.
  const liveKey = (prefix: string) => `${prefix}_live_${"x".repeat(16)}`;
  const testBase = (overrides: Record<string, string> = {}) =>
    productionNodeBase({ APP_ENV: "test", ...overrides });

  it("refuses a live secret key when APP_ENV=test", () => {
    expect(() => loadShopApiEnv(testBase({ STRIPE_SECRET_KEY: liveKey("sk") }))).toThrow(
      /STRIPE_SECRET_KEY must use a test key/,
    );
  });

  it("refuses a live publishable key when APP_ENV=test", () => {
    expect(() => loadShopApiEnv(testBase({ STRIPE_PUBLISHABLE_KEY: liveKey("pk") }))).toThrow(
      /STRIPE_PUBLISHABLE_KEY must use a test key/,
    );
  });

  it("refuses the live Connect platform when APP_ENV=test", () => {
    expect(() => loadShopApiEnv(testBase({ STRIPE_SHOP_CONNECT_PLATFORM_KEY: "lax_art" }))).toThrow(
      /STRIPE_SHOP_CONNECT_PLATFORM_KEY must be bid_sandbox unless APP_ENV=production/,
    );
  });

  it("accepts test keys on the sandbox platform", () => {
    expect(() => loadShopApiEnv(testBase({ STRIPE_PUBLISHABLE_KEY: "pk_test_key" }))).not.toThrow();
  });

  it("refuses live keys and the live platform when APP_ENV is unset, even with NODE_ENV=production", () => {
    // A deployed test host runs NODE_ENV=production; without APP_ENV it must not pass for production.
    expect(() => loadShopApiEnv(productionNodeBase({ STRIPE_SECRET_KEY: liveKey("sk") }))).toThrow(
      /STRIPE_SECRET_KEY must use a test key/,
    );
    expect(() =>
      loadShopApiEnv(productionNodeBase({ STRIPE_SHOP_CONNECT_PLATFORM_KEY: "lax_art" })),
    ).toThrow(/STRIPE_SHOP_CONNECT_PLATFORM_KEY must be bid_sandbox/);
  });

  it("refuses an APP_ENV that is set but not production, test or development", () => {
    for (const value of ["Test", "staging", "prod", " production"]) {
      expect(() => loadShopApiEnv(productionNodeBase({ APP_ENV: value }))).toThrow(
        /APP_ENV must be one of production, test, development/,
      );
    }
  });

  it("leaves production keys to the production checks", () => {
    expect(() =>
      loadShopApiEnv(
        productionNodeBase({ APP_ENV: "production", STRIPE_SECRET_KEY: liveKey("sk") }),
      ),
    ).not.toThrow();
  });
});

describe("loadShopApiEnv editorial", () => {
  it("requires a preview secret when editorial is enabled on a production build", () => {
    expect(() => loadShopApiEnv(productionNodeBase({ SHOP_EDITORIAL_ENABLED: "true" }))).toThrow(
      /SHOP_EDITORIAL_PREVIEW_SECRET is required/,
    );
    expect(() =>
      loadShopApiEnv(
        productionNodeBase({
          SHOP_EDITORIAL_ENABLED: "true",
          SHOP_EDITORIAL_PREVIEW_SECRET: "p".repeat(32),
        }),
      ),
    ).not.toThrow();
    expect(() => loadShopApiEnv(productionNodeBase())).not.toThrow();
  });
});

describe("loadShopApiEnv SHOP_FINANCIAL_YEAR_END", () => {
  it("defaults to 30 September and reads a configured MM-DD", () => {
    expect(loadShopApiEnv(productionNodeBase()).SHOP_FINANCIAL_YEAR_END).toEqual({
      month: 9,
      day: 30,
    });
    expect(
      loadShopApiEnv(productionNodeBase({ SHOP_FINANCIAL_YEAR_END: "03-31" }))
        .SHOP_FINANCIAL_YEAR_END,
    ).toEqual({ month: 3, day: 31 });
  });

  it("refuses a date that is not a day of the year", () => {
    expect(() =>
      loadShopApiEnv(productionNodeBase({ SHOP_FINANCIAL_YEAR_END: "09-31" })),
    ).toThrow();
  });
});

describe("loadShopApiEnv Stripe requirement", () => {
  const withoutStripe = (overrides: Record<string, string> = {}) =>
    productionNodeBase({ STRIPE_SECRET_KEY: "", STRIPE_WEBHOOK_SECRET: "", ...overrides });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("refuses to start in production without Stripe by default", () => {
    expect(() => loadShopApiEnv(withoutStripe())).toThrow(
      /STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET required in production/,
    );
    expect(() =>
      loadShopApiEnv(withoutStripe({ APP_ENV: "production", STRIPE_SECRET_KEY: "sk_live_key" })),
    ).toThrow(/STRIPE_WEBHOOK_SECRET required in production/);
  });

  it("starts with payments disabled and a warning while Stripe is not required", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const env = loadShopApiEnv(withoutStripe({ SHOP_REQUIRE_STRIPE: "false" }));
    expect(env.SHOP_REQUIRE_STRIPE).toBe(false);
    expect(env.STRIPE_SECRET_KEY).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/checkout, refunds and Connect payouts are disabled/),
    );
  });

  it.each(STRIPE_DEPENDENT_FLAGS)(
    "refuses %s without Stripe even when Stripe is not required",
    (flag) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      expect(() =>
        loadShopApiEnv(
          withoutStripe({
            SHOP_REQUIRE_STRIPE: "false",
            // Payouts on production need the lax_art platform key; keep that rule out of the way.
            APP_ENV: "production",
            STRIPE_SHOP_CONNECT_PLATFORM_KEY: "lax_art",
            [flag]: "true",
          }),
        ),
      ).toThrow(new RegExp(`${flag} need Stripe: set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET`));
      expect(warn).not.toHaveBeenCalled();
    },
  );

  it.each(STRIPE_DEPENDENT_FLAGS)("allows %s once Stripe is configured", (flag) => {
    expect(() =>
      loadShopApiEnv(
        productionNodeBase({
          SHOP_REQUIRE_STRIPE: "false",
          APP_ENV: "production",
          STRIPE_SHOP_CONNECT_PLATFORM_KEY: "lax_art",
          [flag]: "true",
        }),
      ),
    ).not.toThrow();
  });

  it("stays silent when Stripe is configured", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    loadShopApiEnv(productionNodeBase({ SHOP_REQUIRE_STRIPE: "false" }));
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("loadShopApiEnv email alerts", () => {
  it("leaves digests off by default", () => {
    const env = loadShopApiEnv(productionNodeBase());
    expect(env.ALERTS_SEND_MODE).toBe("off");
    expect(env.ALERT_LINK_KEY_ID).toBe("k1");
  });

  it("keeps the alert retention purge off unless it is switched on", () => {
    expect(loadShopApiEnv(productionNodeBase()).ALERT_RETENTION_PURGE_ENABLED).toBe(false);
    for (const value of ["", "false", "0", "off", "nonsense"]) {
      expect(
        loadShopApiEnv(productionNodeBase({ ALERT_RETENTION_PURGE_ENABLED: value }))
          .ALERT_RETENTION_PURGE_ENABLED,
        value,
      ).toBe(false);
    }
    for (const value of ["true", "1", "yes", "ON", " true "]) {
      expect(
        loadShopApiEnv(productionNodeBase({ ALERT_RETENTION_PURGE_ENABLED: value }))
          .ALERT_RETENTION_PURGE_ENABLED,
        value,
      ).toBe(true);
    }
  });

  it("refuses to send in production without a strong link secret", () => {
    expect(() => loadShopApiEnv(productionNodeBase({ ALERTS_SEND_MODE: "on" }))).toThrow(
      "ALERT_LINK_SECRET",
    );
    expect(
      loadShopApiEnv(
        productionNodeBase({ ALERTS_SEND_MODE: "on", ALERT_LINK_SECRET: "s".repeat(40) }),
      ).ALERTS_SEND_MODE,
    ).toBe("on");
  });

  it("takes the previous key during a rotation, and treats empty values as unset", () => {
    const env = loadShopApiEnv(
      productionNodeBase({
        ALERT_LINK_PREVIOUS_SECRET: "p".repeat(20),
        ALERT_LINK_PREVIOUS_KEY_ID: "k0",
      }),
    );
    expect(env.ALERT_LINK_PREVIOUS_KEY_ID).toBe("k0");
    const empty = loadShopApiEnv(
      productionNodeBase({ ALERT_LINK_PREVIOUS_SECRET: "", ALERT_LINK_PREVIOUS_KEY_ID: "" }),
    );
    expect(empty.ALERT_LINK_PREVIOUS_SECRET).toBeUndefined();
  });
});

describe("loadShopApiEnv Zoho mirror modes", () => {
  it("leaves the modes unknown when they are not set", () => {
    const env = loadShopApiEnv(productionNodeBase());
    expect(env.ZOHO_FULFILMENT_MIRROR_MODE).toBeUndefined();
    expect(env.ZOHO_ARTWORK_WRITEBACK_MODE).toBeUndefined();
    expect(env.ZOHO_ARTWORK_LISTING_MODE).toBeUndefined();
  });

  it("reads the worker's modes and refuses any other value", () => {
    const env = loadShopApiEnv(
      productionNodeBase({
        ZOHO_FULFILMENT_MIRROR_MODE: "off",
        ZOHO_ARTWORK_WRITEBACK_MODE: "live",
        ZOHO_ARTWORK_LISTING_MODE: "dry_run",
      }),
    );
    expect(env.ZOHO_FULFILMENT_MIRROR_MODE).toBe("off");
    expect(env.ZOHO_ARTWORK_WRITEBACK_MODE).toBe("live");
    expect(env.ZOHO_ARTWORK_LISTING_MODE).toBe("dry_run");
    expect(() =>
      loadShopApiEnv(productionNodeBase({ ZOHO_FULFILMENT_MIRROR_MODE: "on" })),
    ).toThrow();
  });
});
