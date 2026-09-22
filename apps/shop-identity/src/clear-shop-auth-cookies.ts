import type { Context } from "hono";
import { clearOidcIdTokenCookie, clearSessionCookie } from "./session.js";

export function clearShopAuthCookies(c: Context): void {
  clearSessionCookie(c);
  clearOidcIdTokenCookie(c);
}
