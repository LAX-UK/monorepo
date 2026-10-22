import { isIP } from "node:net";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { EnquiryRateLimiter } from "../../application/enquiry-rate-limit.js";
import { type EnquirySender, enquirySenderRateKey } from "../../application/enquiry-sender.js";
import { ShopApiError } from "../../errors/shop-api-error.js";
import { requireShopScope } from "../../plugins/shop-auth.js";

/**
 * Browser IP resolved by the commerce BFF from its trusted-proxy chain. It is honoured only on
 * requests authenticated with the shared BFF token: any other caller could otherwise pick its
 * own rate-limit bucket by sending the header.
 */
export const ENQUIRY_CLIENT_IP_HEADER = "x-lax-client-ip";

export type EnquiryContactBody = { name?: string; email?: string; website?: string };

export type EnquiryAdmission = { kind: "honeypot" } | { kind: "admitted"; sender: EnquirySender };

function trimmedOrNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function resolveSender(request: FastifyRequest, body: EnquiryContactBody): EnquirySender {
  const auth = request.shopAuth;
  const contactName = trimmedOrNull(body.name);
  const contactEmail = trimmedOrNull(body.email);
  if (auth?.kind === "user") {
    return { kind: "account", identitySubjectId: auth.subject, contactName, contactEmail };
  }
  if (!contactName || !contactEmail) {
    throw new ShopApiError(
      SHOP_API_ERROR_CODES.VALIDATION,
      "Name and email are required to send an enquiry without signing in",
      400,
    );
  }
  return { kind: "guest", contactName, contactEmail };
}

/**
 * Guests arrive through the BFF token, which forwards the browser address in a header. Signed-in
 * requests carry a user token and are limited per account instead: their `request.ip` is the
 * BFF's own address, which would put every signed-in visitor in one bucket.
 */
function clientIp(request: FastifyRequest): string | null {
  if (request.shopAuth?.kind === "user") return null;
  if (request.shopAuth?.kind === "bff") {
    const raw = request.headers[ENQUIRY_CLIENT_IP_HEADER];
    const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
    if (value && isIP(value) !== 0) return value;
  }
  return request.ip;
}

/**
 * Shared gate for artwork and general enquiries: scope, honeypot, sender and rate limits.
 * A honeypot hit is reported to the caller so the route can answer with a normal success
 * body and store nothing; bots learn nothing from the response.
 */
export async function admitEnquiry(
  request: FastifyRequest,
  reply: FastifyReply,
  rateLimiter: EnquiryRateLimiter,
  body: EnquiryContactBody,
): Promise<EnquiryAdmission> {
  requireShopScope(request, "shop.write");
  if (body.website?.trim()) {
    request.log.info("enquiry_honeypot_rejected");
    return { kind: "honeypot" };
  }
  const sender = resolveSender(request, body);
  let decision: Awaited<ReturnType<EnquiryRateLimiter["consume"]>>;
  try {
    decision = await rateLimiter.consume({
      clientIp: clientIp(request),
      senderKey: enquirySenderRateKey(sender),
    });
  } catch (error) {
    // Losing an enquiry costs more than a short window without limits while Redis recovers.
    request.log.warn({ err: error }, "enquiry_rate_limit_unavailable");
    decision = { allowed: true };
  }
  if (!decision.allowed) {
    reply.header("retry-after", String(decision.retryAfterSeconds));
    throw new ShopApiError(
      SHOP_API_ERROR_CODES.RATE_LIMITED,
      "Too many enquiries. Try again later.",
      429,
    );
  }
  return { kind: "admitted", sender };
}
