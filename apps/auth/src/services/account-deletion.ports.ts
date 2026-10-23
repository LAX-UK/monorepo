import type {
  DeletionEligibilityProduct,
  ProductDeletionEligibility,
} from "@auction/identity-contracts";

/**
 * Asks one product whether the person still has something in flight there. It rejects when the
 * product cannot answer (not configured, slow, refused, or answered badly): the caller treats
 * that as "unavailable", never as "nothing in the way".
 */
export interface ProductDeletionEligibilityProbe {
  check(
    product: DeletionEligibilityProduct,
    subjectId: string,
  ): Promise<ProductDeletionEligibility>;
}
