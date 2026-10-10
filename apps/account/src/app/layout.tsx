import { laxFaviconMetadataIcons } from "@auction/branding";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "LAX Account",
  description: "Manage your LAX profile, password and two-step verification",
  icons: laxFaviconMetadataIcons(),
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#181818" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-page-bg text-on-surface antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:rounded focus:bg-surface focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
