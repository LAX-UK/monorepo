/**
 * Mint and probe Playwright storage-state files from Better Auth sign-in cookies.
 * Used by PR browser-gate setup so each project gets an independent session.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const DEFAULT_WEB_ORIGIN = "http://localhost:3000";
export const DEFAULT_AUTH_URL = "http://localhost:3003";
export const DEFAULT_API_URL = "http://localhost:3001";

/**
 * @param {string} header
 * @param {string} cookieDomain
 */
export function parseSetCookieHeader(header, cookieDomain) {
  const [pair, ...attrs] = header.split(";").map((part) => part.trim());
  const eq = pair.indexOf("=");
  if (eq <= 0) return null;
  const name = pair.slice(0, eq);
  const value = pair.slice(eq + 1);
  /** @type {{ name: string, value: string, domain: string, path: string, expires: number, httpOnly: boolean, secure: boolean, sameSite: "Strict" | "Lax" | "None" }} */
  const cookie = {
    name,
    value,
    domain: cookieDomain,
    path: "/",
    expires: -1,
    httpOnly: false,
    secure: false,
    sameSite: "Lax",
  };
  for (const attr of attrs) {
    const [rawKey, rawVal] = attr.split("=");
    const key = rawKey.trim().toLowerCase();
    const val = rawVal?.trim();
    if (key === "path" && val) cookie.path = val;
    if (key === "domain" && val) cookie.domain = val.replace(/^\./, "");
    if (key === "httponly") cookie.httpOnly = true;
    if (key === "secure") cookie.secure = true;
    if (key === "samesite" && val) {
      const normalized = val.toLowerCase();
      cookie.sameSite = normalized === "strict" ? "Strict" : normalized === "none" ? "None" : "Lax";
    }
    if (key === "max-age" && val) {
      const seconds = Number(val);
      if (Number.isFinite(seconds)) cookie.expires = Math.floor(Date.now() / 1000) + seconds;
    }
    if (key === "expires" && val && cookie.expires === -1) {
      const ts = Date.parse(val);
      if (Number.isFinite(ts)) cookie.expires = Math.floor(ts / 1000);
    }
  }
  return cookie;
}

/**
 * @param {string[]} headers
 * @param {string} cookieDomain
 */
export function storageStateFromSetCookies(headers, cookieDomain) {
  const cookies = headers
    .map((header) => parseSetCookieHeader(header, cookieDomain))
    .filter((cookie) => cookie !== null);
  return { cookies, origins: [] };
}

/** @param {{ cookies?: Array<{ name: string, value: string }> }} state */
export function cookieHeaderFromStorageState(state) {
  return (state.cookies ?? []).map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

function requiredUrl(name, fallback) {
  return (process.env[name] ?? fallback).replace(/\/+$/, "");
}

export function e2eAuthEndpoints() {
  return {
    webOrigin: requiredUrl("WEB_ORIGIN", process.env.PLAYWRIGHT_BASE_URL ?? DEFAULT_WEB_ORIGIN),
    authUrl: requiredUrl("OIDC_ISSUER_URL", process.env.NEXT_PUBLIC_AUTH_URL ?? DEFAULT_AUTH_URL),
    apiUrl: requiredUrl("API_PUBLIC_URL", process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL),
  };
}

export function cookieDomainFromOrigin(origin) {
  return new URL(origin).hostname;
}

/**
 * @param {{ cookie: string, authUrl?: string, apiUrl?: string, webOrigin?: string }} input
 */
export async function probeSession(input) {
  const endpoints = e2eAuthEndpoints();
  const authUrl = input.authUrl ?? endpoints.authUrl;
  const webOrigin = input.webOrigin ?? endpoints.webOrigin;
  const headers = { cookie: input.cookie, origin: webOrigin };
  const [authResponse, meResponse] = await Promise.all([
    fetch(`${authUrl}/api/auth/get-session`, { headers }),
    fetch(`${webOrigin}/api/auth/me`, { headers }),
  ]);
  const authBody = await authResponse.json().catch(() => null);
  const meBody = await meResponse.json().catch(() => null);
  const email = authBody?.user?.email ?? meBody?.data?.email ?? meBody?.email ?? null;
  const userId = authBody?.user?.id ?? meBody?.data?.id ?? meBody?.id ?? null;
  return {
    authenticated: meResponse.ok && meBody?.authenticated === true && Boolean(userId ?? email),
    authStatus: authResponse.status,
    meStatus: meResponse.status,
    email,
    userId,
    cookieNames: input.cookie
      ? input.cookie
          .split(";")
          .map((part) => part.trim().split("=")[0])
          .filter(Boolean)
      : [],
  };
}

/** @param {string} filePath */
export async function probeStorageStateFile(filePath) {
  const state = JSON.parse(readFileSync(filePath, "utf8"));
  const cookie = cookieHeaderFromStorageState(state);
  const probe = await probeSession({ cookie });
  return {
    ...probe,
    file: filePath,
    cookieCount: state.cookies?.length ?? 0,
    cookieDomain: state.cookies?.[0]?.domain ?? null,
  };
}

export function formatProbeFailure(role, filePath, probe) {
  return [
    `E2E auth state "${role}" is not an authenticated session.`,
    `file=${filePath}`,
    `get-session=${probe.authStatus}`,
    `/api/auth/me=${probe.meStatus}`,
    `cookies=${(probe.cookieNames ?? []).join(",") || "(none)"}`,
    `domain=${probe.cookieDomain ?? "?"}`,
  ].join(" ");
}

/**
 * @param {{ email: string, password: string, outPath: string, role: string, webOrigin?: string, authUrl?: string }} input
 */
export async function mintRoleAuthState(input) {
  const endpoints = e2eAuthEndpoints();
  const webOrigin = input.webOrigin ?? endpoints.webOrigin;
  const authUrl = input.authUrl ?? endpoints.authUrl;
  const login = await fetch(`${authUrl}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: webOrigin },
    body: JSON.stringify({ email: input.email, password: input.password }),
  });
  if (!login.ok) {
    const detail = await login.text().catch(() => "");
    throw new Error(
      `sign-in for ${input.role} failed: ${login.status} ${detail.slice(0, 200)}`.trim(),
    );
  }
  const setCookies = login.headers.getSetCookie?.() ?? [];
  if (setCookies.length === 0) {
    throw new Error(`sign-in for ${input.role} returned no Set-Cookie headers`);
  }
  const state = storageStateFromSetCookies(setCookies, cookieDomainFromOrigin(webOrigin));
  mkdirSync(path.dirname(input.outPath), { recursive: true });
  writeFileSync(input.outPath, `${JSON.stringify(state, null, 2)}\n`);
  const probe = await probeStorageStateFile(input.outPath);
  if (!probe.authenticated) {
    throw new Error(formatProbeFailure(input.role, input.outPath, probe));
  }
  return probe;
}

/** @param {unknown} report */
export function writeProbeReport(report, outPath) {
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
}
