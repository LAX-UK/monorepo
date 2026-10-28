import { MarketingChevronDownIcon } from "@auction/marketing-ui";

/** What a limited edition is, once, in plain words; closed until someone asks. */
export function ArtworkAboutEditions() {
  return (
    <details className="shop-disclosure">
      <summary className="shop-disclosure__summary shop-focus-ring">
        About limited editions
        <MarketingChevronDownIcon className="shop-disclosure__icon" />
      </summary>
      <p className="shop-disclosure__body">
        A limited edition is a fixed number of prints made from one image, and the edition size is
        stated on every work. Your print’s number in the edition is given when your order is
        fulfilled.
      </p>
    </details>
  );
}
