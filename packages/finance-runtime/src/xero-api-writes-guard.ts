import type { FinanceRuntimeEnv } from "./env-slice.js";

export class XeroApiWritesDisabledError extends Error {
  constructor() {
    super("xero_api_writes_disabled");
    this.name = "XeroApiWritesDisabledError";
  }
}

export function assertXeroApiWritesAllowed(
  env: Pick<FinanceRuntimeEnv, "XERO_API_WRITES_DISABLED">,
): void {
  if (env.XERO_API_WRITES_DISABLED) {
    throw new XeroApiWritesDisabledError();
  }
}
