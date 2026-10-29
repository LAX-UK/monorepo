import { legalEntitySummarySchema } from "@/lib/data/http/legal-entities.schema";
import type { LegalEntitySummary } from "@auction/types";
import { z } from "zod";
import type {
  AccountDirectory,
  AccountsLookup,
  AccountsUnavailableReason,
  ViewedAccount,
} from "./account-directory";
import type { AccountsCache } from "./accounts-cache";

/** Sends a cookie-authenticated request to the Bid API. */
export type ApiFetcher = (path: string, init: RequestInit) => Promise<Response>;

export type HttpAccountDirectoryOptions = {
  fetcher: ApiFetcher;
  /** Shared per-session memory; with no `sessionKey` nothing is cached. */
  cache: AccountsCache;
  /** Identifies the signed-in session (never the raw token); `null` turns caching off. */
  sessionKey: string | null;
  /** Gives up on a slow API after this long. */
  timeoutMs?: number;
  /** Wait before the one retry after a 429 when the API names no `Retry-After`. */
  retryDelayMs?: number;
  /** Longest wait honoured from `Retry-After`; a page never stalls for longer. */
  maxRetryDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_RETRY_DELAY_MS = 250;
const DEFAULT_MAX_RETRY_DELAY_MS = 1_000;

const membershipsBodySchema = z.object({ data: z.array(legalEntitySummarySchema) });

const viewedAccountBodySchema = z.object({
  data: z.object({
    id: z.string(),
    displayName: z.string(),
    kind: z.string(),
    subkind: z.string(),
    status: z.string(),
    membership: z
      .object({
        role: z.string(),
        isPrimaryAdmin: z.boolean(),
        isImpersonation: z.boolean().optional(),
        impersonationExpiresAt: z.string().optional(),
      })
      .optional(),
  }),
});

type Attempt = { ok: true; response: Response } | { ok: false; reason: AccountsUnavailableReason };

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Seconds from a `Retry-After` header, as milliseconds; `null` when absent or a date. */
function retryAfterMs(response: Response): number | null {
  const raw = response.headers.get("retry-after");
  if (!raw) return null;
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1_000 : null;
}

/** `AbortSignal.timeout` rejects with a `DOMException`, which is not always an `Error`. */
function isTimeout(error: unknown): boolean {
  const name =
    typeof error === "object" && error !== null ? (error as { name?: unknown }).name : null;
  return name === "TimeoutError" || name === "AbortError";
}

/**
 * `GET /legal-entities/me` over HTTP: one short-lived cached answer per session, one retry
 * after a 429 (waiting as the API asks, within a cap), and every failure reported as a typed
 * outage instead of an empty list. An empty list would read as "this person has no
 * organisations" and drop them into their personal account.
 */
export class HttpAccountDirectory implements AccountDirectory {
  private readonly timeoutMs: number;
  private readonly retryDelayMs: number;
  private readonly maxRetryDelayMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly options: HttpAccountDirectoryOptions) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    this.maxRetryDelayMs = options.maxRetryDelayMs ?? DEFAULT_MAX_RETRY_DELAY_MS;
    this.sleep = options.sleep ?? defaultSleep;
  }

  async listMine(options: { mustInclude?: string | null } = {}): Promise<AccountsLookup> {
    const { cache, sessionKey } = this.options;
    if (!sessionKey) return this.fetchAccounts();
    return cache.getOrLoad(sessionKey, options.mustInclude, () => this.fetchAccounts());
  }

  async findViewedAccount(accountId: string): Promise<ViewedAccount | null> {
    const attempt = await this.fetchOnce(`/legal-entities/${encodeURIComponent(accountId)}`);
    if (!attempt.ok || !attempt.response.ok) return null;
    const parsed = viewedAccountBodySchema.safeParse(
      await attempt.response.json().catch(() => null),
    );
    const detail = parsed.success ? parsed.data.data : null;
    if (!detail?.membership?.isImpersonation) return null;
    return {
      account: {
        id: detail.id,
        displayName: detail.displayName,
        kind: detail.kind as LegalEntitySummary["kind"],
        subkind: detail.subkind as LegalEntitySummary["subkind"],
        status: detail.status as LegalEntitySummary["status"],
        role: detail.membership.role as LegalEntitySummary["role"],
        isPrimaryAdmin: detail.membership.isPrimaryAdmin,
        isImpersonation: true,
      },
      expiresAtIso: detail.membership.impersonationExpiresAt ?? null,
    };
  }

  private async fetchAccounts(): Promise<AccountsLookup> {
    const attempt = await this.fetchWithOneRetry("/legal-entities/me");
    if (!attempt.ok) return attempt;
    if (!attempt.response.ok) return { ok: false, reason: "server_error" };

    const parsed = membershipsBodySchema.safeParse(await attempt.response.json().catch(() => null));
    // The API always gives a person their own account; none at all is a failure, not an answer.
    if (!parsed.success || parsed.data.data.length === 0) {
      return { ok: false, reason: "server_error" };
    }
    const accounts: readonly LegalEntitySummary[] = parsed.data.data;
    return { ok: true, accounts };
  }

  private async fetchWithOneRetry(path: string): Promise<Attempt> {
    const first = await this.fetchOnce(path);
    if (!first.ok || first.response.status !== 429) return first;
    const wait = Math.min(retryAfterMs(first.response) ?? this.retryDelayMs, this.maxRetryDelayMs);
    await this.sleep(wait);
    const second = await this.fetchOnce(path);
    if (second.ok && second.response.status === 429) return { ok: false, reason: "rate_limited" };
    return second;
  }

  private async fetchOnce(path: string): Promise<Attempt> {
    try {
      const response = await this.options.fetcher(path, {
        cache: "no-store",
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      return { ok: true, response };
    } catch (error) {
      return { ok: false, reason: isTimeout(error) ? "timeout" : "network" };
    }
  }
}
