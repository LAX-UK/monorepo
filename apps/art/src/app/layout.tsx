import { ArtHeader } from "@/components/header/art-header";
import { ArtMobileBottomNav } from "@/components/layout/art-mobile-bottom-nav.client";
import { ArtThemeInit } from "@/components/layout/art-theme-init";
import { loadArtStorefrontBaseUrl } from "@/env.server";
import { loadArtCrossProductFooterLinks } from "@/lib/ecosystem/product-directory.server";
import { ART_THEME_COOKIE, parseArtTheme } from "@/lib/theme/art-theme";
import { MARKETING_PAGE_SHELL, laxFaviconMetadataIcons } from "@auction/branding";
import type { Metadata } from "next";
import { Montserrat, Outfit } from "next/font/google";
import { cookies } from "next/headers";
import "./base.css";

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
  metadataBase: loadArtStorefrontBaseUrl(),
  title: "LAX Art",
  description: "London Art Exchange — gallery originals and enquiry-led sales.",
  icons: laxFaviconMetadataIcons(),
  openGraph: {
    type: "website",
    title: "LAX Art",
    description: "London Art Exchange — gallery originals and enquiry-led sales.",
    url: "/",
    siteName: "LAX Art",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const themePreference = parseArtTheme(cookieStore.get(ART_THEME_COOKIE)?.value);
  const footerLinks = loadArtCrossProductFooterLinks();

  return (
    <html
      lang="en"
      className={`${montserrat.variable} ${outfit.variable}${themePreference === "dark" ? " dark" : ""}`}
      suppressHydrationWarning
    >
      <head>
        <ArtThemeInit />
      </head>
      <body className="bg-page-bg text-on-surface">
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
        <footer className="border-t border-outline-variant/40 bg-surface-container-low py-8 pb-[calc(var(--art-bottom-nav-height)+2rem)] text-sm text-on-surface-variant md:pb-8">
          <nav aria-label="LAX products" className={MARKETING_PAGE_SHELL}>
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {footerLinks.map((link) => (
                <li key={link.id}>
                  <a
                    href={link.href}
                    className="art-focus-ring inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </footer>
        <ArtMobileBottomNav />
      </body>
    </html>
  );
}
