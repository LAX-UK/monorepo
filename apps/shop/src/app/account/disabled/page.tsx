import {
  ShopAccountBodyText,
  ShopAccountLinkButton,
  ShopAccountShell,
} from "@/components/account/shop-account-shell";
import { shopPageWayfinding } from "@/components/shop-page-header";
import { shopPrivatePageMetadata } from "@/lib/shop-private-page-metadata";
import { SITE_SUPPORT_EMAIL } from "@auction/branding";

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
      <ShopAccountLinkButton
        href={`mailto:${SITE_SUPPORT_EMAIL}?subject=${encodeURIComponent("Disabled LAX account")}`}
        label="Contact support"
      />
      <ShopAccountLinkButton href="/" label="Return home" variant="outline" />
    </ShopAccountShell>
  );
}
