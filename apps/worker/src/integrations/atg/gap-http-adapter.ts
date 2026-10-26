import {
  type AtgGateway,
  AtgGatewayError,
  type AtgIncrementSet,
  type AtgRemoteAuction,
  type AtgRemoteLot,
  type AtgSaleResult,
} from "./atg-gateway.js";
import { parseGapDate } from "./gap-date.js";
import type {
  GapAddUrlImageToLotRequest,
  GapAuctionResponse,
  GapCreateAuctionRequest,
  GapCreateLotRequest,
  GapErrorBody,
  GapIncrementDetailsResponse,
  GapLotResponse,
  GapSaleResultResponse,
  GapSupportedCategoryResponse,
  GapUpdateAuctionRequest,
  GapUpdateLotRequest,
} from "./gap-types.js";

type FetchLike = typeof fetch;
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type GapHttpAdapterOptions = {
  baseUrl: string;
  username: string;
  password: string;
  timeoutMs?: number;
  /** Injected for tests; defaults to global fetch. */
  fetchImpl?: FetchLike;
};

const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_ERROR_MESSAGE = 500;

export function isRetryableGapStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || (status >= 500 && status !== 501);
}

/** GAP API adapter: HTTP Basic Auth, per-request timeout, retry classification. */
export class GapHttpAdapter implements AtgGateway {
  private readonly baseUrl: string;
  private readonly authorization: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;

