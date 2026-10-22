import { laxFaviconMetadataIcons } from "@auction/branding";
import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "LAX Admin", template: "%s · LAX Admin" },
  description: "Staff administration for lax.art and LAX Shop",
  icons: laxFaviconMetadataIcons(),
  robots: { index: false, follow: false },
};

export default function ShopAdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={montserrat.variable}>
      <body className="min-h-screen bg-surface text-on-surface antialiased">{children}</body>
    </html>
  );
}
