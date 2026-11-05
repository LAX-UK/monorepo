import { createClientIpMiddleware } from "../middleware/client-ip.js";

/** The real client-address middleware with the platform's private range trusted. */
export const testClientIpMiddleware = createClientIpMiddleware({
  trustedProxyCidrs: ["10.0.0.0/8"],
  trustedCloudflareProxyCidrs: ["173.245.48.0/20"],
});

/** Node bindings for `app.request(..., env)`: the TCP peer is the platform ingress. */
export const behindIngress = { incoming: { socket: { remoteAddress: "10.0.0.2" } } };
