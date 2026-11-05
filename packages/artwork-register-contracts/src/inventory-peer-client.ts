import type { z } from "zod";
import {
  INVENTORY_INTERNAL_PREFIX,
  INVENTORY_MACHINE_HEADERS,
  InventoryPeerRefusedError,
  InventoryPeerUnavailableError,
  moveRefusalSchema,
} from "./move-originals.js";

const REQUEST_TIMEOUT_MS = 8_000;

export type InventoryPeerClientConfig = {
  /** The other product's API base URL (the private one where there is one). */
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
  /** How long to wait for an answer; a read that must not hold a page up asks for less. */
  timeoutMs?: number;
};

export type InventoryPeerClient = {
  /**
   * Calls `/internal/inventory<path>` on the other product. Resolves with the answer parsed by
   * `schema`; throws `InventoryPeerRefusedError` when the other product says no with a reason, and
   * `InventoryPeerUnavailableError` when it cannot be reached or answers something unexpected.
   */
  call<T>(method: "GET" | "POST", path: string, schema: z.ZodType<T>, body?: unknown): Promise<T>;
};

/**
 * One way for LAX Admin and LAX Bid to ask each other to do their half of a move. Both products
 * hold the same credential pair and send it in headers, the way their other machine routes work.
 */
export function createInventoryPeerClient(config: InventoryPeerClientConfig): InventoryPeerClient {
  const base = config.baseUrl.replace(/\/+$/, "");
  const fetchImpl = config.fetchImpl ?? fetch;

  async function call<T>(
    method: "GET" | "POST",
    path: string,
    schema: z.ZodType<T>,
    body?: unknown,
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetchImpl(`${base}${INVENTORY_INTERNAL_PREFIX}${path}`, {
        method,
        headers: {
          accept: "application/json",
          [INVENTORY_MACHINE_HEADERS.clientId]: config.clientId,
          [INVENTORY_MACHINE_HEADERS.clientSecret]: config.clientSecret,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(config.timeoutMs ?? REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new InventoryPeerUnavailableError(error instanceof Error ? error.name : "network");
    }
    const payload: unknown = await response.json().catch(() => null);
    if (response.ok) {
      const parsed = schema.safeParse(payload);
      if (!parsed.success) throw new InventoryPeerUnavailableError("unexpected answer");
      return parsed.data;
    }
    const refusal = moveRefusalSchema.safeParse(payload);
    if (refusal.success && response.status < 500) {
      throw new InventoryPeerRefusedError(refusal.data, response.status);
    }
    if (refusal.success && refusal.data.error === "not_configured") {
      throw new InventoryPeerRefusedError(refusal.data, response.status);
    }
    throw new InventoryPeerUnavailableError(`status ${response.status}`);
  }

  return { call };
}
