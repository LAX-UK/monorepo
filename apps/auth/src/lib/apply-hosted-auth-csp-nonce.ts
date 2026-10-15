/** Adds CSP nonces to hosted-auth script tags (Cloudflare JS Detections reads the response CSP). */
export function applyHostedAuthCspNonce(html: string, cspNonce: string): string {
  const nonceAttr = ` nonce="${cspNonce.replaceAll('"', "")}"`;
  return html.replaceAll("<script ", `<script${nonceAttr} `);
}
