import { rawOrgSettings } from "@auction/accounting-zoho-books/testing";
import type { createDb } from "@auction/db";
import type { Logger } from "pino";
import { describe, expect, it, vi } from "vitest";
import { createAccountingRuntime } from "./create-accounting-runtime.js";

const db = {} as ReturnType<typeof createDb>;
const log = { info: vi.fn(), warn: vi.fn() } as unknown as Logger;
const WEB_ORIGIN = "http://localhost:3000";
const SHOP_STOREFRONT_URL = "http://localhost:3020";
const io = {
  storage: { putObject: vi.fn() },
  email: { enqueue: vi.fn() },
};

describe("createAccountingRuntime", () => {
  it("builds nothing without Books organisation settings", () => {
    expect(
      createAccountingRuntime({ env: { WEB_ORIGIN, SHOP_STOREFRONT_URL }, db, log, ...io }),
    ).toBeUndefined();
  });

  it("builds the projector and a rehearsal-only sender from the settings", () => {
    const runtime = createAccountingRuntime({
      env: {
        ZOHO_BOOKS_ORG_CONFIG: JSON.stringify(rawOrgSettings()),
        WEB_ORIGIN,
        SHOP_STOREFRONT_URL,
      },
      db,
      log,
      ...io,
    });
    expect(runtime?.projection).toBeDefined();
    expect(runtime?.sender).toBeDefined();
    expect(runtime?.watch).toBeDefined();
    expect(runtime?.invoiceCopy).toBeDefined();
    expect(runtime?.remainder).toBeDefined();
    expect(runtime?.senderCheckIn).toEqual(expect.any(Function));
    expect(log.info).toHaveBeenCalledWith({ modes: ["dry_run"] }, "accounting_runtime_built");
    // A local storefront address is said at start-up: Shop invoices are not emailed live with it.
    expect(log.warn).toHaveBeenCalledWith(
      { reason: expect.stringMatching(/^SHOP_STOREFRONT_URL is not https/) },
      "accounting_shop_storefront_url_unusable",
    );
  });

  it("has no storefront default: unset is said at start-up, and nothing else changes", () => {
    const warn = vi.fn();
    const runtime = createAccountingRuntime({
      env: { ZOHO_BOOKS_ORG_CONFIG: JSON.stringify(rawOrgSettings()), WEB_ORIGIN },
      db,
      log: { info: vi.fn(), warn } as unknown as Logger,
      ...io,
    });
    expect(runtime?.invoiceCopy).toBeDefined();
    expect(warn).toHaveBeenCalledWith(
      { reason: expect.stringMatching(/^SHOP_STOREFRONT_URL is not set/) },
      "accounting_shop_storefront_url_unusable",
    );
  });

  it("refuses broken settings when the worker starts", () => {
    expect(() =>
      createAccountingRuntime({
        env: { ZOHO_BOOKS_ORG_CONFIG: "{}", WEB_ORIGIN, SHOP_STOREFRONT_URL },
        db,
        log,
        ...io,
      }),
    ).toThrow();
  });
});
