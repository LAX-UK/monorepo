import type { EmailEnqueueInput, EmailSender } from "@auction/auth";

type Fetch = typeof globalThis.fetch;

export class IdentityEmailEnqueueError extends Error {
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
    super(`identity_email_enqueue_${code}`);
    this.name = "IdentityEmailEnqueueError";
  }
}

export type HttpEmailSenderOptions = {
  baseUrl: string;
  clientId: string | undefined;
  clientSecret: string | undefined;
  timeoutMs: number;
  fetch?: Fetch | undefined;
};

export class HttpEmailSender implements EmailSender {
  private readonly fetch: Fetch;
  private readonly endpoint: string;

  constructor(private readonly options: HttpEmailSenderOptions) {
    this.fetch = options.fetch ?? globalThis.fetch;
    this.endpoint = `${options.baseUrl.replace(/\/$/, "")}/internal/identity/emails`;
  }

  async enqueue(input: EmailEnqueueInput): Promise<{ outboxId: string }> {
    if (!this.options.clientId || !this.options.clientSecret) {
      throw new IdentityEmailEnqueueError("not_configured");
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);
      try {
        const response = await this.fetch(this.endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-identity-client-id": this.options.clientId,
            "x-identity-client-secret": this.options.clientSecret,
          },
          body: JSON.stringify(input),
          signal: controller.signal,
        });
        if (response.status >= 500 && attempt === 0) continue;
        if (!response.ok) {
          throw new IdentityEmailEnqueueError(
            response.status >= 500 ? "unavailable" : "rejected",
            response.status,
          );
        }
        const payload: unknown = await response.json().catch(() => null);
        if (
          !payload ||
          typeof payload !== "object" ||
          !("data" in payload) ||
          !payload.data ||
          typeof payload.data !== "object" ||
          !("outboxId" in payload.data) ||
          typeof payload.data.outboxId !== "string" ||
          payload.data.outboxId.length === 0
        ) {
          throw new IdentityEmailEnqueueError("invalid_response");
        }
        return { outboxId: payload.data.outboxId };
      } catch (error) {
        if (error instanceof IdentityEmailEnqueueError) throw error;
        const timedOut = controller.signal.aborted;
        if (attempt === 0) continue;
        throw new IdentityEmailEnqueueError(timedOut ? "timeout" : "network");
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new IdentityEmailEnqueueError("unavailable");
  }
}
