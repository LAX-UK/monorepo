import type { ShopPolicyDocument } from "@/content/policies";
import type { ShopPolicyRelease } from "@/content/policies/shop-policy-status";
import { type LegalHubLink, LegalPolicyPage, MarketingDetailShell } from "@auction/marketing-ui";

export { formatLegalPolicyDate as formatPolicyDate } from "@auction/marketing-ui";

export type ShopPolicyPageProps = {
  document: ShopPolicyDocument;
  release: ShopPolicyRelease;
  /** True off production while the page awaits legal approval. */
  draft: boolean;
  /** Shop's policy pages that may be linked on this deployment, for the policy list. */
  hubLinks: readonly LegalHubLink[];
};

export function ShopPolicyPage({ document, release, draft, hubLinks }: ShopPolicyPageProps) {
  return (
    <MarketingDetailShell wrapChildren={false} data-policy={document.slug}>
      <LegalPolicyPage
        document={document}
        release={release}
        draft={draft}
        hubLabel="Shop policies"
        hubLinks={hubLinks}
        company="shop"
      />
    </MarketingDetailShell>
  );
}
