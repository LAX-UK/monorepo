import { connectRequirementsAttentionCount } from "@auction/connect";
import type { LegalEntityConnectRow } from "@auction/persistence/lib";

export function connectReadyFromCachedEntity(entity: LegalEntityConnectRow): boolean {
  const disabledReason = entity.stripeConnectDisabledReason?.trim();
  return (
    Boolean(entity.stripeConnectAccountId) &&
    entity.stripeConnectPayoutsEnabled &&
    connectRequirementsAttentionCount(
      entity.stripeConnectRequirementsCurrentlyDue,
      entity.stripeConnectRequirementsErrors,
    ) === 0 &&
    !disabledReason
  );
}
