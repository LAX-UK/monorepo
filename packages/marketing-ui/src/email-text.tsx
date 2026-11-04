import type { AnchorHTMLAttributes, ReactNode } from "react";

/** A whole email address inside running text. */
const EMAIL_IN_TEXT = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;

/**
 * An email address written so a proxy that rewrites addresses in the HTML (Cloudflare's address
 * obfuscation) finds nothing to rewrite. The `@` sits in its own element, so the text on the
 * server and in the browser is the same and the page hydrates cleanly. Visually and to a screen
 * reader it is the address, unchanged.
 */
export function EmailAddressText({ address }: { address: string }): ReactNode {
  const at = address.indexOf("@");
  if (at < 0) return address;
  return (
    <>
      {address.slice(0, at)}
      <span>@</span>
      {address.slice(at + 1)}
    </>
  );
}

/** Running text with every email address in it written by `EmailAddressText`. */
export function TextWithEmails({ text }: { text: string }): ReactNode {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(EMAIL_IN_TEXT)) {
    const start = match.index ?? 0;
    if (start > last) parts.push(text.slice(last, start));
    parts.push(<EmailAddressText key={`${start}-${match[0]}`} address={match[0]} />);
    last = start + match[0].length;
  }
  if (parts.length === 0) return text;
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

export type EmailLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "children"> & {
  address: string;
  /** Text after the address in the link, such as a subject line: `?subject=...`. */
  query?: string;
};

/** A `mailto:` link that shows its address through `EmailAddressText`. */
export function EmailLink({ address, query = "", ...rest }: EmailLinkProps) {
  return (
    <a href={`mailto:${address}${query}`} aria-label={address} {...rest}>
      <EmailAddressText address={address} />
    </a>
  );
}
