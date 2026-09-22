import { SHOP_THEME_INIT_SNIPPET } from "@/lib/theme/shop-theme";

/** Inline bootstrap so `html.dark` is set before first paint. */
export function ShopThemeInit() {
  return (
    <script
      // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted static theme bootstrap, no user input
      dangerouslySetInnerHTML={{ __html: SHOP_THEME_INIT_SNIPPET }}
    />
  );
}
