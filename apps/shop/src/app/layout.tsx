import { ShopThemeInit } from "@/components/layout/shop-theme-init";
import { ShopFooter } from "@/components/shop-footer";
import { ShopHeader } from "@/components/shop-header";
import { ShopTransientNotices } from "@/components/shop-transient-notices.client";
import {
  loadShopCrossProductFooterLinks,
  loadShopStorefrontBaseUrl,
} from "@/lib/ecosystem/product-directory.server";
import { resolveShopSilentFedcmBootstrapProps } from "@/lib/fedcm/resolve-silent-fedcm-props.server";
import { ShopSilentFedcmBootstrap } from "@/lib/fedcm/silent-fedcm-bootstrap.client";
import { toShopFooterAccountState } from "@/lib/shop-footer-account-state";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import type { Metadata } from "next";
import { Montserrat, Outfit } from "next/font/google";
import { cookies } from "next/headers";
import { Suspense } from "react";
import "./account.css";
import "./commerce.css";
import "./base.css";
import "./catalogue.css";
import "./footer.css";
import "./header.css";
import "./home.css";
import "./state.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: loadShopStorefrontBaseUrl(),
  title: "LAX Shop",
  description: "London Art Exchange — collect contemporary art editions.",
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
};

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
  return (
    <html
      lang="en"
      className={`${montserrat.variable} ${outfit.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ShopThemeInit />
      </head>
      <body>
        <a href="#main-content" className="shop-skip-link">
          Skip to content
        </a>
        <div className="overflow-x-clip">
          <ShopHeader />
          <Suspense fallback={null}>
            <ShopSilentFedcmBootstrap fedcm={silentFedcmProps} />
            <ShopTransientNotices />
          </Suspense>
          {children}
        </div>
        <ShopFooter
          crossProductLinks={crossProductFooterLinks}
          accountState={toShopFooterAccountState(viewer)}
        />
      </body>
    </html>
  );
}
