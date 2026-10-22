/** "account_manager" becomes "Account manager": the role as staff read it in the account menu. */
export function staffRoleLabel(role: string): string {
  const spaced = role.replaceAll("_", " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
