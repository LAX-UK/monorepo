import { rawOrgSettings } from "@auction/accounting-zoho-books/testing";
import type { createDb } from "@auction/db";
import type { Logger } from "pino";
import { describe, expect, it, vi } from "vitest";
import { createAccountingRuntime } from "./create-accounting-runtime.js";

const db = {} as ReturnType<typeof createDb>;
const log = { info: vi.fn() } as unknown as Logger;

describe("createAccountingRuntime", () => {
  it("builds nothing without Books organisation settings", () => {
    expect(createAccountingRuntime({ env: {}, db, log })).toBeUndefined();
  });

  it("builds the projector and a rehearsal-only sender from the settings", () => {
    const runtime = createAccountingRuntime({
      env: { ZOHO_BOOKS_ORG_CONFIG: JSON.stringify(rawOrgSettings()) },
      db,
      log,
    });
    expect(runtime?.projection).toBeDefined();
    expect(runtime?.sender).toBeDefined();
    expect(log.info).toHaveBeenCalledWith({ modes: ["dry_run"] }, "accounting_runtime_built");
  });

  it("refuses broken settings when the worker starts", () => {
    expect(() =>
      createAccountingRuntime({ env: { ZOHO_BOOKS_ORG_CONFIG: "{}" }, db, log }),
    ).toThrow();
  });
});
