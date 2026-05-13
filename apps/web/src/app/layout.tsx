import { ThemeInit } from "@/components/layout/theme-init";
import { WebVitalsReporter } from "@/components/layout/web-vitals-reporter";
import { Toaster } from "@/components/ui/toaster";
import { SITE_SHORT_NAME, SITE_THEME_COLOR_DARK, SITE_THEME_COLOR_LIGHT } from "@/lib/brand";
import { rootMetadataBase } from "@/lib/seo/metadata-factory";
import { jsonLdScript, organizationJsonLd, websiteJsonLd } from "@/lib/seo/structured-data";
import type { Metadata, Viewport } from "next";
import { DM_Sans, Montserrat, Poppins } from "next/font/google";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-poppins",
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
  const nonce = (await headers()).get("x-nonce") ?? "";
  const rootJsonLd = jsonLdScript(organizationJsonLd(), websiteJsonLd());

  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${montserrat.variable} ${poppins.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeInit />
      </head>
      <body>
        <script type="application/ld+json" suppressHydrationWarning {...(nonce ? { nonce } : {})}>
          {rootJsonLd}
        </script>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        {children}
        <Toaster />
        <WebVitalsReporter />
      </body>
    </html>
  );
}
