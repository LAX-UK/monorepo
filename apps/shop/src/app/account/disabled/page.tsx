import {
  ShopAccountBodyText,
  ShopAccountLinkButton,
  ShopAccountShell,
} from "@/components/account/shop-account-shell";
import { shopPageWayfinding } from "@/components/shop-page-header";
import { shopPrivatePageMetadata } from "@/lib/shop-private-page-metadata";

export const metadata = shopPrivatePageMetadata;

export default function ShopDisabledAccountPage() {
  return (
    <ShopAccountShell
      title={shopPageWayfinding.accountDisabled.title}
      breadcrumbs={shopPageWayfinding.accountDisabled.breadcrumbs}
      notice={{
        variant: "destructive",
        title: "Access restricted",
        description:
          "This LAX account is disabled. Contact support if you believe this is a mistake.",
      }}
    >
      <ShopAccountBodyText>
        You can still browse the storefront while signed out.
      </ShopAccountBodyText>
      <ShopAccountLinkButton href="/" label="Return home" variant="outline" />
    </ShopAccountShell>
  );
}
