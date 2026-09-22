export type AccountChromeState =
  | { kind: "guest"; loginHref: string; registerHref: string }
  | {
      kind: "authenticated";
      displayName: string;
      email: string;
      accountHref: string;
      logoutHref: string;
    }
  | { kind: "disabled"; message: string; accountHref?: string }
  | { kind: "unavailable"; message: string };

export type ShopIdentityMePayload = {
  authenticated?: boolean;
  subject?: string;
  profile?: { email?: string | null; name?: string | null };
  reason?: string;
  tokenUpgradeRequired?: boolean;
};

export type MapShopMeToAccountChromeInput = {
  payload: ShopIdentityMePayload | null;
  sessionLookupOk: boolean;
  destinations: {
    loginHref: string;
    registerHref: string;
    accountHref: string;
    logoutHref: string;
    disabledAccountHref?: string;
  };
  copy?: {
    unavailable?: string;
    disabled?: string;
  };
};

const DEFAULT_UNAVAILABLE = "We could not verify your sign-in status. Try again in a moment.";
const DEFAULT_DISABLED = "Your LAX account is disabled. Contact support for help.";

export function mapShopMeToAccountChromeState(
  input: MapShopMeToAccountChromeInput,
): AccountChromeState {
  const { payload, sessionLookupOk, destinations } = input;
  const unavailableMessage = input.copy?.unavailable ?? DEFAULT_UNAVAILABLE;
  const disabledMessage = input.copy?.disabled ?? DEFAULT_DISABLED;

  if (!sessionLookupOk) {
    return { kind: "unavailable", message: unavailableMessage };
  }

  if (payload?.reason === "identity_disabled") {
    const disabled: AccountChromeState = {
      kind: "disabled",
      message: disabledMessage,
    };
    if (destinations.disabledAccountHref) {
      return { ...disabled, accountHref: destinations.disabledAccountHref };
    }
    return disabled;
  }

  if (payload?.authenticated) {
    const email = payload.profile?.email?.trim() ?? "";
    const displayName = payload.profile?.name?.trim() || email || "Your account";
    return {
      kind: "authenticated",
      displayName,
      email,
      accountHref: destinations.accountHref,
      logoutHref: destinations.logoutHref,
    };
  }

  return {
    kind: "guest",
    loginHref: destinations.loginHref,
    registerHref: destinations.registerHref,
  };
}
