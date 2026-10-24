import { laxFaviconMetadataIcons } from "@auction/branding";
import { STAFF_THEME_COOKIE, parseStaffTheme, staffThemeHtmlAttributes } from "@auction/staff-ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { montserrat, outfit } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "LAX Admin", template: "%s · LAX Admin" },
  description: "Staff administration for lax.art and LAX Shop",
  icons: laxFaviconMetadataIcons(),
  robots: { index: false, follow: false },
};

export default async function ShopAdminRootLayout({ children }: { children: React.ReactNode }) {
  // The theme is a cookie, so the server renders the chosen scheme and nothing flashes.
  const theme = parseStaffTheme((await cookies()).get(STAFF_THEME_COOKIE)?.value);
  const { className, ...themeAttributes } = staffThemeHtmlAttributes(theme);
  return (
    <html
      lang="en-GB"
      className={[montserrat.variable, outfit.variable, className].filter(Boolean).join(" ")}
      {...themeAttributes}
    >
      <body className="min-h-screen bg-staff-canvas text-staff-fg antialiased">{children}</body>
    </html>
  );
}
