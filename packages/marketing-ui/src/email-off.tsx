import type { ReactNode } from "react";

/**
 * Cloudflare's email obfuscation skips everything between `<!--email_off-->` and
 * `<!--/email_off-->`. React cannot render a comment node, so each marker sits in a hidden,
 * empty-looking span: the markers reach the edge in the server HTML, take no space and are not
 * read out. Whether or not the zone setting is on, the link inside stays a plain `mailto:` link
 * and the edge's email-decode script has nothing to rewrite.
 */
function Marker({ html }: { html: string }) {
  // biome-ignore lint/security/noDangerouslySetInnerHtml: fixed comment markers, no input
  return <span hidden dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Keeps the edge's email obfuscation off the `mailto:` links (and addresses) in `children`. */
export function EmailOff({ children }: { children: ReactNode }) {
  return (
    <>
      <Marker html="<!--email_off-->" />
      {children}
      <Marker html="<!--/email_off-->" />
    </>
  );
}
