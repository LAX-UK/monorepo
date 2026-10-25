import { Button } from "@/components/account-button";
import { EMPTY_STATE } from "@/components/account-ui";
import type { AccountProductVm } from "@/server/domain/account-products.vm";
import type { PortfolioEmptyState as EmptyStateKind } from "@auction/lax-ecosystem";
import { EmptyState } from "@auction/ui/components/empty-state";
import { ProductText } from "./product-name";

export const NO_DOCUMENTS_NOTE =
  "Invoices appear here once a sale is invoiced. Certificates and other documents appear when the seller or LAX adds them.";

/**
 * Explains an empty or thin portfolio. A new collector is pointed at each product, someone who
 * only owes payment is led to pay, and someone with works but no documents is told what is
 * coming. Only the first two replace the holdings list; the third sits above it.
 */
export function PortfolioEmptyState({
  kind,
  products,
  payHref,
}: {
  kind: EmptyStateKind;
  products: AccountProductVm[];
  payHref: string | null;
}) {
  if (kind === "new_collector") {
    return (
      <EmptyState
        illustration="frame"
        className={EMPTY_STATE}
        headingLevel="h2"
        title={
          <ProductText
            text="Works you buy on LAX Bid, LAX Shop or lax.art appear here"
            weight="inherit"
          />
        }
        description="Once you have bought or consigned a work, you'll see it here with what you paid and its documents."
        action={
          products.length > 0 ? (
            <>
              {products.map((product) => (
                <Button key={product.id} asChild variant="outline">
                  <a href={product.href}>Open {product.name}</a>
                </Button>
              ))}
            </>
          ) : undefined
        }
      />
    );
  }
  if (kind === "only_awaiting_payment") {
    return (
      <EmptyState
        illustration="ledger"
        className={EMPTY_STATE}
        headingLevel="h2"
        title="Pay to add your works to your portfolio"
        description="Your purchases are waiting for payment. Once they are paid, they appear here with their documents."
        action={
          payHref ? (
            <Button asChild variant="cta">
              <a href={payHref}>Pay now</a>
            </Button>
          ) : undefined
        }
      />
    );
  }
  return (
    <p className="rounded-2xl border border-border-hairline bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant sm:px-6">
      {NO_DOCUMENTS_NOTE}
    </p>
  );
}
