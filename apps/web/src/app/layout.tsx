import { AnalyticsBootstrap } from "@/components/analytics/analytics-bootstrap";
import { AnalyticsDebugPanel } from "@/components/analytics/analytics-debug-panel";
import { AnalyticsPageView } from "@/components/analytics/analytics-page-view";
import { AuthAnalyticsSync } from "@/components/analytics/auth-analytics-sync";
import { ConsentInit } from "@/components/analytics/consent-init";
import { GtmNoscript } from "@/components/analytics/gtm-noscript";
import { MarketingAttributionSync } from "@/components/analytics/marketing-attribution-sync";
import { MarketingClickIdsSync } from "@/components/analytics/marketing-click-ids-sync";
import { BottomChromeSync } from "@/components/layout/bottom-chrome-sync";
import { SessionThemeSync } from "@/components/layout/session-theme-sync";
import { ThemeInit } from "@/components/layout/theme-init";
import { ThemeSystemListener } from "@/components/layout/theme-system-listener";
import { WebVitalsReporter } from "@/components/layout/web-vitals-reporter";
import { ConsentShell } from "@/components/marketing/consent/consent-shell";
import { BrowserOfflineBanner } from "@/components/pwa/browser-offline-banner";
import { PushBootstrap } from "@/components/pwa/push-bootstrap";
import { PwaInstallPrompt } from "@/components/pwa/pwa-install-prompt";
import { Toaster } from "@/components/ui/toaster";
import { ConsentProvider } from "@/lib/analytics/consent/context";
import { readConsentFromCookies } from "@/lib/analytics/consent/server";
import { isAnalyticsEnabled } from "@/lib/analytics/is-enabled";
import { AuthSessionProvider } from "@/lib/auth/auth-session-provider";
import { hasAuthSessionCookie } from "@/lib/auth/session-cookie";
import { SITE_SHORT_NAME, SITE_THEME_COLOR_DARK, SITE_THEME_COLOR_LIGHT } from "@/lib/brand";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { resolveSessionThemeSyncProp } from "@/lib/preferences/resolve-root-theme.server";
import { isSsrDarkClass } from "@/lib/preferences/ssr-theme-dark";
import { resolveEffectiveThemePreference } from "@/lib/preferences/sync-theme-cookie.server";
import {
  DEFAULT_THEME_PREFERENCE,
  THEME_COOKIE_NAME,
  parseThemeCookie,
} from "@/lib/preferences/theme-cookie";
import { AppQueryProvider } from "@/lib/query/query-provider";
import { isIndexingAllowedAtBuildTime } from "@/lib/seo/is-indexing-allowed";
import { rootMetadataBase } from "@/lib/seo/metadata-factory";
import { jsonLdScript, organizationJsonLd, websiteJsonLd } from "@/lib/seo/structured-data";
import { cn } from "@auction/ui";
import type { Metadata, Viewport } from "next";
import { Montserrat, Outfit } from "next/font/google";
import { cookies, headers } from "next/headers";
import type { ReactNode } from "react";
import { Suspense } from "react";
import "./globals.css";

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
  ...rootMetadataBase(),
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicons/favicon.ico" },
      { url: "/favicons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/favicons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: SITE_SHORT_NAME,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: SITE_THEME_COLOR_LIGHT },
    { media: "(prefers-color-scheme: dark)", color: SITE_THEME_COLOR_DARK },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const hdrs = await headers();
  const nonce = hdrs.get("x-nonce") ?? "";
  const rootJsonLd = isIndexingAllowedAtBuildTime()
    ? jsonLdScript(organizationJsonLd(), websiteJsonLd())
    : null;
  const cookieStore = await cookies();
  const cookieHeader = hdrs.get("cookie") ?? "";
  const existingTheme = parseThemeCookie(cookieStore.get(THEME_COOKIE_NAME)?.value);
  const authCookiePresent = hasAuthSessionCookie(cookieHeader);
  const user = authCookiePresent ? await getServerSessionUser() : null;
  const profileTheme = user?.uiPreferences?.theme ?? DEFAULT_THEME_PREFERENCE;
  const themePref =
    existingTheme ?? (await resolveEffectiveThemePreference(user ? profileTheme : undefined));
  const consentSnapshot = readConsentFromCookies(cookieStore);
  const consentProviderKey =
    consentSnapshot === null ? "consent:none" : JSON.stringify(consentSnapshot);
  const isDark = isSsrDarkClass(themePref, hdrs.get("sec-ch-prefers-color-scheme"));

  return (
    <html
      lang="en"
      className={cn(montserrat.variable, outfit.variable, isDark && "dark")}
      suppressHydrationWarning
    >
      <head>
        <ThemeInit />
        {isAnalyticsEnabled() ? <ConsentInit snapshot={consentSnapshot} nonce={nonce} /> : null}
      </head>
      <body>
        <ConsentProvider key={consentProviderKey} initialSnapshot={consentSnapshot}>
          <GtmNoscript analyticsGranted={consentSnapshot?.analytics === true} />
          <BottomChromeSync />
          <SessionThemeSync
            theme={resolveSessionThemeSyncProp({
              user,
              existingTheme,
              defaultTheme: DEFAULT_THEME_PREFERENCE,
            })}
          />
          <ThemeSystemListener />
          {rootJsonLd ? (
            <script
              type="application/ld+json"
              suppressHydrationWarning
              {...(nonce ? { nonce } : {})}
            >
              {rootJsonLd}
            </script>
          ) : null}
          <a href="#main-content" className="skip-link">
            Skip to main content
          </a>
          <AnalyticsBootstrap nonce={nonce} />
          <Suspense fallback={null}>
            <AnalyticsPageView />
            <AuthAnalyticsSync />
          </Suspense>
          <MarketingClickIdsSync />
          <MarketingAttributionSync />
          <BrowserOfflineBanner />
          <AuthSessionProvider serverUser={user} authCookiePresent={authCookiePresent}>
            <AppQueryProvider>
              <PushBootstrap />
              <PwaInstallPrompt />
              {children}
            </AppQueryProvider>
          </AuthSessionProvider>
          <Toaster />
          <WebVitalsReporter />
          <ConsentShell />
          <AnalyticsDebugPanel />
        </ConsentProvider>
      </body>
    </html>
  );
}
