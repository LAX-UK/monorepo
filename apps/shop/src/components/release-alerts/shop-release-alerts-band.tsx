import { ShopReleaseAlertsForm } from "@/components/release-alerts/shop-release-alerts-form.client";
import { RELEASE_ALERTS_ANCHOR } from "@/lib/release-alerts/release-alerts-anchor";
import { loadReleaseAlertViewer } from "@/lib/shop-release-alerts.server";
import { MarketingSplitFeature } from "@auction/marketing-ui";

/**
 * "Hear about new editions first" on the home page: a centred band on the paper tone, or on the
 * plain page when the band sequence gives the tint to a neighbour. Text only, so no half is left
 * empty.
 */
export async function ShopReleaseAlertsBand({ tinted }: { tinted: boolean }) {
  const viewer = await loadReleaseAlertViewer();
  return (
    <div id={RELEASE_ALERTS_ANCHOR} className="shop-release-alerts-band">
      <MarketingSplitFeature
        tone={tinted ? "feature" : "plain"}
        className="shop-release-alerts-feature"
        eyebrow={<span className="shop-home-eyebrow">Release alerts</span>}
        title="Hear about new editions first"
        body="One email when a new edition is released. Stop with one click in any email."
        action={<ShopReleaseAlertsForm viewer={viewer} source="shop_home" layout="band" />}
      />
    </div>
  );
}
