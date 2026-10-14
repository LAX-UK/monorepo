import { ArtAnalyticsConsent } from "@/components/analytics/art-analytics-consent.client";
import { ArtHeader } from "@/components/header/art-header";
import { ArtFooter } from "@/components/layout/art-footer";
import { ArtMobileBottomNav } from "@/components/layout/art-mobile-bottom-nav.client";
import { ArtSmoothScroll } from "@/components/layout/art-smooth-scroll.client";
import { ArtThemeInit } from "@/components/layout/art-theme-init";
import { ArtJsonLd } from "@/components/seo/art-json-ld";
import { isArtIndexingAllowed, loadArtEnv, loadArtStorefrontBaseUrl } from "@/env.server";
import { ART_CONSENT_COOKIE, parseArtConsent } from "@/lib/analytics/art-consent";
import { composeArtChrome } from "@/lib/layout/art-chrome.composer";
import { NOINDEX_ROBOTS } from "@/lib/seo/art-indexing";
import { artSiteJsonLd } from "@/lib/seo/art-structured-data";
import { ART_THEME_COOKIE, parseArtTheme } from "@/lib/theme/art-theme";
import { laxFaviconMetadataIcons } from "@auction/branding";
import type { Metadata } from "next";
import { Montserrat, Outfit } from "next/font/google";
import { cookies } from "next/headers";
import "./base.css";
import "./footer.css";

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

const SITE_DESCRIPTION = "London Art Exchange — gallery originals and enquiry-led sales.";

export function generateMetadata(): Metadata {
  const verification = loadArtEnv().ART_GOOGLE_SITE_VERIFICATION;
  return {
    metadataBase: loadArtStorefrontBaseUrl(),
    title: "LAX Art",
    description: SITE_DESCRIPTION,
    icons: laxFaviconMetadataIcons(),
    openGraph: {
      type: "website",
      title: "LAX Art",
      description: SITE_DESCRIPTION,
      url: "/",
      siteName: "LAX Art",
    },
    ...(isArtIndexingAllowed() ? {} : { robots: NOINDEX_ROBOTS }),
    ...(verification ? { verification: { google: verification } } : {}),
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [cookieStore, chrome] = await Promise.all([cookies(), composeArtChrome()]);
  const themePreference = parseArtTheme(cookieStore.get(ART_THEME_COOKIE)?.value);
  const measurementId = loadArtEnv().ART_GA_MEASUREMENT_ID;

  return (
    <html
      lang="en"
      className={`${montserrat.variable} ${outfit.variable}${themePreference === "dark" ? " dark" : ""}`}
      suppressHydrationWarning
    >
      <head>
        <ArtThemeInit />
        <ArtJsonLd data={artSiteJsonLd(loadArtStorefrontBaseUrl())} />
      </head>
      <body className="bg-page-bg text-on-surface">
        <ArtSmoothScroll>
          <a href="#main-content" className="art-skip-link">
            Skip to content
          </a>
          <ArtHeader />
          <main
            id="main-content"
            tabIndex={-1}
            className="min-h-[calc(100dvh-var(--header-height))] pb-12 pt-[calc(var(--header-height)+env(safe-area-inset-top,0px))] outline-none"
          >
            {children}
          </main>
          <ArtFooter vm={chrome.footer} />
          <ArtMobileBottomNav />
          {measurementId ? (
            <ArtAnalyticsConsent
              measurementId={measurementId}
              initialChoice={parseArtConsent(cookieStore.get(ART_CONSENT_COOKIE)?.value)}
            />
          ) : null}
        </ArtSmoothScroll>
      </body>
    </html>
  );
}
