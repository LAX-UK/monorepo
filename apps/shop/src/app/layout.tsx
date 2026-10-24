import { ShopSmoothScroll } from "@/components/layout/shop-smooth-scroll.client";
import { ShopThemeInit } from "@/components/layout/shop-theme-init";
import { ShopFooter } from "@/components/shop-footer";
import { ShopHeader } from "@/components/shop-header";
import { ShopTransientNotices } from "@/components/shop-transient-notices.client";
import { SilentSignInNotice } from "@/components/silent-sign-in-notice.client";
import {
  isShopIndexingAllowed,
  loadShopCrossProductFooterLinks,
  loadShopStorefrontBaseUrl,
} from "@/lib/ecosystem/product-directory.server";
import { resolveShopSilentFedcmBootstrapProps } from "@/lib/fedcm/resolve-silent-fedcm-props.server";
import { ShopSilentFedcmBootstrap } from "@/lib/fedcm/silent-fedcm-bootstrap.client";
import { NOINDEX_ROBOTS } from "@/lib/seo/shop-indexing";
import { toShopFooterAccountState } from "@/lib/shop-footer-account-state";
import { shopIdentityUrl } from "@/lib/shop-identity.server";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import { SHOP_THEME_COOKIE, parseShopTheme } from "@/lib/theme/shop-theme";
import { laxFaviconMetadataIcons } from "@auction/branding";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";
import "./account.css";
import "./commerce.css";
import { montserrat, outfit } from "./fonts";
import "./base.css";
import "./catalogue.css";
import "./footer.css";
import "./header.css";
import "./home.css";
import "./policy.css";
import "./state.css";
import "./elements.css";

export const generateMetadata = (): Metadata => ({
  metadataBase: loadShopStorefrontBaseUrl(),
  ...(isShopIndexingAllowed() ? {} : { robots: NOINDEX_ROBOTS }),
  title: "LAX Shop",
  description: "London Art Exchange — collect contemporary art editions.",
  icons: laxFaviconMetadataIcons(),
  openGraph: {
    type: "website",
    title: "LAX Shop",
    description: "London Art Exchange — collect contemporary art editions.",
    url: "/",
    siteName: "LAX Shop",
  },
  twitter: {
    card: "summary_large_image",
    title: "LAX Shop",
    description: "London Art Exchange — collect contemporary art editions.",
  },
});

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [crossProductFooterLinks, viewer, cookieStore] = await Promise.all([
    Promise.resolve(loadShopCrossProductFooterLinks()),
    loadShopViewerState(),
    cookies(),
  ]);
  const silentFedcmProps = resolveShopSilentFedcmBootstrapProps(
    cookieStore.getAll(),
    viewer.kind === "authenticated",
  );
  const themePreference = parseShopTheme(cookieStore.get(SHOP_THEME_COOKIE)?.value);
  return (
    <html
      lang="en"
      className={`${montserrat.variable} ${outfit.variable}${themePreference === "dark" ? " dark" : ""}`}
      suppressHydrationWarning
    >
      <head>
        <ShopThemeInit />
      </head>
      <body>
        <ShopSmoothScroll>
          <a href="#main-content" className="shop-skip-link">
            Skip to content
          </a>
          <div className="overflow-x-clip">
            <ShopHeader />
            <Suspense fallback={null}>
              <ShopSilentFedcmBootstrap fedcm={silentFedcmProps} />
              <SilentSignInNotice
                logoutActionUrl={shopIdentityUrl("/logout")}
                displayName={viewer.kind === "authenticated" ? viewer.displayName : null}
                email={viewer.kind === "authenticated" ? viewer.email : null}
              />
              <ShopTransientNotices />
            </Suspense>
            {children}
          </div>
          <ShopFooter
            crossProductLinks={crossProductFooterLinks}
            accountState={toShopFooterAccountState(viewer)}
          />
        </ShopSmoothScroll>
      </body>
    </html>
  );
}
