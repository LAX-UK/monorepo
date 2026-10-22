import { ArtEditorialLink } from "@/components/editorial/art-editorial-link";
import type { ReactNode } from "react";

export const CONTACT_LINK =
  "art-focus-ring rounded-sm text-on-surface underline underline-offset-4 hover:no-underline";

/** Email then phone as `mailto:` / `tel:` links, each only when known. */
export function contactLinkLines({
  phone,
  email,
}: {
  phone: string | null;
  email: string | null;
}): ReactNode[] {
  return [
    ...(email
      ? [
          <ArtEditorialLink key="email" href={`mailto:${email}`} className={CONTACT_LINK}>
            {email}
          </ArtEditorialLink>,
        ]
      : []),
    ...(phone
      ? [
          <a key="phone" href={`tel:${phone.replace(/\s+/g, "")}`} className={CONTACT_LINK}>
            {phone}
          </a>,
        ]
      : []),
  ];
}
