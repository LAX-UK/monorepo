export type SilentSignInStrategy = "redirect" | "fedcm";

export type SelectSilentSignInStrategyInput = {
  fedcmEnabled: boolean;
  userAgentBrands?: string | null;
};

export function selectSilentSignInStrategy(
  input: SelectSilentSignInStrategyInput,
): SilentSignInStrategy {
  if (!input.fedcmEnabled) {
    return "redirect";
  }
  return "fedcm";
}

export type NavigatorCredentialsLike = {
  get(options: {
    identity?: {
      context: "signin";
      providers: Array<{ configURL: string; clientId: string }>;
      mediation?: "silent" | "optional" | "required";
    };
  }): Promise<{ token?: string } | null>;
};

export async function requestSilentFedcmCredential(
  navigatorCredentials: NavigatorCredentialsLike | undefined,
  config: { configUrl: string; clientId: string },
): Promise<string | null> {
  if (!navigatorCredentials?.get) return null;
  try {
    const result = await navigatorCredentials.get({
      identity: {
        context: "signin",
        providers: [{ configURL: config.configUrl, clientId: config.clientId }],
        mediation: "silent",
      },
    });
    return result?.token ?? null;
  } catch {
    return null;
  }
}
