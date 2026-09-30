import {
  type HeaderGetter,
  isBackgroundAuthRequest,
  isDocumentNavigation,
} from "@auction/identity-rp";
import type { Context } from "hono";

export function headerGetterFromContext(c: Context): HeaderGetter {
  return (name) => c.req.header(name);
}

export function isBackgroundShopAuthRequest(c: Context): boolean {
  return isBackgroundAuthRequest(headerGetterFromContext(c));
}

export function isDocumentShopAuthRequest(c: Context): boolean {
  return isDocumentNavigation(c.req.method, headerGetterFromContext(c));
}
