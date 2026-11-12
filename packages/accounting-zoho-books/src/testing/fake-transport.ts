import type { TransportRequest, TransportResponse, ZohoTransport } from "../ports.js";

export type Reply =
  | { readonly status: number; readonly body?: unknown; readonly headers?: Record<string, string> }
  | { readonly raw: string; readonly status: number; readonly headers?: Record<string, string> }
  | { readonly fail: Error }
  | { readonly hang: true };

type Step = {
  readonly match: ((request: TransportRequest) => boolean) | undefined;
  readonly reply: Reply | ((request: TransportRequest) => Reply | Promise<Reply>);
};

/**
 * A transport that never touches the network. Replies are scripted; a request nobody scripted
 * fails the test loudly instead of going anywhere. Records every request for assertions.
 */
export class FakeZohoTransport implements ZohoTransport {
  readonly requests: TransportRequest[] = [];
  private readonly script: Step[] = [];
  private active = 0;
  /** The most requests that were in flight at once. */
  maxInFlight = 0;
  /** When set, each reply waits for this promise (to hold requests in flight). */
  gate: Promise<void> | undefined;

  /** The next request (matching `match`, if given) gets `reply`. Consumed once. */
  enqueue(reply: Step["reply"], match?: (request: TransportRequest) => boolean): this {
    this.script.push({ match, reply });
    return this;
  }

  async send(request: TransportRequest, signal: AbortSignal): Promise<TransportResponse> {
    this.requests.push(request);
    const at = this.script.findIndex((step) => !step.match || step.match(request));
    if (at === -1) {
      throw new Error(`FakeZohoTransport: unscripted ${request.method} ${request.url}`);
    }
    const [step] = this.script.splice(at, 1);
    this.active += 1;
    this.maxInFlight = Math.max(this.maxInFlight, this.active);
    try {
      if (this.gate) await this.gate;
      const reply =
        typeof step?.reply === "function" ? await step.reply(request) : (step?.reply as Reply);
      if ("hang" in reply) {
        await new Promise<void>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
        });
      }
      if ("fail" in reply) throw reply.fail;
      if ("raw" in reply)
        return { status: reply.status, headers: reply.headers ?? {}, body: reply.raw };
      if ("hang" in reply) throw new Error("unreachable");
      return {
        status: reply.status,
        headers: reply.headers ?? {},
        body: reply.body === undefined ? "" : JSON.stringify(reply.body),
      };
    } finally {
      this.active -= 1;
    }
  }

  get pending(): number {
    return this.script.length;
  }
}

export const isTokenRequest = (request: TransportRequest): boolean =>
  request.url.includes("/oauth/v2/token");
export const isApiRequest = (request: TransportRequest): boolean => !isTokenRequest(request);

/** The reply Zoho's token endpoint gives for a good refresh. */
export const tokenReply = (accessToken: string, expiresInSec = 3600): Reply => ({
  status: 200,
  body: {
    access_token: accessToken,
    expires_in: expiresInSec,
    api_domain: "https://www.zohoapis.eu",
    token_type: "Bearer",
  },
});

/** A successful Books reply: `{ code: 0, message: "success", ...payload }`. */
export const zohoOkReply = (payload: Record<string, unknown> = {}): Reply => ({
  status: 200,
  body: { code: 0, message: "success", ...payload },
});

/** A Books failure reply with a Zoho code. The message is deliberately personal-looking, to test redaction. */
export const zohoErrorReply = (status: number, zohoCode: number, message = "failed"): Reply => ({
  status,
  body: { code: zohoCode, message },
});
