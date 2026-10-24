import { cn } from "@auction/ui";
import { Fragment, type ReactNode } from "react";

/** The LAX products Account names. */
export type NamedProduct = "bid" | "shop" | "art" | "account";

/**
 * Each product's name colour, from the accent of its lockup (LAX colour rule in
 * docs/DESIGN_SYSTEM.md): Bid's navy, Account's teal, and Shop and Art in ink until they choose
 * an accent. The tokens switch to their dark-surface values in dark mode.
 */
const NAME_COLOUR: Readonly<Record<NamedProduct, string>> = {
  bid: "text-product-bid",
  shop: "text-product-shop",
  art: "text-product-art",
  account: "text-product-account",
};

/**
 * A product's name in that product's colour. Use it wherever the interface names a product in
 * text; buttons, links and other controls keep Account's own neutral and teal styling. The
 * weight is medium so the colour is not the only thing that sets the name apart; pass
 * `weight="inherit"` inside a heading.
 */
export function ProductName({
  product,
  children,
  weight = "medium",
  className,
}: {
  product: NamedProduct;
  children: ReactNode;
  weight?: "medium" | "inherit";
  className?: string;
}) {
  return (
    <span
      data-product={product}
      className={cn(NAME_COLOUR[product], weight === "medium" && "font-medium", className)}
    >
      {children}
    </span>
  );
}

/** A small tag naming the product a work or entry belongs to, in that product's colour. */
export function ProductTag({ product, children }: { product: NamedProduct; children: ReactNode }) {
  return (
    <span
      data-product={product}
      className={cn(
        "inline-flex w-fit shrink-0 items-center rounded-full bg-surface px-2 py-0.5 text-xs leading-5 font-medium whitespace-nowrap ring-1 ring-border-hairline ring-inset",
        NAME_COLOUR[product],
      )}
    >
      {children}
    </span>
  );
}

/** Full product names as they appear in Account's copy, longest first so "LAX Shop" wins. */
const NAMES: ReadonlyArray<readonly [string, NamedProduct]> = [
  ["LAX Account", "account"],
  ["LAX Bid", "bid"],
  ["LAX Shop", "shop"],
  ["LAX Art", "art"],
  ["lax.art", "art"],
];

const NAME_PATTERN = new RegExp(
  `(${NAMES.map(([name]) => name.replace(/[.]/g, "\\.")).join("|")})`,
  "g",
);
const PRODUCT_OF = new Map<string, NamedProduct>(NAMES);

/** Which product a full name such as "LAX Bid" or "lax.art" belongs to, if any. */
export function productOfName(name: string): NamedProduct | null {
  return PRODUCT_OF.get(name) ?? null;
}

/**
 * Plain copy with every full product name ("LAX Bid", "LAX Shop", "lax.art"…) set as a
 * `ProductName`. Bare words such as "Bid" are left alone, because they are also ordinary words
 * ("Bid on auctions"); name those with `ProductName` directly.
 */
export function ProductText({
  text,
  weight = "medium",
}: {
  text: string;
  /** "inherit" inside a heading or an already-bold line. */
  weight?: "medium" | "inherit";
}) {
  const parts = text.split(NAME_PATTERN);
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((part, index) => {
        const product = index % 2 === 1 ? PRODUCT_OF.get(part) : undefined;
        // The split keeps names at odd indexes, so the index is a stable key here.
        const key = `${index}`;
        return product ? (
          <ProductName key={key} product={product} weight={weight}>
            {part}
          </ProductName>
        ) : (
          <Fragment key={key}>{part}</Fragment>
        );
      })}
    </>
  );
}

/** `ProductText` for a string; anything else (already composed) passes through unchanged. */
export function withProductNames(
  content: ReactNode,
  weight: "medium" | "inherit" = "medium",
): ReactNode {
  return typeof content === "string" ? <ProductText text={content} weight={weight} /> : content;
}
