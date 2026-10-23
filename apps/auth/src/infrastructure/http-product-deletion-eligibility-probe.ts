import {
  type DeletionEligibilityProduct,
  type ProductDeletionEligibility,
  deletionEligibilityPath,
  productDeletionEligibilitySchema,
} from "@auction/identity-contracts";
import type { ProductDeletionEligibilityProbe } from "../services/account-deletion.ports.js";

type Fetch = typeof globalThis.fetch;

export class ProductDeletionEligibilityUnavailableError extends Error {
  constructor(
    readonly product: DeletionEligibilityProduct,
    readonly code:
      | "not_configured"
      | "timeout"
      | "network"
      | "rejected"
      | "unavailable"
      | "invalid_response",
    readonly status?: number,
  ) {
    super(`product_deletion_eligibility_${code}`);
    this.name = "ProductDeletionEligibilityUnavailableError";
  }
}

export type HttpProductDeletionEligibilityProbeOptions = {
  /** Internal base URL of each product's API; a product with none cannot be asked. */
  baseUrls: Partial<Record<DeletionEligibilityProduct, string | undefined>>;
  clientId: string | undefined;
  clientSecret: string | undefined;
  timeoutMs: number;
  fetch?: Fetch | undefined;
};

/**
 * Calls the same `/internal/identity/...` boundary the other product probes use, with the
 * shared Identity machine credentials. There is deliberately no retry: a person is waiting on
 * the answer, and "try again" is a better outcome for them than a long hang. A refusal, a slow
 * answer or a malformed body all reject, so deletion is never allowed on silence.
 */
export class HttpProductDeletionEligibilityProbe implements ProductDeletionEligibilityProbe {
  private readonly fetch: Fetch;

  constructor(private readonly options: HttpProductDeletionEligibilityProbeOptions) {
    this.fetch = options.fetch ?? globalThis.fetch;
  }

  async check(
    product: DeletionEligibilityProduct,
    subjectId: string,
  ): Promise<ProductDeletionEligibility> {
    const baseUrl = this.options.baseUrls[product];
    if (!baseUrl || !this.options.clientId || !this.options.clientSecret) {
      throw new ProductDeletionEligibilityUnavailableError(product, "not_configured");
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);
    try {
      const response = await this.fetch(
        `${baseUrl.replace(/\/$/, "")}${deletionEligibilityPath(subjectId)}`,
        {
          method: "GET",
          headers: {
            "x-identity-client-id": this.options.clientId,
            "x-identity-client-secret": this.options.clientSecret,
          },
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        throw new ProductDeletionEligibilityUnavailableError(
          product,
          response.status >= 500 ? "unavailable" : "rejected",
          response.status,
        );
      }
      const parsed = productDeletionEligibilitySchema.safeParse(
        await response.json().catch(() => null),
      );
      // A product answering for another product would let one product's "clear" stand in for both.
      if (!parsed.success || parsed.data.product !== product) {
        throw new ProductDeletionEligibilityUnavailableError(product, "invalid_response");
      }
      return parsed.data;
    } catch (error) {
      if (error instanceof ProductDeletionEligibilityUnavailableError) throw error;
      throw new ProductDeletionEligibilityUnavailableError(
        product,
        controller.signal.aborted ? "timeout" : "network",
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
