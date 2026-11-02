import type { BackToProductVm } from "@/server/domain/origin-product";
import { TextLink } from "@auction/ui/lax";

/** The way back to the LAX product the visitor came from, in the kit's text link. */
export function BackToProductLink({ product }: { product: BackToProductVm }) {
  return (
    <TextLink href={product.href} className="min-h-11">
      <span aria-hidden="true">←</span>
      {product.label}
    </TextLink>
  );
}
