const SHOP_AUTH_PATH_PREFIXES = ["/login", "/register"] as const;

export function isShopAuthHref(href: string): boolean {
  if (!href.startsWith("/") || href.startsWith("//")) return false;
  const path = href.split("?")[0] ?? href;
  return SHOP_AUTH_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
