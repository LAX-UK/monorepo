import { magicLinkClient, phoneNumberClient, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const baseURL =
  process.env.NEXT_PUBLIC_AUTH_URL?.replace(/\/$/, "") ??
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:3001";

/** Canonical Better Auth issuer origin (same logic as the browser auth client). */
export function getAuthIssuerBaseUrl(): string {
  return baseURL;
}

function createAppAuthClient() {
  return createAuthClient({
    baseURL,
    plugins: [twoFactorClient(), magicLinkClient(), phoneNumberClient()],
  });
}

/** Narrow export surface: avoids TS2742 from Better Auth’s deep plugin + zod inference graph. */
type AuthErr = { message?: string; code?: string } | null | undefined;

type AuctionAuthClient = {
  signIn: {
    email: (args: { email: string; password: string }) => Promise<{
      data?: {
        twoFactorRedirect?: boolean;
        twoFactorMethods?: string[];
      } | null;
      error?: AuthErr;
    }>;
    phoneNumber: (args: {
      phoneNumber: string;
      password: string;
      rememberMe?: boolean;
    }) => Promise<{
      data?: {
        twoFactorRedirect?: boolean;
        twoFactorMethods?: string[];
      } | null;
      error?: AuthErr;
    }>;
    social: (args: Record<string, unknown>) => Promise<{ data?: unknown; error?: AuthErr }>;
    magicLink: (args: {
      email: string;
      callbackURL?: string;
      errorCallbackURL?: string;
      turnstileToken?: string;
    }) => Promise<{ data?: { status?: boolean } | null; error?: AuthErr }>;
  };
  signOut: () => Promise<{ data?: unknown; error?: AuthErr }>;
  sendVerificationEmail: (
    args: Record<string, unknown>,
  ) => Promise<{ data?: unknown; error?: AuthErr }>;
  updateUser: (args: { phoneNumber?: string | null }) => Promise<{
    data?: unknown;
    error?: AuthErr;
  }>;
  useSession: () => {
    data: { user?: Record<string, unknown> } | null;
    isPending: boolean;
    isRefetching: boolean;
    error: Error | null;
    refetch: (opts?: { query?: { disableCookieCache?: boolean } }) => Promise<void>;
  };
  phoneNumber: {
    sendOtp: (args: { phoneNumber: string }) => Promise<{ data?: unknown; error?: AuthErr }>;
    verify: (args: {
      phoneNumber: string;
      code: string;
      updatePhoneNumber?: boolean;
      disableSession?: boolean;
    }) => Promise<{ data?: unknown; error?: AuthErr }>;
  };
  twoFactor: {
    enable: (args: { password: string }) => Promise<{
      data?: { totpURI?: string; backupCodes?: string[] };
      error?: AuthErr;
    }>;
    verifyTotp: (args: { code: string; trustDevice?: boolean }) => Promise<{
      data?: unknown;
      error?: AuthErr;
    }>;
    verifyBackupCode: (args: { code: string; trustDevice?: boolean }) => Promise<{
      data?: unknown;
      error?: AuthErr;
    }>;
    disable: (args: { password: string }) => Promise<{ data?: unknown; error?: AuthErr }>;
    generateBackupCodes: (args: { password: string }) => Promise<{
      data?: { backupCodes?: string[] };
      error?: AuthErr;
    }>;
  };
};

/** Points at the canonical auth issuer; Better Auth uses `/api/auth` routes on that host. */
export const authClient: AuctionAuthClient = createAppAuthClient() as unknown as AuctionAuthClient;
