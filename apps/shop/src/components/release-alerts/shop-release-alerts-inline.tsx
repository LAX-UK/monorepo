import { ShopReleaseAlertsForm } from "@/components/release-alerts/shop-release-alerts-form.client";
import { loadReleaseAlertViewer } from "@/lib/shop-release-alerts.server";

/** The form on its own, for a page that has no editions to show and says when they will come. */
export async function ShopReleaseAlertsInline({ source }: { source: string }) {
  return (
    <ShopReleaseAlertsForm
      viewer={await loadReleaseAlertViewer()}
      source={source}
      layout="inline"
    />
  );
}
