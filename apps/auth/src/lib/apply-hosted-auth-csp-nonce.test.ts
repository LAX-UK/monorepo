import { describe, expect, it } from "vitest";
import {
  applyHostedAuthCspNonce,
  applyHostedAuthCspNonceToResponse,
} from "./apply-hosted-auth-csp-nonce.js";

describe("applyHostedAuthCspNonce", () => {
  it("adds a nonce attribute to every script tag", () => {
    const html =
      '<script type="application/json" id="x">{}</script><script src="/a.js" defer></script>';
    expect(applyHostedAuthCspNonce(html, "abc123")).toBe(
      '<script nonce="abc123" type="application/json" id="x">{}</script><script nonce="abc123" src="/a.js" defer></script>',
    );
  });

  it("rewrites hosted-auth HTML responses that lack nonces (OIDC consent)", async () => {
    const html =
      '<!doctype html><script type="application/json" id="hosted-auth-config">{}</script><script src="/hosted-auth-runtime.js" defer></script>';
    const response = await applyHostedAuthCspNonceToResponse(
      new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } }),
      "consent-nonce",
    );
    const body = await response.text();
    expect(body).toContain('nonce="consent-nonce"');
    expect(body.match(/ nonce="/g)?.length).toBe(2);
  });

  it("does not double-apply when nonces are already present", async () => {
    const html = '<script nonce="existing" src="/hosted-auth-runtime.js" defer></script>';
    const response = await applyHostedAuthCspNonceToResponse(
      new Response(html, { headers: { "Content-Type": "text/html" } }),
      "other",
    );
    expect(await response.text()).toBe(html);
  });
});
