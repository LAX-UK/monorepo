import { createAuthClient as createBaseAuthClient } from "better-auth/client";
import { magicLinkClient, phoneNumberClient, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient as createReactAuthClient } from "better-auth/react";

export function createAuthClientInstance(options: { baseURL: string }) {
  return createBaseAuthClient({
    baseURL: options.baseURL,
  });
}

export function resolveAuthBaseUrl(input: {
  authUrl?: string | undefined;
  apiUrl?: string | undefined;
  fallbackUrl?: string | undefined;
}): string {
  return (
    input.authUrl?.replace(/\/+$/, "") ??
    input.apiUrl?.replace(/\/+$/, "") ??
    input.fallbackUrl ??
    "http://localhost:3001"
  );
}

export type AuthClientError =
  | {
      message?: string | undefined;
      code?: string | undefined;
      status?: number | undefined;
      statusText?: string | undefined;
    }
  | null
  | undefined;

/** Narrow consumer contract checked against the configured Better Auth client. */
export type AuctionAuthClient = {
  signIn: {
    email: (args: { email: string; password: string }) => Promise<{
      data?: unknown;
      error?: AuthClientError;
    }>;
    phoneNumber: (args: {
      phoneNumber: string;
      password: string;
      rememberMe?: boolean;
    }) => Promise<{
      data?: unknown;
      error?: AuthClientError;
    }>;
    social: (args: {
      provider: string;
      callbackURL?: string;
      errorCallbackURL?: string;
      newUserCallbackURL?: string;
      disableRedirect?: boolean;
    }) => Promise<{
      data?: unknown;
      error?: AuthClientError;
    }>;
    magicLink: (args: {
      email: string;
      callbackURL?: string;
      errorCallbackURL?: string;
      turnstileToken?: string;
    }) => Promise<{ data?: unknown; error?: AuthClientError }>;
  };
  signOut: () => Promise<{ data?: unknown; error?: AuthClientError }>;
  sendVerificationEmail: (args: { email: string; callbackURL?: string }) => Promise<{
    data?: unknown;
    error?: AuthClientError;
  }>;
  updateUser: (args: { phoneNumber?: string | null }) => Promise<{
    data?: unknown;
    error?: AuthClientError;
  }>;
  useSession: () => {
    data: { user?: Record<string, unknown> } | null;
    isPending: boolean;
    isRefetching: boolean;
    error: Error | null;
    refetch: (opts?: { query?: { disableCookieCache?: boolean } }) => Promise<void>;
  };
  phoneNumber: {
    sendOtp: (args: {
      phoneNumber: string;
    }) => Promise<{ data?: unknown; error?: AuthClientError }>;
    verify: (args: {
      phoneNumber: string;
      code: string;
      updatePhoneNumber?: boolean;
      disableSession?: boolean;
    }) => Promise<{ data?: unknown; error?: AuthClientError }>;
  };
  twoFactor: {
    enable: (args: { password?: string }) => Promise<{
      data?: { totpURI?: string; backupCodes?: string[] } | null;
      error?: AuthClientError;
    }>;
    verifyTotp: (args: { code: string; trustDevice?: boolean }) => Promise<{
      data?: unknown;
      error?: AuthClientError;
    }>;
    verifyBackupCode: (args: { code: string; trustDevice?: boolean }) => Promise<{
      data?: unknown;
      error?: AuthClientError;
    }>;
    disable: (args: {
      password?: string;
    }) => Promise<{ data?: unknown; error?: AuthClientError }>;
    generateBackupCodes: (args: { password?: string }) => Promise<{
      data?: { backupCodes?: string[] } | null;
      error?: AuthClientError;
    }>;
  };
  listAccounts: () => Promise<{
    data?: Array<{
      id: string;
      accountId: string;
      providerId: string;
      createdAt: Date;
      updatedAt: Date;
      scopes: string[];
    }> | null;
    error?: AuthClientError;
  }>;
  linkSocial: (args: {
    provider: "google" | "apple";
    callbackURL: string;
  }) => Promise<{ data?: unknown; error?: AuthClientError }>;
  unlinkAccount: (args: {
    providerId: "google" | "apple";
  }) => Promise<{ data?: unknown; error?: AuthClientError }>;
};

export function createAuctionAuthClient(options: { baseURL: string }): AuctionAuthClient {
  const client = createReactAuthClient({
    baseURL: options.baseURL,
    plugins: [twoFactorClient(), magicLinkClient(), phoneNumberClient()],
  });
  const checked: AuctionAuthClient = client;
  return checked;
}
