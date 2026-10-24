import { homeSignup } from "@/content/home-marketing";
import { SHOP_ORDERS_HREF } from "@/lib/account/shop-account-routes";
import type { ShopViewerState } from "@/lib/shop-viewer-state";

export type HomeSignupCta = {
  label: string;
  href: string;
};

export function homeSignupCta(viewer: ShopViewerState): HomeSignupCta | null {
  switch (viewer.kind) {
    case "guest":
      return { label: homeSignup.ctaLabel, href: homeSignup.ctaHref };
    case "authenticated":
      return { label: "Your orders", href: SHOP_ORDERS_HREF };
    case "disabled":
      if (viewer.accountHref) {
        return { label: "Account status", href: viewer.accountHref };
      }
      return null;
    case "unavailable":
      return null;
  }
}
