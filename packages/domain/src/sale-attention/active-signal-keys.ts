import { userHasAccessTo } from "@auction/types";
import type { SaleStatus } from "@auction/types";
import type { SaleAttentionContributor } from "./sale-attention-contributor.js";
import type { SaleAttentionPrincipal, SaleAttentionSignalKey } from "./sale-attention-types.js";

function contributorAuthorized(
  contributor: SaleAttentionContributor,
  principal: SaleAttentionPrincipal,
): boolean {
  if (!contributor.requiredCapability) return true;
  if (principal.role !== "staff") return false;
  return userHasAccessTo(
    principal.role,
    principal.staffRole as Parameters<typeof userHasAccessTo>[1],
    contributor.requiredCapability,
  );
}

export function resolveApplicableContributors(
  status: SaleStatus,
  contributors: readonly SaleAttentionContributor[],
  principal: SaleAttentionPrincipal,
): SaleAttentionContributor[] {
  return contributors.filter((c) => c.appliesTo(status) && contributorAuthorized(c, principal));
}

export function resolveNeededSignalKeys(
  status: SaleStatus,
  contributors: readonly SaleAttentionContributor[],
  principal: SaleAttentionPrincipal,
): SaleAttentionSignalKey[] {
  const applicable = resolveApplicableContributors(status, contributors, principal);
  const keys = new Set<SaleAttentionSignalKey>();
  for (const contributor of applicable) {
    for (const need of contributor.needs) {
      keys.add(need);
    }
  }
  return [...keys];
}
