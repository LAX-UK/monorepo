import type { Env } from "../../env.js";
import type { IScreeningProvider } from "../../services/aml/ports.js";

/**
 * Veriff adapter for the AML ongoing-monitoring lifecycle.
 *
 * The watchlist *result* arrives via the `watchlist-screening` webhook; this
 * adapter only handles the outbound enrol/withdraw calls. Failures here must
 * never block the money path — callers wrap invocations in try/catch and emit
 * a metric instead. The concrete endpoint is configured in the Veriff portal;
 * confirm the path against your integration before enabling in production
 * (see docs/runbooks/aml-workflow.md).
 */
export class VeriffScreeningProvider implements IScreeningProvider {
  constructor(
    private readonly apiKey: string | undefined,
    private readonly baseUrl: string,
  ) {}

  static fromEnv(
    env: Pick<Env, "VERIFF_API_KEY" | "VERIFF_API_BASE_URL">,
  ): VeriffScreeningProvider {
    return new VeriffScreeningProvider(
      env.VERIFF_API_KEY,
      env.VERIFF_API_BASE_URL ?? "https://stationapi.veriff.com",
    );
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async enableOngoingMonitoring(providerSessionId: string): Promise<void> {
    await this.setMonitoring(providerSessionId, true);
  }

  async disableOngoingMonitoring(providerSessionId: string): Promise<void> {
    await this.setMonitoring(providerSessionId, false);
  }

  private async setMonitoring(providerSessionId: string, enabled: boolean): Promise<void> {
    if (!this.apiKey) return;
    const url = `${this.baseUrl.replace(/\/$/, "")}/v1/sessions/${encodeURIComponent(
      providerSessionId,
    )}/watchlist-screening/monitoring`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-AUTH-CLIENT": this.apiKey,
      },
      body: JSON.stringify({ monitoring: enabled }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`veriff_set_monitoring_failed:${res.status}:${text.slice(0, 200)}`);
    }
  }
}
