export type HostedAuthConfig = {
  authorizeResumePath: string | null;
  loginPath: string;
  twoFactorPath: string;
  restartUrl: string;
  /** The family contact page, for people who cannot be helped on this screen. */
  contactUrl: string;
  allowedRedirectOrigins: string[];
  turnstileSiteKey: string | null;
  requireEmailVerification: boolean;
};

export type JsonResponse = {
  response: { ok: boolean; status: number; headers?: { get(name: string): string | null } };
  data: unknown;
};
