import { Button } from "@/components/account-button";
import { CARD as BASE_CARD, CARD_PADDING, CARD_TITLE } from "./account-ui";
import { ProductName } from "./product-name";

const CARD = `flex flex-col gap-4 ${BASE_CARD} ${CARD_PADDING}`;

/**
 * Organisations belong to LAX Bid, which lists them with each member's role. Account links
 * there rather than repeating the list: Bid's organisation routes do not accept Account's
 * read-only portfolio token, so a list here would need a new scope or endpoint first.
 */
export function OrganisationsCard({ href }: { href: string }) {
  return (
    <section aria-labelledby="organisations-card-heading" className={CARD}>
      <h2 id="organisations-card-heading" className={CARD_TITLE}>
        Your organisations
      </h2>
      <p className="text-sm text-on-surface-variant">
        Galleries and businesses you belong to are managed in{" "}
        <ProductName product="bid">LAX Bid</ProductName>, where you can see your role in each.
      </p>
      <Button asChild variant="outline" className="self-start">
        <a href={href}>Open in LAX Bid</a>
      </Button>
    </section>
  );
}
