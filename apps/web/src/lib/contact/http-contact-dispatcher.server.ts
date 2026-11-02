import "server-only";

import { getServerApiBase } from "@/lib/data/http/hc-server";
import { deriveSsrOrigin } from "@/lib/data/http/server-request-headers";
import { headers } from "next/headers";
import {
  ContactDispatchError,
  type ContactDispatcher,
  type ContactPayload,
} from "./contact-dispatcher";

const REQUEST_TIMEOUT_MS = 10_000;

/** The visitor's address, so the API limits them and not the web server every visitor shares. */
async function forwardedClientAddress(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || null;
}

/** Sends each enquiry to the API, which stores it for client services. */
export const httpContactDispatcher: ContactDispatcher = {
  async dispatch(input: ContactPayload) {
    const [origin, clientAddress] = await Promise.all([
      deriveSsrOrigin(),
      forwardedClientAddress(),
    ]);
    let response: Response;
    try {
      response = await fetch(`${getServerApiBase()}/contact-enquiries`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin,
          ...(clientAddress ? { "x-forwarded-for": clientAddress } : {}),
        },
        body: JSON.stringify(input),
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new ContactDispatchError("The enquiry service could not be reached.");
    }
    if (!response.ok) {
      throw new ContactDispatchError("The enquiry service refused the message.", response.status);
    }
  },
};
