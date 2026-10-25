import { accountAddressResultSchema, accountAddressesSchema } from "@auction/identity-contracts";
import type { SavedDeliveryAddress } from "@auction/shop-contracts";
import type { DeliveryAddressBook } from "../application/ports/delivery-address-book.port.js";

const REQUEST_TIMEOUT_MS = 3_000;
/** Identity's machine routes accept one scope. */
const MACHINE_SCOPE = "identity.lifecycle";

export type HttpIdentityAddressBookConfig = {
  /** Identity's base URL (the private one where there is one). */
  issuerBaseUrl: string;
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
};

/**
 * The LAX-wide address book through Identity's machine routes
 * (`/internal/identity/subjects/:subjectId/addresses`). shop-api has already authenticated the
 * shopper, so the subject comes from the verified session, never from the request body.
 */
export function createHttpIdentityAddressBook(
  config: HttpIdentityAddressBookConfig,
): DeliveryAddressBook {
  const base = config.issuerBaseUrl.replace(/\/+$/, "");
  const fetchImpl = config.fetchImpl ?? fetch;
  let token: { value: string; expiresAt: number } | null = null;

  async function machineToken(): Promise<string> {
    if (token && token.expiresAt > Date.now() + 10_000) return token.value;
    const response = await fetchImpl(`${base}/internal/oauth/token`, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ grant_type: "client_credentials", scope: MACHINE_SCOPE }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body = (await response.json().catch(() => null)) as {
      access_token?: unknown;
      expires_in?: unknown;
    } | null;
    if (
      !response.ok ||
      typeof body?.access_token !== "string" ||
      typeof body.expires_in !== "number"
    ) {
      throw new Error(`Identity machine token request responded ${response.status}`);
    }
    token = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
    return token.value;
  }

  async function request(
    method: "GET" | "POST",
    subject: string,
    body?: unknown,
    retry = true,
  ): Promise<unknown> {
    const response = await fetchImpl(
      `${base}/internal/identity/subjects/${encodeURIComponent(subject)}/addresses`,
      {
        method,
        headers: {
          accept: "application/json",
          authorization: `Bearer ${await machineToken()}`,
          ...(body ? { "content-type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    if (response.status === 401 && retry) {
      token = null;
      return request(method, subject, body, false);
    }
    if (!response.ok) {
      throw new Error(`Identity address book responded ${response.status}`);
    }
    return response.json();
  }

  return {
    async list(subject) {
      const parsed = accountAddressesSchema.safeParse(await request("GET", subject));
      if (!parsed.success) throw new Error("Identity address book returned an invalid list");
      return parsed.data.addresses.map(
        (address): SavedDeliveryAddress => ({
          id: address.id,
          label: address.label,
          recipientName: address.recipientName,
          line1: address.line1,
          line2: address.line2,
          city: address.city,
          postcode: address.postcode,
          country: address.country,
          phone: address.phone,
          isDefaultShipping: address.isDefaultShipping,
        }),
      );
    },
    async add(subject, address) {
      const parsed = accountAddressResultSchema.safeParse(
        await request("POST", subject, {
          address: { ...address, region: null },
        }),
      );
      if (!parsed.success) throw new Error("Identity address book returned an invalid address");
    },
  };
}
