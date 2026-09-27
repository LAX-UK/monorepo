export type SilentSignInCookieNames = {
  probe: string;
  quiet: string;
  suppressed: string;
  notice: string;
};

export type SilentSignInCookieMaxAges = {
  probeSeconds: number;
  quietSeconds: number;
  suppressedSeconds: number;
  noticeSeconds: number;
};

export const DEFAULT_SILENT_SIGN_IN_MAX_AGES: SilentSignInCookieMaxAges = {
  probeSeconds: 60 * 10,
  quietSeconds: 60 * 30,
  suppressedSeconds: 60 * 60 * 24 * 30,
  noticeSeconds: 120,
};

export function createSilentSignInCookieSpec(prefix: string): SilentSignInCookieNames {
  const base = prefix.replace(/_+$/, "");
  return {
    probe: `${base}_probe`,
    quiet: `${base}_quiet`,
    suppressed: `${base}_suppressed`,
    notice: `${base}_notice`,
  };
}

export function defaultCookieSetOptions(maxAgeSeconds: number): {
  maxAgeSeconds: number;
  httpOnly: true;
  sameSite: "Lax";
  path: "/";
} {
  return {
    maxAgeSeconds,
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
  };
}
