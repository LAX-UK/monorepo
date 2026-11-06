import { Button } from "@/components/account-button";
import type { AccountProductVm } from "@/server/domain/account-products.vm";
import { EmptyState } from "@auction/ui/components/empty-state";
import { EMPTY_STATE } from "./account-ui";

/** Home for someone with no works yet: where to start, with the three products as the actions. */
export function HomeNewPerson({ products }: { products: AccountProductVm[] }) {
  return (
    <EmptyState
      illustration="easel"
      className={EMPTY_STATE}
      headingLevel="h2"
      title="Start your collection"
      description="Works you buy on lax.art, LAX Shop and LAX Bid all appear here, with what you paid and their documents."
      action={
        products.length > 0 ? (
          <>
            {products.map((product) => (
              <Button key={product.id} asChild variant="outline">
                <a href={product.href}>{`Open ${product.name}`}</a>
              </Button>
            ))}
          </>
        ) : undefined
      }
    />
  );
}
