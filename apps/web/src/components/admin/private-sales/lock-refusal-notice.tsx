import { Notice, type StaffLinkComponent, TextLink } from "@auction/staff-ui";
import type { DealArtworkLock } from "@auction/validators";
import Link from "next/link";

const NextLink: StaffLinkComponent = Link;

/** The default underline is a pale grey that nearly vanishes on the notice's tinted ground. */
const LINK_ON_DANGER = "decoration-staff-fg";

/**
 * The register refused to hold an artwork: its own words, and the link that gets staff to where
 * the artwork is, when this deployment can open it. The words are the register's, shown as they are.
 */
export function LockRefusalNotice({
  message,
  lock,
}: {
  message: string;
  lock: DealArtworkLock | null;
}) {
  const link = lock?.link;
  const href = link?.href ?? null;
  return (
    <Notice tone="danger" alert title="That artwork can't be held for this deal">
      <p className="m-0">{message}</p>
      {link && href ? (
        <p className="m-0 mt-1.5">
          {href.startsWith("/") ? (
            <TextLink href={href} Link={NextLink} className={LINK_ON_DANGER}>
              {link.label}
            </TextLink>
          ) : (
            <TextLink href={href} external className={LINK_ON_DANGER}>
              {link.label}
            </TextLink>
          )}
        </p>
      ) : null}
    </Notice>
  );
}
