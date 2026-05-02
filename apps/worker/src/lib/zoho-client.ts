import type { WorkerEnv } from "../env.js";

export class ZohoClient {
  constructor(private readonly env: WorkerEnv) {}

  enabled(): boolean {
    return Boolean(
      this.env.ZOHO_CLIENT_ID && this.env.ZOHO_CLIENT_SECRET && this.env.ZOHO_REFRESH_TOKEN,
    );
  }

  async upsert(module: "Contacts" | "Deals" | "Sales_Orders", payload: Record<string, unknown>) {
    if (!this.enabled()) return { ok: false as const, skipped: true as const };
    // Outbound HTTP is intentionally centralized here so retry/backoff stays in the worker.
    // The first production pass should replace this with Zoho's upsert endpoint per module.
    return { ok: true as const, module, payload };
  }
}
