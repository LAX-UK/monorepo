import {
  type LaxMoneyEntryV1,
  type LaxPortfolioItemV1,
  parseLaxMoneyResponse,
  parseLaxPortfolioResponse,
} from "@auction/lax-ecosystem";
import {
  PORTFOLIO_SOURCES,
  PORTFOLIO_SOURCE_DESCRIPTORS,
  type PortfolioSourceId,
  type SourceResult,
  type SourceResults,
} from "../domain/portfolio-sources";
import type {
  PortfolioGateway,
  ResourceTokenProvider,
  SessionHandle,
} from "../ports/portfolio-gateway";

/** A product that does not answer in this time is reported unavailable; the page must not hang on it. */
export const PRODUCT_READ_TIMEOUT_MS = 4_000;

type ParsedBody<Row> = { rows: readonly Row[]; partial?: boolean | undefined } | null;

/**
 * Bounds the whole read, token exchange included, because the exchange has no abort signal of
 * its own. The signal also cancels the HTTP request when the deadline passes.
 */
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
 * Calls each product's portfolio routes with its own audience-bound token, in parallel. Every
 * failure (no URL configured, token refused, timeout, error status, body off-contract) becomes
 * `unavailable` for that product alone; nothing is logged beyond the product and a reason, and
 * never a token or a body.
 */
export function createProductPortfolioGateway(deps: {
  apiUrls: Partial<Record<PortfolioSourceId, string>>;
  tokens: ResourceTokenProvider;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): PortfolioGateway {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const timeoutMs = deps.timeoutMs ?? PRODUCT_READ_TIMEOUT_MS;

  async function readOne<Row>(
    source: PortfolioSourceId,
    handle: SessionHandle,
    pathOf: (descriptor: (typeof PORTFOLIO_SOURCE_DESCRIPTORS)[PortfolioSourceId]) => string,
    parse: (body: unknown) => ParsedBody<Row>,
  ): Promise<SourceResult<Row>> {
    const descriptor = PORTFOLIO_SOURCE_DESCRIPTORS[source];
    const baseUrl = deps.apiUrls[source];
    if (!baseUrl) {
      console.warn("account_portfolio_source_unconfigured", { source });
      return { status: "unavailable" };
    }
    try {
      return await withDeadline(timeoutMs, async (signal) => {
        const token = await deps.tokens.tokenFor(handle, descriptor.resource);
        const response = await fetchImpl(`${baseUrl}${pathOf(descriptor)}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          cache: "no-store",
          signal,
        });
        if (!response.ok) {
          console.warn("account_portfolio_source_failed", { source, status: response.status });
          return { status: "unavailable" } as const;
        }
        const parsed = parse(await response.json());
        if (!parsed) {
          console.warn("account_portfolio_source_failed", { source, reason: "off_contract" });
          return { status: "unavailable" } as const;
        }
        return { status: "ok", rows: parsed.rows, partial: parsed.partial === true } as const;
      });
    } catch (error) {
      console.warn("account_portfolio_source_failed", {
        source,
        reason: error instanceof Error ? error.message : "unknown",
      });
      return { status: "unavailable" };
    }
  }

  async function readAll<Row>(
    handle: SessionHandle,
    pathOf: (descriptor: (typeof PORTFOLIO_SOURCE_DESCRIPTORS)[PortfolioSourceId]) => string,
    parse: (body: unknown) => ParsedBody<Row>,
  ): Promise<SourceResults<Row>> {
    const results = await Promise.all(
      PORTFOLIO_SOURCES.map((source) => readOne(source, handle, pathOf, parse)),
    );
    return Object.fromEntries(
      PORTFOLIO_SOURCES.map((source, index) => [source, results[index]]),
    ) as SourceResults<Row>;
  }

  return {
    readPortfolio: (handle) =>
      readAll<LaxPortfolioItemV1>(
        handle,
        (descriptor) => descriptor.portfolioPath,
        (body) => {
          const parsed = parseLaxPortfolioResponse(body);
          return parsed && { rows: parsed.items, partial: parsed.partial };
        },
      ),
    readMoney: (handle) =>
      readAll<LaxMoneyEntryV1>(
        handle,
        (descriptor) => descriptor.moneyPath,
        (body) => {
          const parsed = parseLaxMoneyResponse(body);
          return parsed && { rows: parsed.entries, partial: parsed.partial };
        },
      ),
  };
}
