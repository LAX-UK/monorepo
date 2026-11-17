import { ArtAnalyticsConsent } from "@/components/analytics/art-analytics-consent.client";
import { ArtFooter } from "@/components/layout/art-footer";
import { ArtSmoothScroll } from "@/components/layout/art-smooth-scroll.client";
import { ArtThemeInit } from "@/components/layout/art-theme-init";
import {
  ArtViewerBottomBar,
  ArtViewerHeader,
} from "@/components/layout/art-viewer-chrome-bars.client";
import { ArtJsonLd } from "@/components/seo/art-json-ld";
import { ArtViewerChromeProvider } from "@/components/viewer/art-viewer-chrome.client";
import { isArtIndexingAllowed, loadArtEnv, loadArtStorefrontBaseUrl } from "@/env.server";
import { composeArtChrome } from "@/lib/layout/art-chrome.composer";
import { loadArtCatalogueImageOrigins } from "@/lib/media/catalogue-image.server";
import { NOINDEX_ROBOTS } from "@/lib/seo/art-indexing";
import { artSiteJsonLd } from "@/lib/seo/art-structured-data";
import { artGuestViewerState } from "@/lib/viewer/art-viewer-destinations.server";
import { laxFaviconMetadataIcons } from "@auction/branding";
import { EssentialCookiesDialog, MarketingBottomBarSpace } from "@auction/marketing-ui";
import { CatalogueImageProvider } from "@auction/shop-portal/react";
import type { Metadata } from "next";
import Link from "next/link";
import { montserrat, outfit } from "./fonts";
import "./base.css";
import "./footer.css";

const SITE_DESCRIPTION = "London Art Exchange — gallery originals and enquiry-led sales.";

export function generateMetadata(): Metadata {
  const verification = loadArtEnv().ART_GOOGLE_SITE_VERIFICATION;
  return {
    metadataBase: loadArtStorefrontBaseUrl(),
    title: "lax.art",
    description: SITE_DESCRIPTION,
    icons: laxFaviconMetadataIcons(),
    openGraph: {
      type: "website",
      title: "lax.art",
      description: SITE_DESCRIPTION,
      url: "/",
      siteName: "lax.art",
    },
    ...(isArtIndexingAllowed() ? {} : { robots: NOINDEX_ROBOTS }),
    ...(verification ? { verification: { google: verification } } : {}),
  };
}

/**
 * Reads nothing about the visitor (no cookies, headers or session), so a page that reads nothing
 * either can be prerendered and its HTML shared (the home page). The theme is set before first
 * paint by ArtThemeInit; the account chrome is read by the browser (ArtViewerChromeProvider).
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const chrome = await composeArtChrome();
  const measurementId = loadArtEnv().ART_GA_MEASUREMENT_ID;

  return (
    <html
      lang="en"
      className={`${montserrat.variable} ${outfit.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ArtThemeInit />
        <ArtJsonLd data={artSiteJsonLd(loadArtStorefrontBaseUrl())} />
      </head>
      <body className="bg-page-bg text-on-surface">
        <CatalogueImageProvider viewer="art" origins={loadArtCatalogueImageOrigins()}>
          <ArtViewerChromeProvider guest={artGuestViewerState()}>
            <ArtSmoothScroll>
              <a href="#main-content" className="art-skip-link">
                Skip to content
              </a>
              <ArtViewerHeader
                productLinks={chrome.productLinks}
                familyLinks={chrome.familyLinks}
                headerNav={chrome.headerNav}
              />
              <main
                id="main-content"
                tabIndex={-1}
                className="min-h-[calc(100dvh-var(--header-height))] pb-12 pt-[calc(var(--header-height)+env(safe-area-inset-top,0px))] outline-none"
              >
                {children}
              </main>
              <ArtFooter vm={chrome.footer} />
              {/* The one place content reserves the docked tab bar's height (--lax-bottom-bar-space). */}
              <MarketingBottomBarSpace />
              <ArtViewerBottomBar />
              {measurementId ? (
                <ArtAnalyticsConsent
                  measurementId={measurementId}
                  cookiePolicyLinked={chrome.linkablePolicies.includes("cookies")}
                />
              ) : (
                <EssentialCookiesDialog
                  productName="lax.art"
                  cookiePolicyHref={
                    chrome.linkablePolicies.includes("cookies") ? "/legal/cookies" : undefined
                  }
                  Link={Link}
                />
              )}
            </ArtSmoothScroll>
          </ArtViewerChromeProvider>
        </CatalogueImageProvider>
      </body>
    </html>
  );
}
