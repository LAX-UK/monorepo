import type { Page } from "@playwright/test";
import { signInStaffThroughIdentity } from "./staff-sign-in.js";

export type StaffBrowserSession = {
  baseUrl: string;
  cookieHeader: string;
  csrfToken: string;
};

function buildCookieHeader(cookies: Awaited<ReturnType<Page["context"]["cookies"]>>): string {
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

export async function openStaffBrowserSession(input: {
  page: Page;
  baseUrl: string;
  authBaseUrl: string;
  email: string;
  password: string;
  totpSecret?: string;
}): Promise<StaffBrowserSession> {
  await signInStaffThroughIdentity({
    page: input.page,
    authBaseUrl: input.authBaseUrl,
    email: input.email,
    password: input.password,
    totpSecret: input.totpSecret,
    returnTo: "/",
  });
  const cookies = await input.page.context().cookies();
  const csrf = cookies.find((c) => c.name === "lax-shop-admin-csrf")?.value;
  if (!csrf) {
    throw new Error("Missing lax-shop-admin-csrf cookie after sign-in");
  }
  return {
    baseUrl: input.baseUrl.replace(/\/+$/, ""),
    cookieHeader: buildCookieHeader(cookies),
    csrfToken: csrf,
  };
}
