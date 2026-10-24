import { laxFaviconMetadataIcons } from "@auction/branding";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { THEME_INIT_SNIPPET } from "../lib/theme";
import { montserrat } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "LAX Account",
  description:
    "One LAX Account for LAX Bid, LAX Shop and lax.art. Manage your details, password and two-step verification.",
  icons: laxFaviconMetadataIcons(),
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#121414" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // The theme script sets the `dark` class before React hydrates, so the attribute differs.
    <html lang="en-GB" className={montserrat.variable} suppressHydrationWarning>
      <head>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted static theme bootstrap, no user input
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SNIPPET }}
        />
      </head>
      <body className="min-h-screen bg-page-bg font-body text-on-surface antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
