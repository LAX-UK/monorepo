const HOSTED_AUTH_HTML_MARKER = "hosted-auth-runtime.js";

/** Adds CSP nonces to hosted-auth script tags (Cloudflare JS Detections reads the response CSP). */
export function applyHostedAuthCspNonce(html: string, cspNonce: string): string {
  const nonceAttr = ` nonce="${cspNonce.replaceAll('"', "")}"`;
  return html.replaceAll("<script ", `<script${nonceAttr} `);
}

export function isHostedAuthHtmlDocument(html: string): boolean {
  return html.includes(HOSTED_AUTH_HTML_MARKER);
}

export function hostedAuthHtmlHasCspNonce(html: string): boolean {
  return html.includes(' nonce="');
}

/** Rewrites Better Auth OIDC consent and any other hosted-auth HTML not built in mount-hosted-auth-pages. */
export async function applyHostedAuthCspNonceToResponse(
  response: Response,
  cspNonce: string,
): Promise<Response> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    return response;
  }
  const html = await response.text();
  if (!isHostedAuthHtmlDocument(html) || hostedAuthHtmlHasCspNonce(html)) {
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }
  const headers = new Headers(response.headers);
  return new Response(applyHostedAuthCspNonce(html, cspNonce), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
