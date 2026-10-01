import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LAX Shop Admin",
  description: "Staff administration for shop.lax.art",
};

export default function ShopAdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="min-h-screen bg-surface text-on-surface antialiased">{children}</body>
    </html>
  );
}
