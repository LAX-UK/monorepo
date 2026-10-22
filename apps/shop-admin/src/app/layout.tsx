import { laxFaviconMetadataIcons } from "@auction/branding";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "LAX Admin", template: "%s · LAX Admin" },
  description: "Staff administration for lax.art and LAX Shop",
  icons: laxFaviconMetadataIcons(),
};

export default function ShopAdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="min-h-screen bg-surface text-on-surface antialiased">{children}</body>
    </html>
  );
}
