import type {
  ConnectedAccountsState,
  LinkableProvider,
} from "@/lib/auth/hooks/use-connected-accounts";

export type SignInMethodKey = "magicLink" | "password" | "google" | "apple";

const METHOD_LABEL: Record<SignInMethodKey, string> = {
  magicLink: "Email sign-in link",
  password: "Email and password",
  google: "Google",
  apple: "Apple",
};

export function computeSignInMethods(options: {
  state: ConnectedAccountsState;
  emailVerified: boolean;
}) {
  const { state, emailVerified } = options;
  const magicLinkAvailable = emailVerified === true;

  const methods: SignInMethodKey[] = [];
  if (magicLinkAvailable) methods.push("magicLink");
  if (state.hasPassword) methods.push("password");
  if (state.google) methods.push("google");
  if (state.apple) methods.push("apple");

  const totalMethods = methods.length;

  const canUnlink = (providerId: LinkableProvider): boolean => {
    const linked =
      (providerId === "google" && state.google != null) ||
      (providerId === "apple" && state.apple != null);
    if (!linked) return false;
    return totalMethods - 1 >= 1;
  };

  const remainingSignInMethodLabels = (exclude?: LinkableProvider): string[] =>
    methods
      .filter((key) => {
        if (exclude === "google" && key === "google") return false;
        if (exclude === "apple" && key === "apple") return false;
        return true;
      })
      .map((key) => METHOD_LABEL[key]);

  return {
    magicLinkAvailable,
    totalMethods,
    methods,
    canUnlink,
    remainingSignInMethodLabels,
  };
}
