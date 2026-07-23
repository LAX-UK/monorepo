import type { Env } from "../env.js";

export class XeroApiWritesDisabledError extends Error {
  constructor() {
    super("xero_api_writes_disabled");
    this.name = "XeroApiWritesDisabledError";
  }
}

export function assertXeroApiWritesAllowed(env: Pick<Env, "XERO_API_WRITES_DISABLED">): void {
  if (env.XERO_API_WRITES_DISABLED) {
    throw new XeroApiWritesDisabledError();
  }
}
