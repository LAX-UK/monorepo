import {
  SHOP_API_ERROR_CODES,
  parsePortalArtistArtworks,
  parsePortalArtistSales,
  parsePortalPayeeConnectConfig,
  parsePortalPayeeConnectSession,
  parsePortalPayeeConnectStatus,
  parsePortalPayouts,
  parsePortalSaleAuthority,
  parsePortalSaleAuthorityRequests,
  parsePortalSales,
  parsePortalSellerAccess,
  parseSaleAuthorityRequestWithdrawResponse,
} from "@auction/shop-contracts";
import type { AccountProductScope, ResourceTokenProvider } from "../ports/portfolio-gateway";
import type { SessionHandle } from "../ports/portfolio-gateway";
import type { SellingGateway, SellingRead, SellingWrite } from "../ports/selling-gateway";

/** A read that does not answer in this time is reported unavailable; the page must not hang on it. */
export const SELLING_READ_TIMEOUT_MS = 4_000;
/** Changes get longer: creating a Stripe session can take a few seconds. */
export const SELLING_WRITE_TIMEOUT_MS = 10_000;

const SHOP_RESOURCE = "lax-shop-api" as const;

function readErrorCode(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const code = (body as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

/** Bounds the whole call, token exchange included, as the portfolio gateway does. */
function withDeadline<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const deadline = new Promise<never>((_resolve, reject) => {
    controller.signal.addEventListener("abort", () => reject(new Error("deadline")), {
      once: true,
    });
  });
  return Promise.race([run(controller.signal), deadline]).finally(() => clearTimeout(timer));
}

/**
 * Calls Shop's seller routes as the signed-in person. Reads use a `lax.selling.read` token and
 * changes a `lax.selling.write` one, each exchanged for Shop's API alone. Failures are logged
 * with the route and a reason, never a token or a body.
 */
export function createShopSellingGateway(deps: {
  apiUrl: string | undefined;
  tokens: ResourceTokenProvider;
  fetchImpl?: typeof fetch;
  readTimeoutMs?: number;
  writeTimeoutMs?: number;
}): SellingGateway {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const readTimeoutMs = deps.readTimeoutMs ?? SELLING_READ_TIMEOUT_MS;
  const writeTimeoutMs = deps.writeTimeoutMs ?? SELLING_WRITE_TIMEOUT_MS;

  async function call(
    handle: SessionHandle,
    scope: AccountProductScope,
    path: string,
    init: { method: "GET" | "POST"; body?: unknown },
    signal: AbortSignal,
  ): Promise<Response> {
    const token = await deps.tokens.tokenFor(handle, SHOP_RESOURCE, scope);
    return fetchImpl(`${deps.apiUrl}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      cache: "no-store",
      signal,
    });
  }

  async function read<T>(
    handle: SessionHandle,
    path: string,
    parse: (body: unknown) => T,
  ): Promise<SellingRead<T>> {
    if (!deps.apiUrl) {
      console.warn("account_selling_unconfigured", { path });
      return { status: "unavailable" };
    }
    try {
      return await withDeadline(readTimeoutMs, async (signal) => {
        const response = await call(handle, "lax.selling.read", path, { method: "GET" }, signal);
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          if (readErrorCode(body) === SHOP_API_ERROR_CODES.FEATURE_DISABLED) {
            return { status: "off" } as const;
          }
          console.warn("account_selling_read_failed", { path, status: response.status });
          return { status: "unavailable" } as const;
        }
        return { status: "ok", data: parse(body) } as const;
      });
    } catch (error) {
      console.warn("account_selling_read_failed", {
        path,
        reason: error instanceof Error ? error.name : "unknown",
      });
      return { status: "unavailable" };
    }
  }

  async function write<T>(
    handle: SessionHandle,
    path: string,
    body: unknown,
    parse: (body: unknown) => T,
  ): Promise<SellingWrite<T>> {
    if (!deps.apiUrl) return { status: "unavailable" };
    try {
      return await withDeadline(writeTimeoutMs, async (signal) => {
        const response = await call(
          handle,
          "lax.selling.write",
          path,
          { method: "POST", body },
          signal,
        );
        const payload: unknown = await response.json().catch(() => null);
        if (response.ok) return { status: "ok", data: parse(payload) } as const;
        if (response.status === 401) return { status: "signed_out" } as const;
        if (response.status === 400) return { status: "rejected", reason: "invalid" } as const;
        if (response.status === 403) return { status: "rejected", reason: "forbidden" } as const;
        if (response.status === 409) return { status: "rejected", reason: "conflict" } as const;
        if (response.status === 404 && readErrorCode(payload) === SHOP_API_ERROR_CODES.NOT_FOUND) {
          return { status: "rejected", reason: "not_found" } as const;
        }
        console.warn("account_selling_write_failed", { path, status: response.status });
        return { status: "unavailable" } as const;
      });
    } catch (error) {
      console.warn("account_selling_write_failed", {
        path,
        reason: error instanceof Error ? error.name : "unknown",
      });
      return { status: "unavailable" };
    }
  }

  return {
    readAccess: (handle) => read(handle, "/v1/me/seller-access", parsePortalSellerAccess),
    readEditions: (handle) => read(handle, "/v1/me/sale-authority", parsePortalSaleAuthority),
    readRequests: (handle) =>
      read(handle, "/v1/me/sale-authority-requests", parsePortalSaleAuthorityRequests),
    readSales: (handle) => read(handle, "/v1/me/sales", parsePortalSales),
    readPayouts: (handle) => read(handle, "/v1/me/payouts", parsePortalPayouts),
    async readPayoutAccount(handle) {
      const [status, config] = await Promise.all([
        read(handle, "/v1/me/connect/status", parsePortalPayeeConnectStatus),
        read(handle, "/v1/me/connect/config", parsePortalPayeeConnectConfig),
      ]);
      if (status.status === "ok" && config.status === "ok") {
        return { status: "ok", data: { status: status.data, config: config.data } };
      }
      if (status.status === "off" || config.status === "off") return { status: "off" };
      return { status: "unavailable" };
    },
    readArtistArtworks: (handle) =>
      read(handle, "/v1/me/artist/artworks", parsePortalArtistArtworks),
    readArtistSales: (handle) => read(handle, "/v1/me/artist/sales", parsePortalArtistSales),
    requestSaleChange: (handle, request) =>
      write(handle, "/v1/me/sale-authority-requests", request, (body) => {
        const requestId = (body as { requestId?: unknown } | null)?.requestId;
        if (typeof requestId !== "string") throw new Error("off_contract");
        return { requestId };
      }),
    withdrawRequest: (handle, requestId) =>
      write(
        handle,
        `/v1/me/sale-authority-requests/${encodeURIComponent(requestId)}/withdraw`,
        {},
        (body) => ({ requestId: parseSaleAuthorityRequestWithdrawResponse(body).requestId }),
      ),
    createPayoutSession: (handle, surface) =>
      write(handle, "/v1/me/connect/account-session", { surface }, parsePortalPayeeConnectSession),
  };
}
