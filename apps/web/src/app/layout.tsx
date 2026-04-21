import { ThemeInit } from "@/components/layout/theme-init";
import { Toaster } from "@/components/ui/toaster";
import { rootMetadataBase } from "@/lib/seo/metadata-factory";
import { jsonLdScript, organizationJsonLd, websiteJsonLd } from "@/lib/seo/structured-data";
import type { Metadata } from "next";
import { DM_Sans, Montserrat, Poppins } from "next/font/google";
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
};

const rootJsonLd = jsonLdScript(organizationJsonLd(), websiteJsonLd());

export default function RootLayout({ children }: { children: ReactNode }) {
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
        <script type="application/ld+json" suppressHydrationWarning>
          {rootJsonLd}
        </script>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
