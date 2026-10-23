const SCOPE_DESCRIPTIONS: Readonly<Record<string, string>> = {
  openid: "Confirm it's you",
  profile: "See your name",
  email: "See your email address",
  offline_access: "Keep you signed in",
  "shop.admin": "Use LAX Admin",
};

/** Shown for any scope without a description, so a raw scope string never reaches the page. */
export const UNKNOWN_SCOPE_DESCRIPTION = "Use other parts of your LAX Account";

/** One line per distinct permission, in request order; every unrecognised scope shares a single line. */
export function describeHostedScopes(scopes: readonly string[]): string[] {
  const lines: string[] = [];
  for (const scope of scopes) {
    const line = Object.hasOwn(SCOPE_DESCRIPTIONS, scope)
      ? (SCOPE_DESCRIPTIONS[scope] as string)
      : UNKNOWN_SCOPE_DESCRIPTION;
    if (!lines.includes(line)) lines.push(line);
  }
  return lines;
}
