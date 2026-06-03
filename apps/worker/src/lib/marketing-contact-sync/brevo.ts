import type { IMarketingContactSync, MarketingContact, SyncAction, SyncResult } from "./types.js";

type FetchLike = typeof fetch;

export type BrevoContactSyncOptions = {
  apiKey: string;
  listId: number;
  baseUrl?: string;
  /** Injected for tests; defaults to global fetch. */
  fetchImpl?: FetchLike;
};

const DEFAULT_BASE_URL = "https://api.brevo.com/v3";

/**
 * Brevo (EU) contacts adapter.
 *
 * Upsert uses `POST /v3/contacts` with `updateEnabled: true`, keyed by email. We
 * intentionally never PATCH an existing contact's email and never send any
 * subscription/blocklist override: Brevo will not resubscribe an unsubscribed
 * contact through the API (compliance-safe), and updating a blocklisted contact's
 * email would silently remove their blocklist.
 */
export class BrevoContactSync implements IMarketingContactSync {
  readonly provider = "brevo";
  private readonly fetchImpl: FetchLike;
  private readonly baseUrl: string;

  constructor(private readonly opts: BrevoContactSyncOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  }

  enabled(): boolean {
    return Boolean(this.opts.apiKey) && Number.isInteger(this.opts.listId) && this.opts.listId > 0;
  }

  async upsertContact(contact: MarketingContact): Promise<SyncResult> {
    const attributes: Record<string, string | boolean> = {
      ROLE: contact.role,
      KYC_STATUS: contact.kycStatus,
      EMAIL_VERIFIED: contact.emailVerified,
    };
    if (contact.firstName) attributes.FIRSTNAME = contact.firstName;
    if (contact.lastName) attributes.LASTNAME = contact.lastName;
    if (contact.country) attributes.COUNTRY = contact.country;
    if (contact.signupSource) attributes.SIGNUP_SOURCE = contact.signupSource;

    return this.request("POST", "/contacts", "upsert", {
      email: contact.email,
      attributes,
      listIds: [this.opts.listId],
      updateEnabled: true,
    });
  }

  async archiveContact(email: string): Promise<SyncResult> {
    return this.request("DELETE", `/contacts/${encodeURIComponent(email)}`, "archive");
  }

  private async request(
    method: "POST" | "DELETE",
    pathname: string,
    action: SyncAction,
    body?: unknown,
  ): Promise<SyncResult> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${pathname}`, {
        method,
        headers: {
          "api-key": this.opts.apiKey,
          accept: "application/json",
          ...(body ? { "content-type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch (err) {
      // Network/DNS/timeout — always retryable.
      return {
        ok: false,
        retryable: true,
        message: `brevo network error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    if (res.ok) {
      return { ok: true, action, providerContactId: await contactIdFromResponse(res) };
    }

    // Deleting a contact that no longer exists is a no-op success for archive.
    if (action === "archive" && res.status === 404) {
      return { ok: true, action };
    }

    // 429 (rate limit) and 5xx are transient → retry; other 4xx are terminal.
    const retryable = res.status === 429 || res.status >= 500;
    return { ok: false, retryable, code: res.status, message: await safeText(res) };
  }
}

async function contactIdFromResponse(res: Response): Promise<string | undefined> {
  // 201 returns { id }; 204 (update/delete) has no body.
  try {
    const json = (await res.json()) as { id?: number | string } | null;
    if (json && json.id != null) return String(json.id);
  } catch {
    // no JSON body
  }
  return undefined;
}

async function safeText(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text.slice(0, 500);
  } catch {
    return `HTTP ${res.status}`;
  }
}
