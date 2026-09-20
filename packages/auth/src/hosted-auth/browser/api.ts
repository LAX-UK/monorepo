export type HostedAuthConfig = {
  authorizeResumePath: string | null;
  loginPath: string;
  twoFactorPath: string;
  restartUrl: string;
  allowedRedirectOrigins: string[];
  turnstileSiteKey: string | null;
  requireEmailVerification: boolean;
};

export type JsonResponse = {
  response: { ok: boolean; status: number };
  data: unknown;
};
