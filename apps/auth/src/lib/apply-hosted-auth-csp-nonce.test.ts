import { describe, expect, it } from "vitest";
import { applyHostedAuthCspNonce } from "./apply-hosted-auth-csp-nonce.js";

describe("applyHostedAuthCspNonce", () => {
  it("adds a nonce attribute to every script tag", () => {
    const html =
      '<script type="application/json" id="x">{}</script><script src="/a.js" defer></script>';
    expect(applyHostedAuthCspNonce(html, "abc123")).toBe(
      '<script nonce="abc123" type="application/json" id="x">{}</script><script nonce="abc123" src="/a.js" defer></script>',
    );
  });
});
