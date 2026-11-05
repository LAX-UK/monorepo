import "server-only";

import { getServerApiBase } from "@/lib/data/http/hc-server";
import {
  ComposableServerRequestHeaders,
  deriveSsrOrigin,
  withBidApiBearer,
} from "@/lib/data/http/server-request-headers";
import { currentVisitorIpHeaders } from "@/lib/http/visitor-ip.server";
import type { EnquirerOrganisation } from "@/lib/private-sales/enquiring-as";
import {
  ContactDispatchError,
  type ContactDispatcher,
  type EnquiryDraft,
  type EnquiryPayload,
  type EnquiryReceipt,
} from "./contact-dispatcher";

const REQUEST_TIMEOUT_MS = 10_000;

/** Origin, the visitor's address and, when they are signed in, their session. */
async function requestHeaders(): Promise<Headers> {
  // The visitor's address, so the API limits them and not the web server every visitor shares.
  const [origin, clientAddress] = await Promise.all([deriveSsrOrigin(), currentVisitorIpHeaders()]);
  return new ComposableServerRequestHeaders([withBidApiBearer()]).build({
    "content-type": "application/json",
    origin,
    ...clientAddress,
  });
}

async function send(method: "GET" | "POST", path: string, body?: unknown): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${getServerApiBase()}${path}`, {
      method,
      headers: await requestHeaders(),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new ContactDispatchError("The enquiry service could not be reached.");
  }
  if (response.ok) return response;
  const code = await response
    .json()
    .then((json: { code?: unknown }) => (typeof json.code === "string" ? json.code : undefined))
    .catch(() => undefined);
  throw new ContactDispatchError("The enquiry service refused the message.", response.status, code);
}

/** The named fields of the response's `data`, each empty when the API did not give it. */
async function readData<K extends string>(
  response: Response,
  keys: readonly K[],
): Promise<Record<K, string>> {
  const json = (await response.json().catch(() => null)) as {
    data?: Record<string, unknown>;
  } | null;
  const data = json?.data ?? {};
  return Object.fromEntries(
    keys.map((key) => [key, typeof data[key] === "string" ? data[key] : ""]),
  ) as Record<K, string>;
}

/** Sends each enquiry to the API, which stores it for the specialists. */
export const httpContactDispatcher: ContactDispatcher = {
  async dispatch(input: EnquiryPayload): Promise<EnquiryReceipt> {
    return readData(await send("POST", "/contact-enquiries", input), ["reference", "replyBy"]);
  },

  async startDraft(): Promise<EnquiryDraft> {
    return readData(await send("POST", "/contact-enquiries/drafts"), ["draftToken", "expiresAt"]);
  },

  async organisations(): Promise<EnquirerOrganisation[]> {
    const response = await send("GET", "/contact-enquiries/organisations");
    const json = (await response.json().catch(() => null)) as {
      data?: EnquirerOrganisation[];
    } | null;
    return Array.isArray(json?.data) ? json.data : [];
  },
};