  constructor(opts: GapHttpAdapterOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.authorization = `Basic ${Buffer.from(`${opts.username}:${opts.password}`).toString("base64")}`;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async createAuction(request: GapCreateAuctionRequest): Promise<{ auctionId: string }> {
    const body = await this.call<{ AuctionId?: string }>(
      "createAuction",
      "POST",
      "/Auction/CreateAuction",
      request,
    );
    return { auctionId: requireId(body?.AuctionId, "createAuction", "AuctionId") };
  }

  async updateAuction(request: GapUpdateAuctionRequest): Promise<void> {
    await this.call("updateAuction", "PUT", "/Auction/UpdateAuction", request);
  }

  async publishAuction(auctionId: string): Promise<void> {
    await this.call("publishAuction", "POST", "/Auction/PublishAuction", { AuctionId: auctionId });
  }

  async closeAuction(auctionId: string): Promise<void> {
    await this.call("closeAuction", "POST", "/Auction/CloseAuction", { AuctionId: auctionId });
  }

  async createLot(request: GapCreateLotRequest): Promise<{ lotId: string }> {
    const body = await this.call<{ LotId?: string }>(
      "createLot",
      "POST",
      "/Lot/CreateLot",
      request,
    );
    return { lotId: requireId(body?.LotId, "createLot", "LotId") };
  }

  async updateLot(request: GapUpdateLotRequest): Promise<void> {
    await this.call("updateLot", "PATCH", "/Lot/UpdateLot", request);
  }

  async deleteLot(atgLotId: string): Promise<void> {
    try {
      await this.call(
        "deleteLot",
        "DELETE",
        `/Lot/DeleteLot?request.lotId=${encodeURIComponent(atgLotId)}`,
      );
    } catch (err) {
      if (err instanceof AtgGatewayError && err.status === 404) return;
      throw err;
    }
  }

  async addLotImageUrl(request: GapAddUrlImageToLotRequest): Promise<void> {
    await this.call("addLotImageUrl", "POST", "/Lot/AddUrlImageToLot", request);
  }

  async getLots(auctionId: string): Promise<AtgRemoteLot[]> {
    const rows = await this.call<GapLotResponse[]>(
      "getLots",
      "GET",
      `/Lot/v2/GetLots/${encodeURIComponent(auctionId)}`,
    );
    return (rows ?? []).flatMap((row) =>
      row.LotId
        ? [
            {
              atgLotId: row.LotId,
              lotNumber: row.LotNumber ?? null,
              status: row.Status ?? null,
              sold: row.Sold ?? null,
              hammerPrice: row.HammerPrice ?? null,
              currentMaxBid: row.CurrentMaxBid ?? null,
              numberOfBids: row.NumberOfBids ?? null,
              winningBidderId: row.WinningBidderId ?? null,
              endTimeUtc: parseGapDate(row.EndTimeUtc),
            },
          ]
        : [],
    );
  }

  async getSaleResults(auctionId: string): Promise<AtgSaleResult[]> {
    const rows = await this.call<GapSaleResultResponse[]>(
      "getSaleResults",
      "GET",
      `/Lot/GetSaleResults/${encodeURIComponent(auctionId)}`,
    );
    return (rows ?? []).map((row) => ({
      atgLotId: row.LotId ?? null,
      lotNumber: row.LotNumber ?? null,
      lotStatus: row.LotStatus ?? null,
      numberOfBids: row.NumberOfBids ?? null,
      paddleNumber: row.PaddleNumber ?? null,
      hammerPrice: row.HammerPrice ?? null,
      totalHammerPrice: row.TotalHammerPrice ?? null,
      endTimeUtc: parseGapDate(row.EndTimeUtc)?.toISOString() ?? null,
    }));
  }

  async getAuction(auctionId: string): Promise<AtgRemoteAuction | null> {
    try {
      const row = await this.call<GapAuctionResponse>(
        "getAuction",
        "GET",
        `/Auction/GetAuctionById/${encodeURIComponent(auctionId)}`,
      );
      return row ? toRemoteAuction(row, auctionId) : null;
    } catch (err) {
      if (err instanceof AtgGatewayError && err.status === 404) return null;
      throw err;
    }
  }

  async findAuctionsByClientId(clientId: string, fromDate: Date): Promise<AtgRemoteAuction[]> {
    // The Swagger documents a single object; the route name and ServiceStack return a list.
    const body = await this.call<GapAuctionResponse | GapAuctionResponse[]>(
      "findAuctionsByClientId",
      "GET",
      `/Auction/GetAuctionsByClientId/${encodeURIComponent(clientId)}?fromDate=${encodeURIComponent(fromDate.toISOString())}`,
    );
    const rows = Array.isArray(body) ? body : body ? [body] : [];
    return rows.flatMap((row) => (row.AuctionId ? [toRemoteAuction(row, row.AuctionId)] : []));
  }

  async getIncrementSets(clientId: string): Promise<AtgIncrementSet[]> {
    const rows = await this.call<GapIncrementDetailsResponse[]>(
      "getIncrementSets",
      "GET",
      `/Clients/GetIncrementDetails/${encodeURIComponent(clientId)}`,
    );
    return (rows ?? []).flatMap((row) =>
      row.IncrementSetId
        ? [{ incrementSetId: row.IncrementSetId, name: row.IncrementSetName ?? null }]
        : [],
    );
  }

  async getSupportedCategories(platformCode: string): Promise<string[]> {
    const rows = await this.call<GapSupportedCategoryResponse[]>(
      "getSupportedCategories",
      "GET",
      `/Auction/GetSupportedCategories/${encodeURIComponent(platformCode)}`,
    );
    return (rows ?? []).flatMap((row) => (row.CategoryName ? [row.CategoryName] : []));
  }

  private async call<T = unknown>(
    operation: string,
    method: HttpMethod,
    pathname: string,
    body?: unknown,
  ): Promise<T | null> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${pathname}`, {
        method,
        headers: {
          authorization: this.authorization,
          accept: "application/json",
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      const reason = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      throw new AtgGatewayError(
        `ATG ${operation} network error (${reason})`,
        true,
        null,
        operation,
      );
    }

    const text = await res.text().catch(() => "");
    if (!res.ok) {
      throw new AtgGatewayError(
        `ATG ${operation} failed with HTTP ${res.status}: ${errorMessage(text, res.status)}`,
        isRetryableGapStatus(res.status),
        res.status,
        operation,
      );
    }
    if (!text.trim()) return null;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new AtgGatewayError(
        `ATG ${operation} returned non-JSON body`,
        false,
        res.status,
        operation,
      );
    }
  }
}

function toRemoteAuction(row: GapAuctionResponse, fallbackId: string): AtgRemoteAuction {
  return {
    atgAuctionId: row.AuctionId ?? fallbackId,
    clientsAuctionId: row.ClientsAuctionId ?? null,
    isApproved: row.IsApproved === true,
    isPublished: row.IsPublished === true,
    statusCode: row.AuctionStatusCode ?? null,
  };
}

function requireId(value: string | undefined, operation: string, field: string): string {
  if (!value) {
    throw new AtgGatewayError(`ATG ${operation} response missing ${field}`, false, 200, operation);
  }
  return value;
}

function errorMessage(text: string, status: number): string {
  try {
    const parsed = JSON.parse(text) as GapErrorBody;
    const message = parsed.ResponseStatus?.Message ?? parsed.Message;
    if (message) return message.slice(0, MAX_ERROR_MESSAGE);
  } catch {
    // not JSON
  }
  return text.trim().slice(0, MAX_ERROR_MESSAGE) || `HTTP ${status}`;
}
