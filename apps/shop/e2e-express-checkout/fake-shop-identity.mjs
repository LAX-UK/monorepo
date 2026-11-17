#!/usr/bin/env node
/**
 * A stand-in for Shop Identity (the commerce BFF) for the GAP-49 express checkout browser gate.
 * It answers only what the basket and Details need, and the express checkout steps as each test
 * sets them through POST /__scenario. No Stripe, no database, no keys.
 */
import { createServer } from "node:http";

const PORT = Number(process.env.FAKE_SHOP_IDENTITY_PORT ?? 3910);
const BASKET_ID = "00000000-0000-4000-8000-000000000990";
const ORDER_ID = "00000000-0000-4000-8000-000000000123";
const SESSION_ID = "cs_test_expressGate0001";

const basket = {
  basketId: BASKET_ID,
  lines: [
    {
      lineId: "00000000-0000-4000-8000-000000000001",
      artworkSlug: "harbour-at-dusk",
      artworkTitle: "Harbour at Dusk",
      productVariantId: null,
      productSlug: null,
      productTitle: null,
      variantSku: null,
      unitPricePence: 45000,
      quantity: 1,
      soldOut: false,
      priceChanged: false,
      outOfStock: false,
      imageUrl: null,
    },
  ],
  merchandiseSubtotalPence: 45000,
  expiresAt: "2030-01-01T00:00:00.000Z",
};

const rates = [
  { id: "uk_insured_delivery", displayName: "Insured UK delivery", amountPence: 1500 },
  { id: "collect_new_cavendish", displayName: "Collect from our London gallery", amountPence: 0 },
];

const DEFAULT_SCENARIO = { start: "ok", address: "ok", confirm: "ok" };
let scenario = { ...DEFAULT_SCENARIO };
let requests = [];

function json(res, status, body, headers = {}) {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

function upstreamFailure(code, message) {
  return { error: "commerce_upstream_failed", code, message };
}

function signedIn(req) {
  return /(?:^|;\s*)shop_identity_session=/.test(req.headers.cookie ?? "");
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

function expressAnswer(step, res) {
  if (step === "start") {
    if (scenario.start === "disabled") {
      return json(
        res,
        404,
        upstreamFailure("shop.feature_disabled", "Express checkout is not available"),
      );
    }
    if (scenario.start === "error") return json(res, 503, upstreamFailure("shop.internal", "Down"));
    return json(res, 200, {
      sessionId: SESSION_ID,
      clientSecret: `${SESSION_ID}_secret_gate`,
      expiresAt: "2030-01-01T00:30:00.000Z",
      currency: "gbp",
      subtotalPence: 45000,
      shippingRates: rates,
    });
  }
  if (step === "shipping-address") {
    if (scenario.address === "refused") {
      return json(
        res,
        400,
        upstreamFailure(
          "shop.validation",
          "Express checkout delivers to UK addresses only. For delivery abroad, continue below to ask for a quote.",
        ),
      );
    }
    return json(res, 200, { shippingRates: rates });
  }
  if (scenario.confirm === "sold_out") {
    return json(res, 409, upstreamFailure("shop.out_of_stock", "This print has just sold out"));
  }
  if (scenario.confirm === "conflict") {
    return json(
      res,
      409,
      upstreamFailure(
        "shop.conflict",
        "We couldn't set up this payment, so you have not been charged. Start again from your basket.",
      ),
    );
  }
  return json(res, 200, {
    orderId: ORDER_ID,
    returnUrl: `/checkout/confirmation?orderId=${ORDER_ID}`,
    expiresAt: "2030-01-01T00:30:00.000Z",
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method ?? "GET";

  if (path === "/__scenario" && method === "POST") {
    scenario = { ...DEFAULT_SCENARIO, ...(await readBody(req)) };
    requests = [];
    return json(res, 200, scenario);
  }
  if (path === "/__requests") return json(res, 200, requests);
  if (path === "/health/ready") return json(res, 200, { ok: true });

  if (path === "/me") {
    return signedIn(req)
      ? json(res, 200, {
          authenticated: true,
          emailVerified: true,
          profile: { email: "ada@example.test", name: "Ada Lovelace" },
        })
      : json(res, 200, { authenticated: false });
  }
  if (path === "/commerce/csrf") return json(res, 200, { csrfToken: "gate-csrf-token" });
  if (path === "/commerce/basket") return json(res, 200, basket);
  if (path === "/commerce/orders") return json(res, 200, { items: [] });
  if (path === "/commerce/me/addresses") return json(res, 200, { addresses: [] });

  const express = path.match(
    /^\/commerce\/(guest-checkout\/)?express-checkout(?:\/(shipping-address|confirm))?$/,
  );
  if (express && method === "POST") {
    const body = await readBody(req);
    const step = express[2] ?? "start";
    requests.push({ audience: express[1] ? "guest" : "account", step, body });
    return expressAnswer(step, res);
  }
  if (/^\/commerce\/(orders\/[^/]+|guest-orders\/current)\/cancel$/.test(path)) {
    requests.push({ step: "cancel", path });
    return json(res, 200, { ok: true });
  }
  return json(res, 404, { error: "not_found" });
});

server.listen(PORT, "127.0.0.1", () => {
  process.stdout.write(`fake shop identity on http://127.0.0.1:${PORT}\n`);
});
