import { Button, ButtonLink } from "@auction/ui/lax";
import Link from "next/link";

type Props = {
  label: string;
  /** What the control does for a screen reader, which hears every row's step: "Bid £3,200, Dusk". */
  accessibleName: string;
  /** Set while the account's state holds the step: it stays, disabled, with the reason. */
  blockedReason?: string | null;
} & ({ href: string; onSelect?: never } | { onSelect: () => void; href?: never });

/**
 * The one step a list row offers. Always a secondary button at the row's control height (36px,
 * 44px on a phone), since a list never holds the page's one primary action. It opens a page or
 * runs a handler; held, it stays visible and says why it is off.
 */
export function RowStep({ label, accessibleName, blockedReason, href, onSelect }: Props) {
  if (blockedReason) {
    return (
      <Button disabledReason={blockedReason} aria-label={accessibleName}>
        {label}
      </Button>
    );
  }
  if (href !== undefined) {
    return (
      <ButtonLink href={href} Link={Link} aria-label={accessibleName}>
        {label}
      </ButtonLink>
    );
  }
  return (
    <Button onClick={onSelect} aria-label={accessibleName}>
      {label}
    </Button>
  );
}
