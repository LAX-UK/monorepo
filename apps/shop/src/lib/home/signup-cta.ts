import { homeSignup } from "@/content/home-marketing";
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
      return { label: "My account", href: viewer.accountHref };
    case "disabled":
      if (viewer.accountHref) {
        return { label: "Account status", href: viewer.accountHref };
      }
      return null;
    case "unavailable":
      return null;
  }
}
