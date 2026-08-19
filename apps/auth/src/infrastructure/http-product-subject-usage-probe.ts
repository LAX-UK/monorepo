import type { ProductSubjectUsageProbe } from "@auction/auth";

type Fetch = typeof globalThis.fetch;

export class ProductSubjectUsageUnavailableError extends Error {
  constructor(
    readonly code:
      | "not_configured"
      | "timeout"
      | "network"
      | "rejected"
      | "unavailable"
      | "invalid_response",
    readonly status?: number,
  ) {
    super(`product_subject_usage_${code}`);
    this.name = "ProductSubjectUsageUnavailableError";
  }
}

export type HttpProductSubjectUsageProbeOptions = {
  baseUrl: string;
  clientId: string | undefined;
  clientSecret: string | undefined;
  timeoutMs: number;
  fetch?: Fetch | undefined;
};

export class HttpProductSubjectUsageProbe implements ProductSubjectUsageProbe {
  private readonly fetch: Fetch;
  private readonly baseEndpoint: string;

  constructor(private readonly options: HttpProductSubjectUsageProbeOptions) {
    this.fetch = options.fetch ?? globalThis.fetch;
    this.baseEndpoint = `${options.baseUrl.replace(/\/$/, "")}/internal/identity/subject-usage`;
  }

  async getSubjectUsage(subjectId: string): Promise<{
    hasProductProfile: boolean;
    hasExternalLink: boolean;
  }> {
    if (!this.options.clientId || !this.options.clientSecret) {
      throw new ProductSubjectUsageUnavailableError("not_configured");
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);
      try {
        const response = await this.fetch(`${this.baseEndpoint}/${encodeURIComponent(subjectId)}`, {
          method: "GET",
          headers: {
            "x-identity-client-id": this.options.clientId,
            "x-identity-client-secret": this.options.clientSecret,
          },
          signal: controller.signal,
        });
        if (response.status >= 500 && attempt === 0) continue;
        if (!response.ok) {
          throw new ProductSubjectUsageUnavailableError(
            response.status >= 500 ? "unavailable" : "rejected",
            response.status,
          );
        }
        const payload: unknown = await response.json().catch(() => null);
        if (!isSubjectUsageResponse(payload)) {
          throw new ProductSubjectUsageUnavailableError("invalid_response");
        }
        return payload.data;
      } catch (error) {
        if (error instanceof ProductSubjectUsageUnavailableError) throw error;
        const timedOut = controller.signal.aborted;
        if (attempt === 0) continue;
        throw new ProductSubjectUsageUnavailableError(timedOut ? "timeout" : "network");
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new ProductSubjectUsageUnavailableError("unavailable");
  }
}

function isSubjectUsageResponse(value: unknown): value is {
  data: { hasProductProfile: boolean; hasExternalLink: boolean };
} {
  if (!value || typeof value !== "object" || !("data" in value)) return false;
  const data = value.data;
  return (
    data !== null &&
    typeof data === "object" &&
    "hasProductProfile" in data &&
    typeof data.hasProductProfile === "boolean" &&
    "hasExternalLink" in data &&
    typeof data.hasExternalLink === "boolean"
  );
}
