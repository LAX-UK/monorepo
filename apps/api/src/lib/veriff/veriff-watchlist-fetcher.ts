import type { Env } from "../../env.js";
import type { IWatchlistScreeningFetcher } from "../../services/aml/ports.js";
import { signVeriffSessionId } from "./veriff-hmac.js";
import {
  type NormalizedWatchlistScreening,
  normalizeVeriffWatchlistWebhook,
} from "./veriff-watchlist-normalizer.js";
import { veriffWatchlistWebhookSchema } from "./veriff-watchlist-types.js";

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_RETRY_DELAY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Pull-based Veriff watchlist screening adapter (GET /sessions/{id}/watchlist-screening).
 * Session-level HMAC: sign the session UUID with the shared secret.
 */
export class VeriffWatchlistFetcher implements IWatchlistScreeningFetcher {
  constructor(
    private readonly apiKey: string | undefined,
    private readonly sharedSecret: string | undefined,
    private readonly baseUrl: string,
    private readonly maxAttempts = DEFAULT_MAX_ATTEMPTS,
    private readonly retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  ) {}

  static fromEnv(
    env: Pick<Env, "VERIFF_API_KEY" | "VERIFF_SHARED_SECRET" | "VERIFF_API_BASE_URL">,
  ): VeriffWatchlistFetcher {
    return new VeriffWatchlistFetcher(
      env.VERIFF_API_KEY,
      env.VERIFF_SHARED_SECRET,
      env.VERIFF_API_BASE_URL ?? "https://stationapi.veriff.com",
    );
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.sharedSecret);
  }

  async fetchBySessionId(sessionId: string): Promise<NormalizedWatchlistScreening | null> {
    if (!this.apiKey || !this.sharedSecret) return null;

    const url = `${this.baseUrl.replace(/\/$/, "")}/v1/sessions/${encodeURIComponent(sessionId)}/watchlist-screening`;
    const signature = signVeriffSessionId(sessionId, this.sharedSecret);

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "X-AUTH-CLIENT": this.apiKey,
          "X-HMAC-SIGNATURE": signature,
        },
      });

      if (res.status === 202) {
        if (attempt < this.maxAttempts) {
          await sleep(this.retryDelayMs);
          continue;
        }
        return null;
      }
      if (res.status === 402) {
        throw new Error("veriff_watchlist_not_enabled");
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`veriff_fetch_watchlist_failed:${res.status}:${text.slice(0, 200)}`);
      }

      const json: unknown = await res.json();
      const parsed = veriffWatchlistWebhookSchema.safeParse(json);
      if (!parsed.success) {
        throw new Error("veriff_fetch_watchlist_invalid_payload");
      }
      return normalizeVeriffWatchlistWebhook(parsed.data);
    }

    return null;
  }
}
