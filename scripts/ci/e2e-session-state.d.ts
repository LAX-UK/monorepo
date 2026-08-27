export type PlaywrightCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Strict" | "Lax" | "None";
};

export type PlaywrightStorageState = {
  cookies: PlaywrightCookie[];
  origins: [];
};

export type SessionProbeResult = {
  authenticated: boolean;
  authStatus: number;
  meStatus: number;
  email: string | null;
  userId?: string | null;
  cookieNames: string[];
  file?: string;
  cookieCount?: number;
  cookieDomain?: string | null;
};

export const DEFAULT_WEB_ORIGIN: string;
export const DEFAULT_AUTH_URL: string;
export const DEFAULT_API_URL: string;

export function parseSetCookieHeader(header: string, cookieDomain: string): PlaywrightCookie | null;
export function storageStateFromSetCookies(
  headers: string[],
  cookieDomain: string,
): PlaywrightStorageState;
export function cookieHeaderFromStorageState(state: {
  cookies?: Array<{ name: string; value: string }>;
}): string;
export function e2eAuthEndpoints(): { webOrigin: string; authUrl: string; apiUrl: string };
export function cookieDomainFromOrigin(origin: string): string;
export function probeSession(input: {
  cookie: string;
  authUrl?: string;
  apiUrl?: string;
  webOrigin?: string;
}): Promise<SessionProbeResult>;
export function probeStorageStateFile(filePath: string): Promise<SessionProbeResult>;
export function formatProbeFailure(
  role: string,
  filePath: string,
  probe: SessionProbeResult,
): string;
export function mintRoleAuthState(input: {
  email: string;
  password: string;
  outPath: string;
  role: string;
  webOrigin?: string;
  authUrl?: string;
}): Promise<SessionProbeResult>;
export function writeProbeReport(report: unknown, outPath: string): void;
