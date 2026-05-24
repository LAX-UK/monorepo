import { createHmac, timingSafeEqual } from "node:crypto";

export class VeriffWebhookNotConfiguredError extends Error {
  constructor() {
    super("veriff_webhook_not_configured");
    this.name = "VeriffWebhookNotConfiguredError";
  }
}

export class VeriffWebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VeriffWebhookSignatureError";
  }
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export class VeriffWebhookVerifier {
  constructor(
    private readonly apiKey: string | undefined,
    private readonly sharedSecret: string | undefined,
  ) {}

  verify(rawBody: string, signature: string | undefined, authClient: string | undefined): void {
    if (!this.sharedSecret || !this.apiKey) {
      throw new VeriffWebhookNotConfiguredError();
    }
    if (!authClient) {
      throw new VeriffWebhookSignatureError("missing_veriff_auth_client");
    }
    if (!safeEqual(authClient, this.apiKey)) {
      throw new VeriffWebhookSignatureError("invalid_auth_client");
    }
    if (!signature) {
      throw new VeriffWebhookSignatureError("missing_veriff_signature");
    }

    const expected = createHmac("sha256", this.sharedSecret).update(rawBody).digest("hex");
    if (!safeEqual(signature, expected)) {
      throw new VeriffWebhookSignatureError("invalid_signature");
    }
  }
}
